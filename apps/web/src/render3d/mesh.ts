import {bindMeshMaterials,bindSceneMaterials,materialBindings,materialBindingKey} from './material-bindings';
import { buildWallSolids, openingRect } from './solids';
export { openingRect, subtractRectangle } from './solids';
import { sceneInvalidation } from './dependencies';
import { applyGeometry, partitionRectangles } from '@gharplan/geometry';
import type { Rect } from '@gharplan/geometry';
import type { ProjectDoc } from '@gharplan/core-model';
import type { MeshData, SceneBundle, CeilingWarning } from './types';

type V3 = [number, number, number];
interface Quad { axis: 0 | 1 | 2; at: number; rect: Rect; sign: -1 | 1; ownerId: string; materialId: string; slot: 'left' | 'right' }
interface CacheEntry { signature: string; mesh: MeshData }
type MeshCache = Map<string, CacheEntry>;
const axes = (axis: number): [0 | 1 | 2, 0 | 1 | 2] => axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);


function point(q: Quad, u: number, v: number): V3 {
  const result: V3 = [0, 0, 0], [a, b] = axes(q.axis); result[q.axis] = q.at; result[a] = u; result[b] = v; return result;
}
function corners(q: Quad): V3[] {
  const [u0, v0, u1, v1] = q.rect;
  return [point(q, u0, v0), point(q, u1, v0), point(q, u1, v1), point(q, u0, v1)];
}
function edgeLine(a: V3, b: V3): { key: string; axis: 0 | 1 | 2 } {
  const axis = (a[0] !== b[0] ? 0 : a[1] !== b[1] ? 1 : 2), [u, v] = axes(axis);
  return { axis, key: `${axis}:${a[u]}:${a[v]}` };
}
/** Remove irrelevant global height-band subdivisions before building mesh dependencies. */
function compactQuads(input: Quad[]): Quad[] {
  const groups = new Map<string, { face: Quad; rects: Rect[] }>();
  for (const q of input) {
    const key = `${q.ownerId}:${q.axis}:${q.at}:${q.sign}:${q.slot}`, group = groups.get(key) ?? { face: q, rects: [] };
    group.rects.push(q.rect); groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, { face, rects }]) =>
    partitionRectangles(rects.map(rect => ({ rect, ownerId: face.ownerId }))).map(p => ({ ...face, rect: p.rect })));
}
function triangles(quads: Quad[], materialScales: Map<string, number>, cache: MeshCache, bindings:ReturnType<typeof materialBindings>): { meshes: MeshData[]; built: number } {
  // Split all shared collinear edges at the same coordinates, including T boundaries.
  const lines = new Map<string, Set<number>>();
  for (const q of quads) {
    const cs = corners(q);
    for (let i = 0; i < 4; i++) {
      const a = cs[i]!, b = cs[(i + 1) % 4]!, { key, axis } = edgeLine(a, b), values = lines.get(key) ?? new Set<number>();
      values.add(a[axis]); values.add(b[axis]); lines.set(key, values);
    }
  }
  const sorted = new Map([...lines].map(([key, values]) => [key, unique([...values])]));
  const prepared = new Map<string, { q: Quad; perimeter: V3[]; scale: number }[]>();
  for (const q of quads) {
    const cs = corners(q), perimeter: V3[] = [];
    for (let i = 0; i < 4; i++) {
      const a = cs[i]!, b = cs[(i + 1) % 4]!, { key, axis } = edgeLine(a, b), forward = b[axis] > a[axis];
      const coordinates = sorted.get(key)!.filter(t => t >= Math.min(a[axis], b[axis]) && t <= Math.max(a[axis], b[axis]));
      if (!forward) coordinates.reverse();
      for (const t of coordinates.slice(0, -1)) { const p: V3 = [...a]; p[axis] = t; perimeter.push(p); }
    }
    prepared.set(q.ownerId, [...(prepared.get(q.ownerId) ?? []), { q, perimeter, scale: materialScales.get(q.materialId) ?? 1000 }]);
  }
  const meshes: MeshData[] = []; let vertices = 0, built = 0;
  for (const [entityId, faces] of prepared) {
    const id = `wall:${entityId}`, signature = JSON.stringify(faces.map(({q,perimeter,scale})=>({axis:q.axis,at:q.at,rect:q.rect,sign:q.sign,ownerId:q.ownerId,slot:q.slot,perimeter,scale}))), old = cache.get(id);
    // Compare the complete exposed geometry AND shared-edge dependency, not just rev/hash.
    if (old?.signature === signature) { meshes.push(bindMeshMaterials(old.mesh,bindings)); continue; }
    const data = { p: [] as number[], n: [] as number[], uv: [] as number[], groups: [] as MeshData['groups'],ranges:[] as NonNullable<MeshData['materialRanges']> };
    for (const { q, perimeter, scale } of faces) {
      const centre = point(q, (q.rect[0] + q.rect[2]) / 2, (q.rect[1] + q.rect[3]) / 2), [u, v] = axes(q.axis);
      const start = data.p.length / 3;
      for (let i = 0; i < perimeter.length; i++) {
        const a = perimeter[i]!, b = perimeter[(i + 1) % perimeter.length]!;
        const winding = (a[u] - centre[u]) * (b[v] - centre[v]) - (a[v] - centre[v]) * (b[u] - centre[u]);
        const wanted = q.sign * (q.axis === 1 ? -1 : 1);
        for (const p of winding * wanted > 0 ? [centre, a, b] : [centre, b, a]) {
          data.p.push(p[0] / 1000, p[1] / 1000, p[2] / 1000);
          data.n.push(q.axis === 0 ? q.sign : 0, q.axis === 1 ? q.sign : 0, q.axis === 2 ? q.sign : 0);
          data.uv.push(p[u] / scale, p[v] / scale);
        }
        vertices += 3;
        if (vertices > 500_000) throw new Error('This drawing exceeds the 3D preview vertex budget. Your 2D drawing is unchanged.');
      }
      const count = data.p.length / 3 - start, last = data.groups.at(-1);data.ranges.push({start,count,slot:q.slot});
      if (last?.materialId === q.materialId) last.count += count;
      else data.groups.push({ start, count, materialId: q.materialId });
    }
    const mesh: MeshData = { id, entityId, category: 'wall', positions: new Float64Array(data.p), normals: new Float32Array(data.n), uv: new Float32Array(data.uv), groups: data.groups,materialRanges:data.ranges };
    cache.set(id, { signature, mesh }); meshes.push(mesh); built++;
  }
  return { meshes, built };
}

/** Pure CPU scene derivation: height-band solid union, real holes, exposed faces only. */
function buildGeometryScene(document: ProjectDoc, cache: MeshCache): SceneBundle {
  const derived = applyGeometry(document, { op: 'analyze' });
  if (!derived.accepted) throw derived.error;
  const floorElevation=new Map(document.floors.map(f=>[f.id,f.elevation])),elevationOf=(floorId:string)=>floorElevation.get(floorId)??document.floors[0]!.elevation,walls=new Map(document.walls.map(w=>[w.id,w])),junctions=new Map(document.junctions.map(j=>[j.id,j]));
  const {boxes,faces}=buildWallSolids(document),bindings=materialBindings(document);
  const quads:Quad[]=faces.map(face=>{
    const wall=walls.get(face.ownerId)!,a=junctions.get(wall.a)!,b=junctions.get(wall.b)!;
    const leftDot=face.axis===0?face.sign*(b.y-a.y):face.axis===2?-face.sign*(b.x-a.x):0;
    return {...face,materialId:leftDot<0?wall.rightMaterial:wall.leftMaterial,slot:leftDot<0?'right':'left'};
  });
  const scales = new Map(document.materials.map(m => [m.id, m.uvScaleMm ?? 1000]));
  const compact = compactQuads(quads), result = triangles(compact, scales, cache,bindings), meshes = result.meshes; let meshesBuilt = result.built;
  // Floors/thresholds face up; ceilings face down at their independent room height.
  const plane = (id: string, entityId: string, category: 'floor' | 'threshold' | 'ceiling', rects: readonly Rect[], materialId: string, height: number, down = false) => {
    const scale = category==='ceiling'?1000:scales.get(materialId)??1000;
    const signature = JSON.stringify([category, entityId, rects, scale, height, down]), old = cache.get(id);
    if (old?.signature === signature) { meshes.push(bindMeshMaterials(old.mesh,bindings)); return; }
    const p: number[] = [], n: number[] = [], uv: number[] = [];
    for (const [x0, z0, x1, z1] of rects) for (const [x, z] of (down ? [[x0,z0],[x1,z1],[x0,z1],[x0,z0],[x1,z0],[x1,z1]] : [[x0,z0],[x0,z1],[x1,z1],[x0,z0],[x1,z1],[x1,z0]]) as [number,number][]) {
      p.push(x / 1000, height / 1000, z / 1000); n.push(0, down ? -1 : 1, 0); uv.push(x / scale, z / scale);
    }
    const mesh: MeshData = { id, entityId, category, positions: new Float64Array(p), normals: new Float32Array(n), uv: new Float32Array(uv), groups: [{ start: 0, count: p.length / 3, materialId }],materialRanges:[{start:0,count:p.length/3,slot:category}] };
    cache.set(id, { signature, mesh }); meshes.push(mesh); meshesBuilt++;
  };
  for (const face of derived.derived.faces) {
    const room = document.rooms.find(r => r.id === face.roomId)!;
    plane(`floor:${room.id}`, room.id, 'floor', face.clearRects, room.floorMaterial, elevationOf(room.floorId));
    plane(`ceiling:${room.id}`, room.id, 'ceiling', face.clearRects, '__ceiling', elevationOf(room.floorId) + room.ceilingHeight, true);
  }
  for (const opening of document.openings) if (opening.kind === 'door' && opening.sill === 0) {
    const wall = walls.get(opening.wallId)!, material = document.rooms.find(r => r.boundary.includes(wall.a) && r.boundary.includes(wall.b))?.floorMaterial ?? document.materials[0]!.id;
    plane(`threshold:${opening.id}`, opening.id, 'threshold', [openingRect(document, wall, opening)], material, elevationOf(wall.floorId));
  }
  let bounds: SceneBundle['bounds'] = null;
  for (const box of boxes) {
    if (!bounds) bounds = [box.lo[0] / 1000, box.lo[1] / 1000, box.lo[2] / 1000, box.hi[0] / 1000, box.hi[1] / 1000, box.hi[2] / 1000];
    else for (const axis of [0, 1, 2] as const) { bounds[axis] = Math.min(bounds[axis], box.lo[axis] / 1000); bounds[axis + 3] = Math.max(bounds[axis + 3]!, box.hi[axis] / 1000); }
  }
  for(const room of document.rooms)if(bounds)bounds[4]=Math.max(bounds[4],(elevationOf(room.floorId)+room.ceilingHeight)/1000);
  const warningMap=new Map<string,CeilingWarning>();
  for(const wall of document.walls){const adjacent=document.rooms.filter(room=>room.boundary.some((id,i)=>id===wall.a&&room.boundary[(i+1)%room.boundary.length]===wall.b||id===wall.b&&room.boundary[(i+1)%room.boundary.length]===wall.a)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);if(adjacent.length===2&&adjacent[0]!.ceilingHeight!==adjacent[1]!.ceilingHeight){const a=adjacent[0]!,b=adjacent[1]!,key=JSON.stringify([a.id,b.id]);const warning:CeilingWarning=warningMap.get(key)??{roomIds:[a.id,b.id],wallIds:[],heightsMm:[a.ceilingHeight,b.ceilingHeight]};warning.wallIds.push(wall.id);warningMap.set(key,warning);}}
  const ceilingWarnings=[...warningMap.values()].map(w=>({...w,wallIds:[...w.wallIds].sort()})).sort((a,b)=>JSON.stringify(a.roomIds)<JSON.stringify(b.roomIds)?-1:1);
  const vertices = meshes.reduce((sum, m) => sum + m.positions.length / 3, 0);
  if (vertices > 500_000) throw new Error('This drawing exceeds the 3D preview vertex budget. Your 2D drawing is unchanged.');
  const wanted = new Set(meshes.map(m => m.id)); for (const id of cache.keys()) if (!wanted.has(id)) cache.delete(id);
  return { meshes, bounds, ceilingWarnings, stats: { boxes: boxes.length, quads: compact.length, vertices, meshesBuilt,
    wallVolumeMm3: boxes.reduce((sum, b) => sum + (b.hi[0] - b.lo[0]) * (b.hi[1] - b.lo[1]) * (b.hi[2] - b.lo[2]), 0) } };
}

function furnitureBounds(document:ProjectDoc,structural:SceneBundle['bounds']):SceneBundle['bounds'] {
 const result=structural?[...structural] as NonNullable<SceneBundle['bounds']>:null;let bounds=result;
 for(const f of document.furniture){const r=f.rotationDeg*Math.PI/180,hx=(Math.abs(Math.cos(r))*f.size.w+Math.abs(Math.sin(r))*f.size.d)/2000,hz=(Math.abs(Math.sin(r))*f.size.w+Math.abs(Math.cos(r))*f.size.d)/2000,x=f.position.x/1000,z=f.position.y/1000,y=((document.floors.find(floor=>floor.id===f.floorId)??document.floors[0]!).elevation+f.elevation)/1000,box:[number,number,number,number,number,number]=[x-hx,y,z-hz,x+hx,y+f.size.h/1000,z+hz];if(!bounds)bounds=box;else for(const axis of [0,1,2] as const){bounds[axis]=Math.min(bounds[axis],box[axis]);bounds[axis+3]=Math.max(bounds[axis+3]!,box[axis+3]!);}}
 return bounds;
}
/** Pure canonical scene derivation with complete geometry/furniture framing bounds. */
export function buildScene(document:ProjectDoc,cache:MeshCache=new Map()):SceneBundle {const bundle=buildGeometryScene(document,cache);return {...bundle,bounds:furnitureBounds(document,bundle.bounds)};}

/** Persistent worker builder. Geometry-only dependencies skip unrelated full CPU builds. */
export class CachedSceneBuilder {
  #bundle: SceneBundle | undefined; #cache: MeshCache = new Map();
  #previous:ProjectDoc|null=null;#bindingKey='';
  build(document: ProjectDoc): SceneBundle {
    const invalidation=sceneInvalidation(this.#previous,document);
    const bindingKey=materialBindingKey(document);
    if (!invalidation.geometryChanged && this.#bundle) {if(bindingKey!==this.#bindingKey)this.#bundle={...this.#bundle,meshes:bindSceneMaterials(this.#bundle.meshes,document)};this.#bindingKey=bindingKey;this.#previous=structuredClone(document);return { ...this.#bundle, invalidation, bounds:furnitureBounds(document,this.#bundle.bounds), stats: { ...this.#bundle.stats, meshesBuilt: 0 } };}
    const bundle = buildGeometryScene(document, this.#cache); this.#bundle = bundle;this.#bindingKey=bindingKey;this.#previous=structuredClone(document); return {...bundle,invalidation,bounds:furnitureBounds(document,bundle.bounds)};
  }
}
