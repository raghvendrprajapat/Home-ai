import {expect,it} from 'vitest';
import fc from 'fast-check';
import {createBlankProject,ProjectStore} from '@gharplan/core-model';
import {resolveSnap,snapGridStep} from './snapping';
function document(){let n=0;const store=new ProjectStore(createBlankProject({name:'Codex snapping',units:'metric',now:'2026-10-14T00:00:00Z',nextId:()=>`snap_test_${n++}`}), 'snapping');expect(store.execute({id:'add_wall',baseGeneration:0,type:'AddWall',from:[0,0],to:[4000,0],thickness:200,height:2700}).ok).toBe(true);return store.getSnapshot().document;}
const view={x:0,y:0,scale:.1};
it('GEO-009 junction before wall before alignment before grid with nearest/stable-ID ties',()=>{
 const doc=document();expect(resolveSnap(doc,[50,30],view).target?.kind).toBe('junction');expect(resolveSnap(doc,[2000,50],view).target?.kind).toBe('wall');
 expect(resolveSnap(doc,[50,1000],view).target?.kind).toBe('guide-x');expect(resolveSnap(doc,[2037,1037],view).target?.kind).toBe('grid');
 const tied={...doc,junctions:[{id:'aa',floorId:doc.floors[0]!.id,x:-10,y:0},{id:'bb',floorId:doc.floors[0]!.id,x:10,y:0}],walls:[]};expect(resolveSnap(tied,[0,0],view,{grid:false}).target?.key).toBe('junction:aa');
});
it('GEO-009 acquire/release hysteresis holds until1.5 threshold, then clears;250mm cap always holds',()=>{
 const doc=document(),first=resolveSnap(doc,[110,0],view,{grid:false});expect(first.target?.kind).toBe('junction');expect(resolveSnap(doc,[170,0],view,{grid:false,previous:first.target}).target?.kind).toBe('junction');expect(resolveSnap(doc,[190,0],view,{grid:false,previous:first.target}).target?.kind).not.toBe('junction');
 const low={...view,scale:.001};const held=resolveSnap(doc,[249,0],low,{grid:false});expect(held.target?.kind).toBe('junction');expect(resolveSnap(doc,[251,500],low,{grid:false,previous:held.target}).target?.kind).not.toBe('junction');
});
it('GEO-009 wall and guide retention slides freely along their unconstrained axis',()=>{
 const doc=document(),wall=resolveSnap(doc,[1500,70],view,{grid:false});expect(wall.target?.kind).toBe('wall');expect(resolveSnap(doc,[2200,110],view,{grid:false,previous:wall.target}).point).toEqual([2200,0]);
 const guide=resolveSnap(doc,[50,1000],view,{grid:false});expect(guide.target?.kind).toBe('guide-x');expect(resolveSnap(doc,[85,2000],view,{grid:false,previous:guide.target}).point).toEqual([0,2000]);
});
it('GEO-009 Shift/touch disable leaves raw quantized values while orthogonal lock is retained',()=>{
 const doc=document();expect(resolveSnap(doc,[2037.4,1037.6],view,{disabled:true}).point).toEqual([2037,1038]);expect(resolveSnap(doc,[2037.4,1037.6],view,{disabled:true,origin:[2000,0],orthogonal:true}).point).toEqual([2000,1038]);
 expect(()=>resolveSnap(doc,[NaN,0],view)).toThrow();expect(()=>resolveSnap(doc,[0,0],{...view,scale:0})).toThrow();expect(()=>snapGridStep(Infinity)).toThrow();
});
it('grid uses only specified integer steps; quantization/property results stay integer, orthogonal and world-capped',()=>{
 const doc=document();fc.assert(fc.property(fc.double({min:.001,max:1,noNaN:true}),fc.double({min:-8000,max:8000,noNaN:true}),fc.double({min:-8000,max:8000,noNaN:true}),(scale,x,y)=>{const result=resolveSnap(doc,[x,y],{...view,scale});expect([10,50,100,500,1000]).toContain(result.gridStep);expect(result.point.every(Number.isSafeInteger)).toBe(true);if(result.target)expect(Math.hypot(result.target.point[0]-x,result.target.point[1]-y)).toBeLessThanOrEqual(250);}),{seed:20261014,numRuns:1000});
 fc.assert(fc.property(fc.integer({min:500,max:3500}),fc.integer({min:-70,max:70}),(x,y)=>{const result=resolveSnap(doc,[x+2,y],view,{origin:[x,-1000],orthogonal:true});expect(result.point).toEqual([x,0]);expect(result.target?.kind).toBe('wall');}),{seed:20261014,numRuns:200});
});
