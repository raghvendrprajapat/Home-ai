import {test,expect} from '@playwright/test';
import type {Page,CDPSession} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-008 wall-segment dragging, native pointer/touch. Claude-authored (D52 continuation); not an independent fixture.
// Geometry: H.6 sample. w7 is the vertical 115 mm partition at x=4500 (door at y 550..1450); w1 is the top wall y=0 (window x 1500..3000).
async function begin(page:Page){await page.goto('/');await page.getByRole('button',{name:'Get started',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');await page.getByTestId('plan-canvas').scrollIntoViewIfNeeded();}
async function backup(page:Page){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,'utf8'));}
async function frame(page:Page){const canvas=page.getByTestId('plan-canvas'),box=await canvas.boundingBox();expect(box).toBeTruthy();const view=await canvas.evaluate(el=>({x:Number((el as HTMLElement).dataset.viewX),y:Number((el as HTMLElement).dataset.viewY),scale:Number((el as HTMLElement).dataset.viewScale)}));return {box:box!,view};}
type Doc={junctions:{id:string;x:number;y:number}[];walls:{id:string;a:string;b:string;thickness:number;height:number}[]};
const at=(doc:Doc,id:string)=>doc.junctions.find(j=>j.id===id)!;
const screenOf=(f:Awaited<ReturnType<typeof frame>>,x:number,y:number)=>({x:f.box.x+f.view.x+x*f.view.scale,y:f.box.y+f.view.y+y*f.view.scale});
async function touch(cdp:CDPSession,type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel',points:{id:number;x:number;y:number}[]){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});}
async function select(page:Page,x:number,y:number,kind='wall',id?:string){
  const f=await frame(page),p=screenOf(f,x,y);await page.mouse.click(p.x,p.y);
  const canvas=page.getByTestId('plan-canvas');await expect(canvas).toHaveAttribute('data-picked-kind',kind);if(id)await expect(canvas).toHaveAttribute('data-picked-id',id);return f;
}
const undo=(page:Page)=>page.getByRole('button',{name:'Undo',exact:true});
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}

test('FR-008 a selected vertical wall drags +100mm with a live preview, one commit and one Undo; connected walls follow',async({page})=>{
  await begin(page);const original=await backup(page);
  const f=await select(page,4500,3000,'wall','w7');expect(await backup(page)).toEqual(original);
  const from=screenOf(f,4500,3000),to=screenOf(f,4600,3000);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});
  await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-preview-active','true');await expect(undo(page)).toBeDisabled(); // preview only: nothing committed yet
  await page.mouse.up();await saved(page);
  const changed=await backup(page) as Doc;
  expect([at(changed,'j2').x,at(changed,'j5').x]).toEqual([4600,4600]);expect([at(changed,'j2').y,at(changed,'j5').y]).toEqual([0,5000]);
  for(const id of ['j1','j3','j4','j6'])expect(at(changed,id)).toEqual(at(original as Doc,id));
  expect(changed.junctions.every(j=>Number.isInteger(j.x)&&Number.isInteger(j.y))).toBe(true);const topology=(doc:Doc)=>doc.walls.map(w=>({id:w.id,a:w.a,b:w.b,thickness:w.thickness,height:w.height}));expect(topology(changed)).toEqual(topology(original as Doc)); // same walls, ends and properties; only the commit's rev bump differs
  await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-preview-active','false');
  await undo(page).click();expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
});
test('FR-008 dragging the top wall moves its whole collinear chain, never leaving a diagonal wall',async({page})=>{
  await begin(page);const original=await backup(page);
  const f=await select(page,800,0,'wall','w1'),from=screenOf(f,800,0),to=screenOf(f,800,100);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});await page.mouse.up();await saved(page);
  const changed=await backup(page) as Doc;
  expect(['j1','j2','j3'].map(id=>at(changed,id).y)).toEqual([100,100,100]);expect(['j1','j2','j3'].map(id=>at(changed,id).x)).toEqual([0,4500,8000]);
  for(const id of ['j4','j5','j6'])expect(at(changed,id)).toEqual(at(original as Doc,id));
  await undo(page).click();expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
});
test('FR-008 pressing an unselected wall still pans the plan and never edits; Escape cancels a wall drag in progress',async({page})=>{
  await begin(page);const original=await backup(page);let f=await frame(page);
  const p=screenOf(f,4500,3000);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+30,p.y,{steps:3});await page.mouse.up();
  expect(Math.abs((await frame(page)).view.x-(f.view.x+30))).toBeLessThanOrEqual(0.01);expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
  f=await select(page,4500,3000,'wall','w7');const a=screenOf(f,4500,3000),b=screenOf(f,4600,3000);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();
  expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
});
test('FR-008 a wall dragged into a collision is rejected unchanged with no history entry',async({page})=>{
  await begin(page);const original=await backup(page);
  // x=8000 would give w2 (j2 to j3) zero length; the junction/guide snap lands exactly there.
  const f=await select(page,4500,3000,'wall','w7'),a=screenOf(f,4500,3000),b=screenOf(f,8000,3000);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
  await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-preview-active','false');
  expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
});
test('FR-008 touch: tap selects, hold then drag moves the wall once; early motion pans without editing',async({page})=>{
  await begin(page);const original=await backup(page),cdp=await page.context().newCDPSession(page);
  let f=await frame(page),a=screenOf(f,4500,3000);
  await touch(cdp,'touchStart',[{id:1,...a}]);await touch(cdp,'touchEnd',[]);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-picked-id','w7');expect(await backup(page)).toEqual(original);
  await touch(cdp,'touchStart',[{id:1,...a}]);await touch(cdp,'touchMove',[{id:1,x:a.x+30,y:a.y}]);await touch(cdp,'touchEnd',[]);expect(await backup(page)).toEqual(original);
  await page.getByRole('button',{name:'Fit floor plan',exact:true}).click();f=await frame(page);a=screenOf(f,4500,3000);
  await touch(cdp,'touchStart',[{id:1,...a}]);await expect(page.getByTestId('touch-loupe')).toBeVisible();
  await touch(cdp,'touchMove',[{id:1,x:a.x+100*f.view.scale,y:a.y}]);await expect(page.getByTestId('touch-loupe')).toContainText('4600, 3000');await touch(cdp,'touchEnd',[]);await saved(page);
  const changed=await backup(page) as Doc;expect([at(changed,'j2').x,at(changed,'j5').x]).toEqual([4600,4600]);
  await undo(page).click();expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
});
