import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-019 group back-to-wall snapping in the 2D plan. Claude-authored (D52 continuation); not an independent fixture.
// Same geometry as furniture-advisories.spec.ts: a 115 mm wall on y=0 (faces y = +/-57.5); the 1000 x 600 sofa at (2000,-500)
// snaps its back to the south face y = -57.5 at centre y = floor(-57.5 - 300) = -358. A second member sits at (3000,-1500).
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
type Doc={furniture:{id:string;position:{x:number;y:number}}[]};
const at=(doc:Doc,id:string)=>doc.furniture.find(f=>f.id===id)!.position;
async function start(page:Page){
 const d=JSON.parse(await readFile('docs/examples/sample-project.json','utf8'));d.id='prj_group_snap';d.junctions=[{id:'ja',floorId:'f0',x:0,y:0},{id:'jb',floorId:'f0',x:4000,y:0}];d.walls=[{...d.walls[0],a:'ja',b:'jb',thickness:115}];d.openings=[];d.rooms=[];
 d.furniture=[{...d.furniture[0],position:{x:2000,y:-500},elevation:0,rotationDeg:0,size:{w:1000,d:600,h:800},groupId:'group_1'}];d.furniture.push({...d.furniture[0],id:'fu_other',position:{x:3000,y:-1500}});
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByLabel('Choose project backup JSON',{exact:true}).setInputFiles({name:'group-snap.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await page.getByRole('button',{name:'Open backup with original IDs',exact:true}).click();await saved(page);return backup(page) as Promise<Doc>;
}
async function frame(page:Page){const canvas=page.getByTestId('plan-canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!,v=await canvas.evaluate(e=>({x:Number((e as HTMLElement).dataset.viewX),y:Number((e as HTMLElement).dataset.viewY),scale:Number((e as HTMLElement).dataset.viewScale)}));return {v,point:(x:number,y:number)=>({x:b.x+v.x+x*v.scale,y:b.y+v.y+y*v.scale})};}

test('FR-019 dragging a grouped item near a wall snaps its back flush and moves every member by the same delta; Shift skips the snap',async({page})=>{
 const before=await start(page),canvas=page.getByTestId('plan-canvas');let f=await frame(page);
 const a=f.point(2000,-500),near=f.point(2100,-358-6/f.v.scale);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(near.x,near.y,{steps:4});await expect(canvas).toHaveAttribute('data-wall-alignment','2:-57.5:-1');
 await page.mouse.up();await saved(page);
 // Snap: sofa (2000,-500) -> (2100,-358), delta (100, 142); the other member keeps its offset: (3000,-1500) -> (3100,-1358).
 const snapped=await backup(page) as Doc;expect(at(snapped,'fu_sofa')).toEqual({x:2100,y:-358});expect(at(snapped,'fu_other')).toEqual({x:3100,y:-1358});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(before);
 f=await frame(page);const b=f.point(2000,-500),near2=f.point(2000,-358-6/f.v.scale);
 await page.mouse.move(b.x,b.y);await page.mouse.down();await page.keyboard.down('Shift');await page.mouse.move(near2.x,near2.y,{steps:4});await expect(canvas).toHaveAttribute('data-wall-alignment','');
 await page.mouse.up();await page.keyboard.up('Shift');await saved(page);
 const free=await backup(page) as Doc;expect(at(free,'fu_sofa').y).not.toBe(-358);
 expect(at(free,'fu_other').x-at(free,'fu_sofa').x).toBe(1000);expect(at(free,'fu_other').y-at(free,'fu_sofa').y).toBe(-1000); // offset preserved
});
