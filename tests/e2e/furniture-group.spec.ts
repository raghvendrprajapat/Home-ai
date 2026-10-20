import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-019 furniture grouping in the real editor. Claude-authored (D52 continuation); not an independent fixture.
// Sample: sofa centre (1300,4300), tv centre (2250,400); bed and wardrobe are not grouped.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,'utf8'));}
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);const panel=page.getByRole('region',{name:'Selection and copies',exact:true});await panel.locator('summary').click();return panel;}
async function frame(page:Page){const canvas=page.getByTestId('plan-canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();expect(box).toBeTruthy();const view=await canvas.evaluate(el=>({x:Number((el as HTMLElement).dataset.viewX),y:Number((el as HTMLElement).dataset.viewY),scale:Number((el as HTMLElement).dataset.viewScale)}));return {box:box!,view};}
const screenOf=(f:Awaited<ReturnType<typeof frame>>,x:number,y:number)=>({x:f.box.x+f.view.x+x*f.view.scale,y:f.box.y+f.view.y+y*f.view.scale});
type Doc={furniture:{id:string;position:{x:number;y:number};rotationDeg:number;groupId?:string}[]};
const item=(doc:Doc,id:string)=>doc.furniture.find(f=>f.id===id)!;
const tools=(page:Page)=>page.getByRole('group',{name:'Group furniture',exact:true});
const undo=(page:Page)=>page.getByRole('button',{name:'Undo',exact:true});
async function groupSofaAndTv(page:Page){
  const panel=await start(page),original=await backup(page) as Doc;
  await expect(tools(page).getByRole('button',{name:'Group selected furniture',exact:true})).toBeDisabled();
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).check();await expect(tools(page).getByRole('button',{name:'Group selected furniture',exact:true})).toBeDisabled();
  await panel.getByLabel('Select furniture fu_tv',{exact:true}).check();
  await tools(page).getByRole('button',{name:'Group selected furniture',exact:true}).click();await saved(page);
  await expect(tools(page).getByRole('status')).toHaveText('These 2 items are one group.');
  await expect(tools(page).getByRole('button',{name:'Group selected furniture',exact:true})).toBeDisabled(); // already exactly one group
  return {panel,original};
}

test('FR-019 grouping writes one shared group id, a tap picks the whole group, one Undo removes it',async({page})=>{
  const {original}=await groupSofaAndTv(page),grouped=await backup(page) as Doc;
  expect(item(grouped,'fu_sofa').groupId).toBe('group_1');expect(item(grouped,'fu_tv').groupId).toBe('group_1');
  expect(item(grouped,'fu_bed').groupId).toBeUndefined();expect(item(grouped,'fu_sofa').position).toEqual(item(original,'fu_sofa').position);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','0');
  const f=await frame(page),sofa=screenOf(f,1300,4300);await page.mouse.click(sofa.x,sofa.y);
  await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','2');await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-picked-id','fu_sofa');
  const bed=screenOf(f,6450,1200);await page.mouse.click(bed.x,bed.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','1'); // ungrouped items stay single
  await undo(page).click();await saved(page);expect(await backup(page)).toEqual(original);await expect(undo(page)).toBeDisabled();
});

test('FR-019 dragging one member moves the whole group by the same integer delta, with one Undo',async({page})=>{
  await groupSofaAndTv(page);const before=await backup(page) as Doc;
  const f=await frame(page),from=screenOf(f,1300,4300),to=screenOf(f,1800,4100);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});
  await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-preview-active','true');
  await page.mouse.up();await saved(page);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-preview-active','false');
  const after=await backup(page) as Doc,delta=(id:string)=>[item(after,id).position.x-item(before,id).position.x,item(after,id).position.y-item(before,id).position.y];
  const [dx,dy]=delta('fu_sofa');
  expect(delta('fu_tv')).toEqual([dx,dy]);expect(Number.isInteger(dx)&&Number.isInteger(dy)).toBe(true);
  // Pointer +500/-200 mm; the touched sofa lands on the zoom's snap grid, so allow one grid step of screen rounding.
  expect(Math.abs(dx!-500)).toBeLessThanOrEqual(100);expect(Math.abs(dy!+200)).toBeLessThanOrEqual(100);
  expect(item(after,'fu_bed')).toEqual(item(before,'fu_bed'));expect(item(after,'fu_wardrobe')).toEqual(item(before,'fu_wardrobe'));
  await undo(page).click();await saved(page);expect((await backup(page) as Doc).furniture.map(f=>f.position)).toEqual(before.furniture.map(f=>f.position));
});

test('FR-019 arrow keys nudge a selected group together; Ungroup makes items single again and 3D shows the whole-group note only while grouped',async({page})=>{
  await groupSofaAndTv(page);const before=await backup(page) as Doc;
  const f=await frame(page),sofa=screenOf(f,1300,4300);await page.mouse.click(sofa.x,sofa.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','2');
  await page.keyboard.press('ArrowRight');await saved(page);await page.keyboard.press('Shift+ArrowDown');await saved(page);
  const moved=await backup(page) as Doc;
  expect(item(moved,'fu_sofa').position).toEqual({x:item(before,'fu_sofa').position.x+10,y:item(before,'fu_sofa').position.y+100});
  expect(item(moved,'fu_tv').position).toEqual({x:item(before,'fu_tv').position.x+10,y:item(before,'fu_tv').position.y+100});
  await page.getByRole('button',{name:'3D view',exact:true}).click();
  await expect(page.getByTestId('group-3d-together')).toBeVisible();await expect(page.getByRole('button',{name:'Move selected furniture',exact:true})).toBeEnabled(); // D60: 3D Move acts on the whole group
  await page.getByRole('button',{name:'2D plan',exact:true}).click(); // grouping tools live with the 2D selection panel
  await tools(page).getByRole('button',{name:'Ungroup',exact:true}).click();await saved(page);
  const single=await backup(page) as Doc;expect(single.furniture.every(f=>f.groupId===undefined)).toBe(true);
  await page.getByRole('button',{name:'3D view',exact:true}).click();
  await expect(page.getByTestId('group-3d-together')).toHaveCount(0);await expect(page.getByRole('button',{name:'Move selected furniture',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'2D plan',exact:true}).click();
  const g=await frame(page),tv=screenOf(g,2250,400);await page.mouse.click(tv.x,tv.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','1');
});

test('FR-019 deleting one of two members leaves a single item that picks and moves on its own',async({page})=>{
  const {panel}=await groupSofaAndTv(page);
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).uncheck();await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','1');
  await page.getByRole('button',{name:'Preview deleting selection',exact:true}).click();await page.getByRole('button',{name:'Confirm deleting selection and listed openings',exact:true}).click();await saved(page);
  const doc=await backup(page) as Doc;expect(doc.furniture.some(f=>f.id==='fu_tv')).toBe(false);expect(item(doc,'fu_sofa').groupId).toBe('group_1'); // stored id kept; a lone member acts as single
  const f=await frame(page),sofa=screenOf(f,1300,4300);await page.mouse.click(sofa.x,sofa.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','1');
  await page.getByRole('button',{name:'3D view',exact:true}).click();
  await expect(page.getByTestId('group-3d-together')).toHaveCount(0);await expect(page.getByRole('button',{name:'Move selected furniture',exact:true})).toBeEnabled();
});

test('FR-019 a group turns 90 degrees about its shared centre with exact hand values; Q turns it 15 degrees; Undo restores',async({page})=>{
  const {panel,original}=await groupSofaAndTv(page),right=tools(page).getByRole('button',{name:'Turn selection 90° right',exact:true});
  await expect(right).toBeEnabled();await right.click();await saved(page);
  // Combined box x 300..3150, y 200..4750 -> pivot (1725, 2475); +90 maps offset (dx,dy) to (-dy,dx).
  const turned=await backup(page) as Doc,rot=(id:string)=>item(turned,id).rotationDeg;
  expect(item(turned,'fu_sofa').position).toEqual({x:-100,y:2050});expect(rot('fu_sofa')).toBe(270);
  expect(item(turned,'fu_tv').position).toEqual({x:3800,y:3000});expect(rot('fu_tv')).toBe(90);
  const f=await frame(page),tv=screenOf(f,3800,3000);await page.mouse.click(tv.x,tv.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','2');
  await page.keyboard.press('q');await saved(page);
  const q=await backup(page) as Doc;expect(item(q,'fu_sofa').rotationDeg).toBe(255);expect(item(q,'fu_tv').rotationDeg).toBe(75);
  await undo(page).click();await undo(page).click();await saved(page);
  const back=await backup(page) as Doc;expect(back.furniture.map(i=>i.position)).toEqual(original.furniture.map(i=>i.position));
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).uncheck();await expect(right).toBeDisabled(); // one item: use the single-item rotate tools
});

test('FR-019 a selected group shows the overlap warning live and after commit when a member touches outside furniture; Undo clears it',async({page})=>{
  await groupSofaAndTv(page);const canvas=page.getByTestId('plan-canvas');
  const f=await frame(page),sofa=screenOf(f,1300,4300);await page.mouse.click(sofa.x,sofa.y);await expect(canvas).toHaveAttribute('data-selection-count','2');
  await expect(canvas).toHaveAttribute('data-furniture-overlap','false');await expect(page.locator('.canvas-furniture-advisory').getByTestId('furniture-warning')).toHaveAttribute('data-overlap','false');
  // Drag the sofa +4950 mm east: x 5250..7250 at y 3850..4750 overlaps the wardrobe (x 5350..7150, y 4200..4800), which is outside the group.
  const to=screenOf(f,6250,4300);await page.mouse.move(sofa.x,sofa.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:6});
  await expect(canvas).toHaveAttribute('data-furniture-overlap','true'); // live during the preview
  await page.mouse.up();await saved(page);
  await expect(canvas).toHaveAttribute('data-furniture-overlap','true');await expect(page.locator('.canvas-furniture-advisory').getByTestId('furniture-warning')).toHaveAttribute('data-overlap','true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);await expect(canvas).toHaveAttribute('data-furniture-overlap','false');
});

// D76 M1 (setup only, no assertion changed): these tests were written for the plain fixture, "auto" quality resolving
// to low on a budget phone, and full-height walls in 3D. M1 made the furnished sample, mid on capable devices and
// low walls the defaults, so this file starts like a budget phone with the fixture and full walls.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});
