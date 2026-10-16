import {it,expect} from 'vitest';
import fc from 'fast-check';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {buildWallSolids,WallSolidsCache} from '../render3d/solids';
import {FurnitureAdvisories} from './furniture-advisories';
import {beginFurnitureGesture} from './furniture-gesture';
function setup(){const d=structuredClone(sample) as ProjectDoc;d.junctions=[{id:'ja',floorId:'f0',x:0,y:0},{id:'jb',floorId:'f0',x:4000,y:0}];d.walls=[{...d.walls[0]!,a:'ja',b:'jb',thickness:115}];d.rooms=[];d.openings=[];d.furniture=[{...d.furniture[0]!,position:{x:2000,y:-500},rotationDeg:0,elevation:0,size:{w:1000,d:600,h:800}}];return new ProjectStore(d,'advisories');}
it('GEO-019 raw back candidate beats grid, keeps off-centre grab, integer away rounding and one atomic Undo/Redo',()=>{
 const store=setup(),service=new FurnitureAdvisories(),before=serializeProject(store.getSnapshot().document),f=store.getSnapshot().document.furniture[0]!,intent=beginFurnitureGesture(store,f.id,'move',[1800,-450]);
 const result=service.gesture(store.getSnapshot().document,intent,[1849.6,-360.4],false,100,.1,null);
 expect(result.snap?.position).toEqual({x:2050,y:-358});expect(result.command).toMatchObject({type:'UpdateFurniture',properties:{position:{x:2050,y:-358}}});expect(serializeProject(store.getSnapshot().document)).toBe(before);
 expect(store.execute(result.command)).toMatchObject({ok:true,changed:true});const after=serializeProject(store.getSnapshot().document);expect(store.undo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);expect(store.getSnapshot().canUndo).toBe(false);expect(store.redo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(after);
});
it('GEO-019 acquisition8px/release12px preserves the same key but never gives new candidates the larger radius',()=>{
 const store=setup(),service=new FurnitureAdvisories(),d=store.getSnapshot().document,id=d.furniture[0]!.id,intent=beginFurnitureGesture(store,id,'move',[2000,-500]);
 const acquired=service.gesture(d,intent,[2000,-420],false,100,.1,null);expect(acquired.snap?.position.y).toBe(-358);
 expect(service.gesture(d,intent,[2000,-458],false,100,.1,acquired.snap!.key).snap?.position.y).toBe(-358);
 expect(service.gesture(d,intent,[2000,-458],false,100,.1,null).snap).toBe(null);
 expect(service.gesture(d,intent,[2000,-479],false,100,.1,acquired.snap!.key).snap).toBe(null);
 expect(service.gesture(d,intent,[2000,-700],false,100,.001,null).snap).toBe(null);
 expect(service.gesture(d,intent,[2000,-500],false,100,.1,acquired.snap!.key).command).toMatchObject({properties:{}});
});
it('GEO-019 Shift/snapping-disabled movement quantizes only once and cannot acquire or retain a wall',()=>{
 const store=setup(),service=new FurnitureAdvisories(),d=store.getSnapshot().document,intent=beginFurnitureGesture(store,d.furniture[0]!.id,'move',[1800,-450]);
 fc.assert(fc.property(fc.integer({min:-2000,max:2000}),fc.integer({min:-2000,max:2000}),(x,y)=>{
  const px=x+.4,py=y+.6,result=service.gesture(d,intent,[px,py],true,100,.1,'2:-57.5:-1');expect(result.snap).toBe(null);expect(result.command).toMatchObject({properties:{position:{x:Math.round(2000+px-1800),y:Math.round(-500+py+450)}}});
 }),{seed:40322,numRuns:100});
});
it('GEO-018 a warning is advisory: overlapping commands remain valid and self preview clones do not collide',()=>{
 const store=setup(),service=new FurnitureAdvisories(),d=store.getSnapshot().document,id=d.furniture[0]!.id;
 const command={id:'intentional',baseGeneration:0,type:'UpdateFurniture' as const,furnitureId:id,properties:{position:{x:2000,y:0}}},preview=store.preview(command);expect(preview.ok).toBe(true);if(!preview.ok)return;
 expect(service.check(preview.document,preview.document.furniture[0]!)).toMatchObject({available:true,overlap:true,wallIds:['w1'],furnitureIds:[]});expect(store.execute(command)).toMatchObject({ok:true,changed:true});
});
it('failed advisory geometry never throws through checking, aligning or an ordinary move command',()=>{
 const store=setup(),service=new FurnitureAdvisories({get:()=>{throw Error('budget failure');}}),d=store.getSnapshot().document,f=d.furniture[0]!,intent=beginFurnitureGesture(store,f.id,'move',[2000,-500]);
 expect(service.check(d,f)).toEqual({available:false,overlap:false});expect(service.align(d,f)).toEqual({available:false,alignment:null});const move=service.gesture(d,intent,[2100,-410],false,100,.1,null);expect(move.available).toBe(false);expect(move.snap).toBe(null);expect(store.execute(move.command)).toMatchObject({ok:true,changed:true});
});

it('a structural failure is cached across100 furniture/paint previews and retries only when geometry changes',()=>{
 const store=setup(),d=structuredClone(store.getSnapshot().document) as ProjectDoc,cache=new WallSolidsCache(doc=>{if(doc.walls[0]!.height===3000)throw Error('guarded work budget');return buildWallSolids(doc);}),service=new FurnitureAdvisories(cache);
 for(let i=0;i<100;i++){d.furniture[0]!.position.x=1000+i;d.materials[0]!.baseColor=i%2?'#000000':'#ffffff';expect(service.check(d,d.furniture[0]!)).toEqual({available:false,overlap:false});expect(service.align(d,d.furniture[0]!).available).toBe(false);}
 expect(cache.builds).toBe(1);d.walls[0]!.height=2500;expect(service.check(d,d.furniture[0]!).available).toBe(true);expect(cache.builds).toBe(2);
});
