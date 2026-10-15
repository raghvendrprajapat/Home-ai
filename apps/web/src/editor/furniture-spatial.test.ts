import {describe,it,expect} from 'vitest';
import fc from 'fast-check';
import {ProjectStore} from '@gharplan/core-model';
import type {FurnitureItem,ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {buildWallSolids,WallSolidsCache} from '../render3d/solids';
import type {WallSolids} from '../render3d/solids';
import {alignFurnitureBack,furnitureCollisions,furnitureFootprint,furniturePairOverlap,footprintsOverlap} from './furniture-spatial';
const fixture=sample as ProjectDoc;
const single=(y=0,thickness=200):ProjectDoc=>{
 const d=structuredClone(sample) as ProjectDoc;d.junctions=[{id:'j1',floorId:'f0',x:0,y},{id:'j2',floorId:'f0',x:4000,y}];d.walls=[{...d.walls[0]!,a:'j1',b:'j2',thickness}];d.openings=[];d.rooms=[];d.furniture=[];return d;
};
const item=(x=2000,y=500,rotationDeg=0):FurnitureItem=>({...structuredClone(sample.furniture[0]!) as FurnitureItem,id:'object',position:{x,y},rotationDeg,size:{w:1000,d:600,h:800}});
const flags=(d:ProjectDoc,f:FurnitureItem)=>furnitureCollisions(d,f,buildWallSolids(d));
describe('PH4-T03 C2a / GEO-018,019 analytic/property proofs (Codex-authored)',()=>{
 it('GEO-018 uses true oriented boxes, including rotated disjoint shapes with overlapping AABBs',()=>{
  const a={...item(0,0,45),size:{w:1000,d:100,h:800}},b={...item(-100,100,45),id:'other',size:{...a.size}};
  expect(furniturePairOverlap(a,b)).toBe(false);expect(furniturePairOverlap(a,{...b,position:{x:-20,y:20}})).toBe(true);
  expect(footprintsOverlap(furnitureFootprint(item(0,0)),furnitureFootprint(item(1000,0)))).toBe(false);
  expect(furniturePairOverlap(item(0,0),{...item(0,0),elevation:800})).toBe(false);
  expect(furniturePairOverlap(item(0,0),{...item(0,0),floorId:'other'})).toBe(false);
  expect(()=>furnitureFootprint({...item(),size:{w:NaN,d:1,h:1}})).toThrow('footprint');
 });
 it('GEO-018 agrees with independent exact axis intervals, symmetry and translated/rotated invariance',()=>{
  fc.assert(fc.property(fc.integer({min:-5000,max:5000}),fc.integer({min:-5000,max:5000}),fc.integer({min:1,max:1000}),fc.integer({min:1,max:1000}),fc.integer({min:0,max:360}),(x,y,w,d,angle)=>{
   const a={...item(0,0),size:{w,d,h:1000}},b={...item(x,y),size:{w,d,h:1000}};
   expect(furniturePairOverlap(a,b)).toBe(Math.abs(x)<w&&Math.abs(y)<d);
   const r=angle*Math.PI/180,rotated={...b,position:{x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)},rotationDeg:angle},ar={...a,rotationDeg:angle};
   expect(furniturePairOverlap(ar,rotated)).toBe(furniturePairOverlap(a,b));
   expect(furniturePairOverlap(rotated,ar)).toBe(furniturePairOverlap(ar,rotated));
   expect(furnitureFootprint(a).halfWidth).toBe(w/2);
   const t=(f:FurnitureItem)=>({...f,position:{x:f.position.x-32000,y:f.position.y+17000},elevation:f.elevation+100});
   expect(furniturePairOverlap(t(ar),t(rotated))).toBe(furniturePairOverlap(ar,rotated));
  }),{seed:20261015,numRuns:300});
 });
 it('GEO-018 respects real window sill/lintel/void, tangent faces, self ID and floor elevation',()=>{
  const d=single();d.floors[0]!.elevation=-315;d.openings=[{...fixture.openings[2]!,wallId:'w1',offset:2000,width:1500}];
  const f={...item(2000,0),elevation:950,size:{w:1000,d:100,h:1100}};
  d.furniture=[structuredClone(f),{...item(2000,0),id:'other',elevation:950,size:{...f.size}}];
  expect(flags(d,f)).toEqual({wallIds:[],furnitureIds:['other']});
  expect(flags(d,{...f,elevation:899,size:{...f.size,h:101}}).wallIds).toEqual(['w1']);
  expect(flags(d,{...f,elevation:2050,size:{...f.size,h:51}}).wallIds).toEqual(['w1']);
  expect(flags(d,{...f,elevation:900,size:{...f.size,h:1200}}).wallIds).toEqual([]);
  expect(flags(single(),item(2000,400)).wallIds).toEqual([]);
  expect(flags(single(),item(2000,399)).wallIds).toEqual(['w1']);
 });
 it('GEO-018 random axis boxes agree with analytic wall-minus-window intersection volume',()=>{
  fc.assert(fc.property(fc.integer({min:50,max:500}),fc.integer({min:0,max:4000}),fc.integer({min:-500,max:500}),fc.integer({min:0,max:3200}),fc.integer({min:1,max:1500}),fc.integer({min:100,max:1200}),(t,x,y,z,h,w)=>{
   const d=single(-715,t);d.floors[0]!.elevation=-100;d.openings=[{...fixture.openings[2]!,wallId:'w1',offset:2000,width:1500}];
   const f={...item(x,y-715),elevation:z,size:{w,d:200,h}};
   const intersection=(a:number,b:number,c:number,e:number)=>Math.max(0,Math.min(b,e)-Math.max(a,c));
   const yLength=intersection(y-100,y+100,-t/2,t/2);
   const outer=intersection(x-w/2,x+w/2,-t/2,4000+t/2)*yLength*intersection(z,z+h,0,3000);
   const hole=intersection(x-w/2,x+w/2,1250,2750)*yLength*intersection(z,z+h,900,2100);
   expect(flags(d,f).wallIds.length>0).toBe(outer>hole);
  }),{seed:20261015,numRuns:200});
 });
 it('GEO-018/019 wall-array ownership and perpendicular T material owner do not remove actual solids',()=>{
  const d=single();d.junctions.splice(1,0,{id:'jm',floorId:'f0',x:2000,y:0});d.junctions.push({id:'js',floorId:'f0',x:2000,y:2000});
  d.walls=[{...d.walls[0]!,id:'stub',a:'jm',b:'js'},{...d.walls[0]!,a:'j1',b:'jm'},{...d.walls[0]!,id:'w2',a:'jm',b:'j2'}];
  const f=item(2000,450,180),solids=buildWallSolids(d);
  expect(furnitureCollisions(d,f,solids).wallIds).toContain('stub');
  expect(alignFurnitureBack(d,f,solids,200)).toBe(null);
  const away=item(1000,450,180);expect(alignFurnitureBack(d,away,solids,200)?.position).toEqual({x:1000,y:400});
  d.openings=[{...fixture.openings[0]!,wallId:'w1',offset:1500,width:1000}];
  expect(flags(d,{...item(2000,0),size:{w:100,d:100,h:800}}).wallIds).toContain('stub');
 });
 it('GEO-019 quantizes away from half-mm wall planes in both coordinate signs and four normals',()=>{
  for(const wallY of [0,715,-715])for(const depth of [599,600])for(const below of [false,true]){
   const d=single(wallY,115),side=below?1:-1,face=wallY+side*57.5,raw=face+side*depth/2,expected=side===1?Math.ceil(raw):Math.floor(raw);
   const f={...item(2000,Math.round(raw)+side*20,below?180:0),size:{w:1000,d:depth,h:800}},a=alignFurnitureBack(d,f,buildWallSolids(d),50);
   expect(a?.position).toEqual({x:2000,y:expected});expect(Number.isInteger(a!.position.y)).toBe(true);expect(flags(d,{...f,position:a!.position}).wallIds).toEqual([]);
   const gap=side*(expected-side*depth/2-face);expect(gap).toBeGreaterThanOrEqual(0);expect(gap).toBeLessThanOrEqual(1);
   const v=structuredClone(d);for(const j of v.junctions)[j.x,j.y]=[j.y,j.x];const vf={...f,position:{x:f.position.y,y:2000},rotationDeg:below?90:270};
   expect(alignFurnitureBack(v,vf,buildWallSolids(v),50)?.position).toEqual({x:expected,y:2000});
  }
  expect(alignFurnitureBack(single(715,115),item(2000,370,0),buildWallSolids(single(715,115)),50)?.position.y).toBe(357);
  expect(alignFurnitureBack(single(0,115),item(2000,-340,0),buildWallSolids(single(0,115)),50)?.position.y).toBe(-358);
 });
 it('GEO-019 supports continuous coplanar owners but never bridges complementary low/high patches',()=>{
  const d=single(),f={...item(2000,160,180),size:{w:1000,d:100,h:1000}};
  const halves:WallSolids={boxes:[],longitudinalSides:buildWallSolids(d).longitudinalSides,faces:[{axis:2,at:100,sign:1,ownerId:'first',rect:[1500,0,2000,500]},{axis:2,at:100,sign:1,ownerId:'second',rect:[2000,500,2500,1000]}]};
  expect(alignFurnitureBack(d,f,halves,50)).toBe(null);
  const full:WallSolids={boxes:[],longitudinalSides:halves.longitudinalSides,faces:halves.faces.map(face=>({...face,rect:[face.rect[0],0,face.rect[2],1000]}))};
  expect(alignFurnitureBack(d,f,full,50)?.position).toEqual({x:2000,y:150});
  const gap:WallSolids={boxes:[],longitudinalSides:halves.longitudinalSides,faces:full.faces.map((face,i)=>({...face,rect:[face.rect[0]+i,0,face.rect[2],1000]}))};
  expect(alignFurnitureBack(d,f,gap,50)).toBe(null);
 });
 it('GEO-019 excludes end caps, away-facing backs, unsupported angles, far teleports and high perpendicular end faces',()=>{
  const d=single(),s=buildWallSolids(d);
  expect(alignFurnitureBack(d,item(2000,-410,37),s,200)).toBe(null);
  expect(alignFurnitureBack(d,item(2000,-410,180),s,50)).toBe(null);
  expect(alignFurnitureBack(d,item(2000,-2000,0),s,200)).toBe(null);
  expect(alignFurnitureBack(d,item(-410,0,270),s,200)).toBe(null);
  expect(()=>alignFurnitureBack(d,item(),s,Infinity)).toThrow('distance');
  d.walls[0]!.height=500;
  const fake:WallSolids={boxes:[],longitudinalSides:buildWallSolids(d).longitudinalSides,faces:[{axis:2,at:100,sign:1,ownerId:'perpendicular',rect:[1500,1000,2500,2000]}]};
  expect(alignFurnitureBack(d,{...item(2000,410,180),elevation:1000},fake,200)).toBe(null);
 });
 it('fresh Codex review: a perpendicular free cap cannot inherit partial or cut-away side eligibility in either owner order',()=>{
  for(const reverse of [false,true])for(const opening of [false,true]){
   const d=single();d.junctions=[{id:'a0',floorId:'f0',x:0,y:0},{id:'a1',floorId:'f0',x:opening?3000:1000,y:0},{id:'b0',floorId:'f0',x:1300,y:-1000},{id:'b1',floorId:'f0',x:1300,y:-400}];
   d.walls=[{...d.walls[0]!,id:'wa',a:'a0',b:'a1',thickness:200,height:3000},{...d.walls[0]!,id:'wb',a:'b0',b:'b1',thickness:1000,height:3000}];if(reverse)d.walls.reverse();if(opening)d.openings=[{...fixture.openings[0]!,wallId:'wa',offset:1500,width:1000,height:2100,sill:0}];
   const doc=new ProjectStore(d,'cap_review').getSnapshot().document,f={...item(1450,410,180),size:{w:500,d:600,h:800}};
   expect(alignFurnitureBack(doc,f,buildWallSolids(doc),50)).toBe(null);
  }
 });
 it('GEO-019 random half-mm walls always yield integer centres within 1mm and no penetration',()=>{
  fc.assert(fc.property(fc.integer({min:-10000,max:10000}),fc.integer({min:50,max:1000}),fc.integer({min:100,max:1500}),fc.boolean(),(y,t,depth,below)=>{
   const d=single(y,t),side=below?1:-1,raw=y+side*(t/2+depth/2),f={...item(2000,Math.round(raw)+side*10,below?180:0),size:{w:1000,d:depth,h:800}},s=buildWallSolids(d),a=alignFurnitureBack(d,f,s,12);
   expect(a).not.toBe(null);expect(Number.isInteger(a!.position.y)).toBe(true);
   const gap=side*(a!.position.y-side*depth/2-y-side*t/2);expect(gap).toBeGreaterThanOrEqual(0);expect(gap).toBeLessThanOrEqual(1);expect(furnitureCollisions(d,{...f,position:a!.position},s).wallIds).toEqual([]);
  }),{seed:20261015,numRuns:150});
 });
 it('structural advisory cache excludes furniture/paint but includes order, elevation, heights and openings',()=>{
  const d=single(),cache=new WallSolidsCache(),a=cache.get(d);expect(cache.builds).toBe(1);
  for(let i=0;i<100;i++){d.furniture=[item(i,500)];d.walls[0]!.leftMaterial=i%2?'m_ext':'m_paint_white';d.materials[0]!.baseColor='#000000';expect(cache.get(d)).toBe(a);}
  expect(cache.builds).toBe(1);expect(Object.isFrozen(a.boxes[0]!.lo)).toBe(true);
  d.floors[0]!.elevation=100;expect(cache.get(d)).not.toBe(a);d.walls[0]!.height=2500;cache.get(d);d.openings=[{...fixture.openings[2]!,wallId:'w1',offset:2000}];cache.get(d);expect(cache.builds).toBe(4);
  const t=single();t.junctions.splice(1,0,{id:'jm',floorId:'f0',x:2000,y:0});t.walls=[{...t.walls[0]!,b:'jm'},{...t.walls[0]!,id:'w2',a:'jm'}];cache.get(t);t.walls.reverse();cache.get(t);expect(cache.builds).toBe(6);
 });
});
