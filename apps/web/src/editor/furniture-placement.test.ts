import {it,expect} from 'vitest';
import fc from 'fast-check';
import {ProjectStore,serializeProject,parseProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {beginPlacement,currentPlacement,placementCommand,placementDraft} from './furniture-placement';
const model=()=>new ProjectStore(structuredClone(sample) as ProjectDoc,'placement_test');
const asset={id:'a_demo_table',version:1,dims:{w:1200,d:600,h:750}};
it('SYNC-003 placement previews keep complete JSON/history unchanged; one Add pins native size and one Undo/Redo/reload is exact',()=>{
 const store=model(),before=serializeProject(store.getSnapshot().document),intent=beginPlacement(store,asset,[1234.4,2345.6]),draft=placementDraft(intent),command=placementCommand(store,intent,draft),preview=store.preview(command);
 expect(preview.ok).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);expect(store.getSnapshot().canUndo).toBe(false);expect(Object.isFrozen(intent.asset.dims)).toBe(true);expect(command.furniture).toMatchObject({assetId:'a_demo_table',assetVersion:1,position:{x:1234,y:2346},size:{w:1200,d:600,h:750}});expect(command.furniture.id.length).toBeLessThanOrEqual(40);
 expect(store.execute(command)).toMatchObject({ok:true,changed:true});expect(store.getSnapshot().localGeneration).toBe(1);expect(store.getSnapshot().document.furniture).toHaveLength(sample.furniture.length+1);const after=serializeProject(store.getSnapshot().document);expect(store.execute(command).ok).toBe(false);expect(serializeProject(store.getSnapshot().document)).toBe(after);
 const loaded=parseProject(after);expect(loaded.ok).toBe(true);if(loaded.ok)expect(serializeProject(loaded.document)).toBe(after);store.undo();expect(serializeProject(store.getSnapshot().document)).toBe(before);expect(store.getSnapshot().canUndo).toBe(false);store.redo();expect(serializeProject(store.getSnapshot().document)).toBe(after);
});
it('SYNC-003 measured1.5/37degree/raise uses immutable pinned native dimensions and exact integer values',()=>{
 const store=model(),source=structuredClone(asset),intent=beginPlacement(store,source,[0,0]);source.version=2;source.dims.w=8000;
 const command=placementCommand(store,intent,{x:'1.2 m',y:'150 cm',elevation:'300 mm',rotation:'37',scale:'1.5'});expect(command.furniture).toMatchObject({assetVersion:1,position:{x:1200,y:1500},elevation:300,rotationDeg:37,size:{w:1800,d:900,h:1125},materialOverrides:{}});expect(store.preview(command).ok).toBe(true);expect(store.getSnapshot().localGeneration).toBe(0);
});
it('invalid/far-panned drafts remain editable and never clamp or write, stale project/session/generation/hash ownership rejects',()=>{
 const store=model(),before=serializeProject(store.getSnapshot().document),intent=beginPlacement(store,asset,[2000000,-2000000]),draft=placementDraft(intent);expect(draft.x).toBe('2000000 mm');expect(()=>placementCommand(store,intent,draft)).toThrow();
 const valid={...draft,x:'0 mm',y:'0 mm'};expect(store.preview(placementCommand(store,intent,valid)).ok).toBe(true);
 for(const [key,value]of [['x','100001 mm'],['elevation','-1 mm'],['elevation','6001 mm'],['rotation','NaN'],['scale','0'],['scale','-1'],['scale','Infinity']]as const)expect(()=>placementCommand(store,intent,{...valid,[key]:value})).toThrow();
 expect(store.preview(placementCommand(store,intent,{...valid,scale:'.000001'})).ok).toBe(false);expect(serializeProject(store.getSnapshot().document)).toBe(before);expect(store.getSnapshot().canUndo).toBe(false);
 for(const tag of [{...intent.tag,projectId:'other'},{...intent.tag,sessionId:'other'},{...intent.tag,localGeneration:1},{...intent.tag,dependencyHash:'other'}]){const stale={...intent,tag};expect(currentPlacement(store,stale)).toBe(false);expect(()=>placementCommand(store,stale,valid)).toThrow('placement-stale');}
 store.execute({id:'rename',baseGeneration:0,type:'RenameProject',name:'New name'});expect(currentPlacement(store,intent)).toBe(false);expect(()=>placementCommand(store,intent,valid)).toThrow('placement-stale');
});
it('placement native3/2 dimensions satisfy independent arithmetic and unique IDs for generated integer sizes',()=>{
 fc.assert(fc.property(fc.integer({min:1,max:20000}),fc.integer({min:1,max:20000}),fc.integer({min:1,max:20000}),(w,d,h)=>{
  const store=model(),a={...asset,dims:{w,d,h}},intent=beginPlacement(store,a,[1000,2000]),command=placementCommand(store,intent,{...placementDraft(intent),scale:'1.5'});expect(command.furniture.size).toEqual({w:Math.floor((3*w+1)/2),d:Math.floor((3*d+1)/2),h:Math.floor((3*h+1)/2)});expect(beginPlacement(store,a,[1000,2000]).id).not.toBe(intent.id);expect(store.getSnapshot().canUndo).toBe(false);
 }),{seed:40301,numRuns:100});
});
