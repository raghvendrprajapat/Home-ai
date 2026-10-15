import { candidatePairs, partitionRectangles, rectArea, wallStrips } from '@gharplan/geometry';
import type { Rect } from '@gharplan/geometry';
import type { Opening, ProjectDoc, ProjectStore, Wall } from '@gharplan/core-model';
type SolidDocument=ReturnType<ProjectStore['getSnapshot']>['document'];
/** Derived millimetres in [east, up, south] order, NOT canonical plan [x,y,z]. */
export type SolidPoint = [eastMm:number, upMm:number, southMm:number];
export interface SolidBox {lo:SolidPoint;hi:SolidPoint;ownerId:string}
export interface SolidFace {axis:0|1|2;at:number;rect:Rect;sign:-1|1;ownerId:string}
export interface WallSolids {boxes:readonly SolidBox[];faces:readonly SolidFace[];longitudinalSides:readonly SolidFace[]}
const axes = (axis:number):[0|1|2,0|1|2]=>axis===0?[1,2]:axis===1?[0,2]:[0,1];
const unique = (values:number[])=>[...new Set(values)].sort((a,b)=>a-b);

/** Exact orthogonal rectangle difference; no epsilon or rasterization. */
export function subtractRectangle(a: Rect, b: Rect): Rect[] {
  const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
  if (x0 >= x1 || y0 >= y1) return [a];
  return ([[a[0], a[1], x0, a[3]], [x1, a[1], a[2], a[3]], [x0, a[1], x1, y0], [x0, y1, x1, a[3]]] as Rect[]).filter(r => rectArea(r) > 0);
}

/** Opening centre/width is measured along a→b, including reversed hosts. */
export function openingRect(document: SolidDocument, wall: Wall, opening: Opening): Rect {
  const a = document.junctions.find(j => j.id === wall.a)!, b = document.junctions.find(j => j.id === wall.b)!;
  const horizontal = a.y === b.y, direction = Math.sign(horizontal ? b.x - a.x : b.y - a.y);
  const centre = (horizontal ? a.x : a.y) + direction * opening.offset, half = wall.thickness / 2;
  return horizontal ? [centre - opening.width / 2, a.y - half, centre + opening.width / 2, a.y + half] :
    [a.x - half, centre - opening.width / 2, a.x + half, centre + opening.width / 2];
}

/** Validated L0 documents only. Cut each host before union; retain actual exposed faces.
 * Bounds/work/surface limits deliberately match the retained 3D derivation. */
export function buildWallSolids(document:SolidDocument):WallSolids {
  const elevation = document.floors[0]!.elevation, walls = new Map(document.walls.map(w => [w.id, w]));
  const openings = new Map<string, Opening[]>();
  for (const opening of document.openings) openings.set(opening.wallId, [...(openings.get(opening.wallId) ?? []), opening]);
  const heights = unique([0, ...document.walls.map(w => w.height), ...document.openings.flatMap(o => [o.sill, o.sill + o.height])]);
  const boxes: SolidBox[] = [],longitudinalSides:SolidFace[]=[];
  const junctions=new Map(document.junctions.map(j=>[j.id,j])); let work = 0;
  const budget = () => { if (++work > 2_000_000) throw new Error('This drawing exceeds the 3D preview work budget. Your 2D drawing is unchanged.'); };
  for (let h = 0; h < heights.length - 1; h++) {
    const low = heights[h]!, high = heights[h + 1]!;
    const pieces = wallStrips(document as ProjectDoc, low).flatMap(strip => {
      // Preserve actual cap extension per active height band before union ownership.
      const wall=walls.get(strip.ownerId)!,a=junctions.get(wall.a)!,b=junctions.get(wall.b)!;
      const horizontal=a.y===b.y,axis=horizontal?2:0;

      let rects = [strip.rect];
      for (const opening of openings.get(strip.ownerId) ?? []) {
        if (opening.sill >= high || opening.sill + opening.height <= low) continue;
        const hole = openingRect(document, walls.get(strip.ownerId)!, opening);
        rects = rects.flatMap(r => { budget(); return subtractRectangle(r, hole); });
      }
      // Eligibility follows THIS host's post-opening solids, never a perpendicular
      // cap filling its doorway. Keep original side planes; cuts create no jamb snaps.
      for(const rect of rects)for(const sign of [-1,1] as const){
        const n=horizontal?(sign===-1?1:3):(sign===-1?0:2);
        if(rect[n]!==strip.rect[n])continue;
        longitudinalSides.push({axis,sign,ownerId:wall.id,at:strip.rect[n],rect:horizontal?[rect[0],elevation+low,rect[2],elevation+high]:[elevation+low,rect[1],elevation+high,rect[3]]});
      }
      return rects.map(rect => ({ ownerId: strip.ownerId, rect }));
    });
    // Cut hosts BEFORE union ownership: other solid walls must not acquire the host's hole.
    for (const piece of partitionRectangles(pieces)) {
      budget(); const [x0, z0, x1, z1] = piece.rect;
      boxes.push({ ownerId: piece.ownerId, lo: [x0, elevation + low, z0], hi: [x1, elevation + high, z1] });
    }
  }
  const planes = new Map<string, SolidFace[]>();
  for (const box of boxes) for (const axis of [0, 1, 2] as const) for (const sign of [-1, 1] as const) {
    const [u, v] = axes(axis), at = sign === -1 ? box.lo[axis] : box.hi[axis];
    const q: SolidFace = { axis, at, sign, rect: [box.lo[u], box.lo[v], box.hi[u], box.hi[v]], ownerId: box.ownerId };
    const key = `${axis}:${at}`; planes.set(key, [...(planes.get(key) ?? []), q]);
  }
  const quads: SolidFace[] = [];
  for (const faces of planes.values()) {
    const opposites = new Map<number, number[]>();
    for (const [i, j] of candidatePairs(faces.map(f => f.rect))) if (faces[i]!.sign !== faces[j]!.sign) {
      opposites.set(i, [...(opposites.get(i) ?? []), j]); opposites.set(j, [...(opposites.get(j) ?? []), i]);
    }
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i]!;
      let fragments = [face.rect];
      for (const j of opposites.get(i) ?? []) {
        budget(); const other = faces[j]!;
        fragments = fragments.flatMap(r => { budget(); return subtractRectangle(r, other.rect); });
        if (!fragments.length) break;
      }
      quads.push(...fragments.map(rect => ({ ...face, rect })));
      if (quads.length > 100_000) throw new Error('This drawing exceeds the 3D preview surface budget. Your 2D drawing is unchanged.');
    }
  }
  return {boxes,faces:quads,longitudinalSides};
}
/** Geometry-only advisory cache. Material bindings are never cached here. */
export class WallSolidsCache {
 #key:string|undefined;#value:WallSolids|undefined;#builds=0;
 get builds():number{return this.#builds;}
 get(document:SolidDocument):WallSolids {
  const key=JSON.stringify([
   document.floors.map(({id,elevation})=>[id,elevation]),
   document.junctions.map(({id,floorId,x,y})=>[id,floorId,x,y]),
   document.walls.map(({id,floorId,a,b,thickness,height})=>[id,floorId,a,b,thickness,height]),
   document.openings.map(({id,wallId,offset,width,height,sill})=>[id,wallId,offset,width,height,sill]),
  ]);
  if(this.#value&&key===this.#key)return this.#value;
  const value=buildWallSolids(document);
  for(const box of value.boxes){Object.freeze(box.lo);Object.freeze(box.hi);Object.freeze(box);}
  for(const face of [...value.faces,...value.longitudinalSides]){Object.freeze(face.rect);Object.freeze(face);}
  Object.freeze(value.boxes);Object.freeze(value.faces);Object.freeze(value.longitudinalSides);Object.freeze(value);
  this.#key=key;this.#value=value;this.#builds++;return value;
 }
}
