import {expect,it,vi} from 'vitest';
import fc from 'fast-check';
import {parseProject,ProjectStore,createBlankProject} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {planImageLayout,paintPlanImage} from './plan-image';
function setup(){const parsed=parseProject(JSON.stringify(sample));if(!parsed.ok)throw new Error('Invalid sample');return new ProjectStore(parsed.document,'image_test');}
it('UX-009 complete sample dimension list is canonical and stays unchanged by image layout/paint',()=>{
 const store=setup(),snapshot=store.getSnapshot(),layout=planImageLayout(snapshot,'en',2000);expect(layout.labels.map(l=>[l.id,l.text])).toEqual([['w1','4500 mm'],['w2','3500 mm'],['w3','5000 mm'],['w4','3500 mm'],['w5','4500 mm'],['w6','5000 mm'],['w7','5000 mm']]);
 const methods=['fillRect','fillText','beginPath','lineTo','moveTo','closePath','fill','stroke','save','restore','translate','rotate','strokeRect'] as const,ctx=Object.fromEntries(methods.map(key=>[key,vi.fn()])) as unknown as CanvasRenderingContext2D;paintPlanImage(ctx,snapshot,layout,'en');const text=vi.mocked(ctx.fillText).mock.calls.map(c=>c[0]);expect(text).toContain('20.64 m²');expect(text).toContain('15.87 m²');expect(text).toContain('GharPlan · Plan image');for(const label of layout.labels)expect(text).toContain(label.text);expect(vi.mocked(ctx.save).mock.calls.length).toBe(vi.mocked(ctx.restore).mock.calls.length);expect(store.getSnapshot()).toBe(snapshot);
});
it('whole-plan fit remains finite/uniform within safe margins at both output sizes and translations',()=>{
 fc.assert(fc.property(fc.integer({min:-20000,max:20000}),fc.integer({min:-20000,max:20000}),fc.constantFrom(1000 as const,2000 as const),(x,y,edge)=>{
  const store=setup(),snapshot=store.getSnapshot(),moved={...snapshot,document:{...snapshot.document,junctions:snapshot.document.junctions.map(j=>({...j,x:j.x+x,y:j.y+y})),furniture:snapshot.document.furniture.map(f=>({...f,position:{x:f.position.x+x,y:f.position.y+y}}))},derived:{...snapshot.derived,footprints:snapshot.derived.footprints.map(f=>({...f,rect:[f.rect[0]+x,f.rect[1]+y,f.rect[2]+x,f.rect[3]+y] as const}))}},layout=planImageLayout(moved,'en',edge);expect(layout.edge).toBe(edge);expect(layout.view.scale).toBeGreaterThan(0);for(const j of moved.document.junctions){const sx=j.x*layout.view.scale+layout.view.x,sy=j.y*layout.view.scale+layout.view.y;expect(sx).toBeGreaterThan(0);expect(sx).toBeLessThan(edge);expect(sy).toBeGreaterThan(0);expect(sy).toBeLessThan(edge);}expect(layout.labels.map(l=>l.text)).toEqual(planImageLayout(snapshot,'en',edge).labels.map(l=>l.text));
 }),{seed:20261014,numRuns:100});
});
it('empty plans reject instead of creating a blank success',()=>{
 let n=0;const store=new ProjectStore(createBlankProject({name:'Empty image',units:'metric',now:'2026-10-14T00:00:00Z',nextId:()=>`image_${n++}`}), 'image_blank');expect(()=>planImageLayout(store.getSnapshot(),'en',2000)).toThrow('image-budget');expect(store.getSnapshot().canUndo).toBe(false);
});
it('geometry export budgets admit200 walls and refuse201 without truncating the model',()=>{
 let n=0;const doc=createBlankProject({name:'Codex image boundary',units:'metric',now:'2026-10-14T00:00:00Z',nextId:()=>`budget_${n++}`});for(let i=0;i<201;i++){doc.junctions.push({id:`a_${i}`,floorId:doc.floors[0]!.id,x:-50000+i*500,y:0},{id:`b_${i}`,floorId:doc.floors[0]!.id,x:-50000+i*500,y:1000});doc.walls.push({id:`w_${i}`,floorId:doc.floors[0]!.id,a:`a_${i}`,b:`b_${i}`,thickness:50,height:2700,leftMaterial:doc.materials[0]!.id,rightMaterial:doc.materials[0]!.id,rev:0});}const tooLarge=new ProjectStore(doc,'budget_image'),before=tooLarge.getSnapshot();expect(()=>planImageLayout(before,'en',2000)).toThrow('image-budget');expect(tooLarge.getSnapshot()).toBe(before);doc.walls.pop();doc.junctions.splice(-2);const valid=new ProjectStore(doc,'budget_admitted');expect(planImageLayout(valid.getSnapshot(),'en',2000).labels).toHaveLength(200);
});
