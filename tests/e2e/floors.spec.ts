import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-034 multiple floors in the real editor. Claude-authored (D52/D63 continuation); not an independent fixture.
// H.6 sample: outer 230 mm walls around 8000 x 5000, 115 mm partition w7 at x=4500, ground floor f0 at elevation 0 with 3000 mm walls.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
type Doc={floors:{id:string;name:string;level:number;elevation:number}[];walls:{id:string;floorId:string;thickness:number}[];rooms:{id:string;floorId:string}[];furniture:{floorId:string}[]};
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);return backup(page) as Promise<Doc>;}
async function frame(page:Page){const canvas=page.getByTestId('plan-canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!,v=await canvas.evaluate(e=>({x:Number((e as HTMLElement).dataset.viewX),y:Number((e as HTMLElement).dataset.viewY),scale:Number((e as HTMLElement).dataset.viewScale)}));return (x:number,y:number)=>({x:b.x+v.x+x*v.scale,y:b.y+v.y+y*v.scale});}
const floors=(page:Page)=>page.getByRole('group',{name:'Floors',exact:true});
async function pickAt(page:Page,x:number,y:number){const at=(await frame(page))(x,y);await page.mouse.click(at.x,at.y);return page.getByTestId('plan-canvas').getAttribute('data-picked-kind');}

test('FR-034 add a floor with the outer walls copied; each floor edits only its own walls; Undo removes the floor',async({page})=>{
 const original=await start(page);
 await floors(page).getByRole('button',{name:'+ Add floor',exact:true}).click();await saved(page);
 await expect(floors(page).getByRole('button',{name:'Floor 1',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('2 floors',{exact:true})).toBeVisible();
 const two=await backup(page) as Doc,upper=two.floors.find(f=>f.level===1)!;
 expect(upper).toMatchObject({name:'Floor 1',elevation:3000});
 expect(two.walls.filter(w=>w.floorId===upper.id).every(w=>w.thickness===230)).toBe(true); // outer walls only, never the 115 mm partition
 expect(two.rooms.filter(r=>r.floorId===upper.id)).toHaveLength(1);
 expect(two.walls.filter(w=>w.floorId==='f0')).toEqual(original.walls);
 // Upstairs there is no partition at x=4500: the same spot picks the room, not a wall.
 expect(await pickAt(page,4500,2500)).toBe('room');
 await floors(page).getByRole('button',{name:'Ground floor',exact:true}).click();
 expect(await pickAt(page,4500,2500)).toBe('wall');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);
 expect(await backup(page)).toEqual(original);await expect(floors(page).getByRole('button',{name:'Floor 1',exact:true})).toHaveCount(0);
});

test('FR-034 a wall drawn upstairs lands on the upper floor and leaves the ground floor untouched',async({page})=>{
 await start(page);await floors(page).getByRole('button',{name:'+ Add floor',exact:true}).click();await saved(page);
 const before=await backup(page) as Doc,upper=before.floors.find(f=>f.level===1)!.id;
 await page.keyboard.press('w');const at=await frame(page),a=at(2000,0),b=at(2000,5000);
 await page.mouse.click(a.x,a.y);await page.mouse.click(b.x,b.y);await page.keyboard.press('Escape');await saved(page);
 const after=await backup(page) as Doc;
 expect(after.walls.filter(w=>w.floorId==='f0')).toEqual(before.walls.filter(w=>w.floorId==='f0'));
 expect(after.rooms.filter(r=>r.floorId===upper)).toHaveLength(2); // the new wall split the upstairs room in two
 expect(after.rooms.filter(r=>r.floorId==='f0')).toEqual(before.rooms.filter(r=>r.floorId==='f0'));
});

test('FR-034 3D cuts away floors above the one being edited, can show them, and walks on the active floor',async({page})=>{
 await start(page);await floors(page).getByRole('button',{name:'+ Add floor',exact:true}).click();await saved(page);
 await floors(page).getByRole('button',{name:'Ground floor',exact:true}).click();
 await page.getByRole('button',{name:'3D view',exact:true}).click();const view=page.getByTestId('three-view');
 await expect(view).toHaveAttribute('data-clip-height','3000');
 await view.getByLabel('Show floors above',{exact:true}).check();await expect(view).toHaveAttribute('data-clip-height','');
 await view.getByLabel('Show floors above',{exact:true}).uncheck();await expect(view).toHaveAttribute('data-clip-height','3000');
 await floors(page).getByRole('button',{name:'Floor 1',exact:true}).click();await expect(view).toHaveAttribute('data-clip-height',''); // top floor: nothing above
 await view.getByTestId('walk-enter').click();await expect(view).toHaveAttribute('data-walk-active','true');
 expect(JSON.parse((await view.getAttribute('data-walk-pose'))!)).toMatchObject({eye:1600,floorElevation:3000}); // eye 1.6 m above the upper floor at 3000 mm
});

test('FR-034 deleting a floor needs confirmation, removes only that floor, and Undo brings it back',async({page})=>{
 await start(page);await floors(page).getByRole('button',{name:'+ Add floor',exact:true}).click();await saved(page);
 const two=await backup(page) as Doc;
 const settings=page.locator('.floor-settings');await settings.locator('summary').click();
 await settings.getByRole('button',{name:'Delete this floor',exact:true}).click();
 await expect(settings.getByRole('alert')).toContainText('Delete Floor 1');
 await settings.getByRole('button',{name:'Confirm delete floor',exact:true}).click();await saved(page);
 const one=await backup(page) as Doc;expect(one.floors.map(f=>f.id)).toEqual(['f0']);
 await expect(floors(page).getByRole('button',{name:'Ground floor',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(two);
 // The only remaining floor cannot be deleted.
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);await settings.locator('summary').click().catch(()=>{});
 await expect(page.locator('.floor-settings').getByRole('button',{name:'Delete this floor',exact:true})).toBeDisabled();
});
