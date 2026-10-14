import {expect,it} from 'vitest';
import fc from 'fast-check';
import {createBlankProject,ProjectStore} from '@gharplan/core-model';
import {openingSymbol} from './opening-symbol';
it('GEO-014 original symbol has analytic centre/hinge/leaf and reverse keeps its world meaning',()=>{
 fc.assert(fc.property(fc.integer({min:600,max:5400}),fc.boolean(),fc.boolean(),fc.boolean(),(offset,vertical,flipX,flipY)=>{
  let n=0;const store=new ProjectStore(createBlankProject({name:'Codex symbol',units:'metric',now:'2026-10-14T00:00:00Z',nextId:()=>`symbol_${n++}`}), 'symbol_session');expect(store.execute({id:'wall',baseGeneration:0,type:'AddWall',from:[0,0],to:vertical?[0,6000]:[6000,0],thickness:200,height:3000}).ok).toBe(true);const wallId=store.getSnapshot().document.walls[0]!.id;expect(store.execute({id:'door',baseGeneration:1,type:'AddOpening',opening:{id:'symbol_door',wallId,kind:'door',assetId:'door_asset',offset,width:900,height:2100,sill:0,flipX,flipY}}).ok).toBe(true);const before=store.getSnapshot(),symbol=openingSymbol(before.document,before.document.openings[0]!),u=flipX?-1:1,v=flipY?-1:1;
  expect(symbol.centre).toEqual(vertical?[0,offset]:[offset,0]);expect(symbol.hinge).toEqual(vertical?[0,offset-u*450]:[offset-u*450,0]);expect(symbol.leaf[0]).toBeCloseTo(vertical?-u*v*900:offset-u*450,8);expect(symbol.leaf[1]).toBeCloseTo(vertical?offset-u*450:u*v*900,8);expect(symbol.arc).toHaveLength(17);
  expect(store.execute({id:'reverse',baseGeneration:2,type:'ReverseWall',wallId}).ok).toBe(true);const after=openingSymbol(store.getSnapshot().document,store.getSnapshot().document.openings[0]!);for(const key of ['centre','hinge','leaf'] as const)for(const axis of [0,1] as const)expect(after[key][axis]).toBeCloseTo(symbol[key][axis],8);for(let i=0;i<17;i++)for(const axis of [0,1] as const)expect(after.arc[i]![axis]).toBeCloseTo(symbol.arc[i]![axis],8);expect(store.undo()).toBe(true);expect(store.getSnapshot().document).toEqual(before.document);
 }),{seed:20261014,numRuns:100});
});
