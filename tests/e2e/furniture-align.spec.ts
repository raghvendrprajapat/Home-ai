import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-019 furniture alignment in the real selection panel. Claude-authored (D52 continuation); not an independent fixture.
// Sample footprints (centre; bounding box): sofa (1300,4300) x300..2300; tv (2250,400) x1350..3150; bed (6450,1200) x5550..7350; wardrobe (6250,4500) y4200..4800.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page,label='Export drawing'){const download=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,'utf8'));}
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);const panel=page.getByRole('region',{name:'Selection and copies',exact:true});await panel.locator('summary').click();return panel;}
type Doc={furniture:{id:string;position:{x:number;y:number}}[]};
const at=(doc:Doc,id:string)=>doc.furniture.find(f=>f.id===id)!.position;
const group=(page:Page)=>page.getByRole('group',{name:'Align selected furniture',exact:true});

test('FR-019 align buttons stay disabled until two furniture items are selected; left alignment is exact, one Undo restores it',async({page})=>{
  const panel=await start(page),original=await backup(page) as Doc;
  for(const name of ['Align left edges','Align right edges','Align top edges','Align bottom edges','Align centres left to right','Align centres top to bottom'])await expect(group(page).getByRole('button',{name,exact:true})).toBeDisabled();
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).check();await expect(group(page).getByRole('button',{name:'Align left edges',exact:true})).toBeDisabled();
  await panel.getByLabel('Select furniture fu_tv',{exact:true}).check();await panel.getByLabel('Select furniture fu_bed',{exact:true}).check();
  await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-selection-count','3');
  await group(page).getByRole('button',{name:'Align left edges',exact:true}).click();await saved(page);
  const aligned=await backup(page) as Doc;
  // Left-most edge is the sofa's (300): tv and bed centres become 300 + 900 = 1200; the sofa and wardrobe do not move; no y changes.
  expect(at(aligned,'fu_tv')).toEqual({x:1200,y:400});expect(at(aligned,'fu_bed')).toEqual({x:1200,y:1200});expect(at(aligned,'fu_sofa')).toEqual(at(original,'fu_sofa'));expect(at(aligned,'fu_wardrobe')).toEqual(at(original,'fu_wardrobe'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);
  expect(await backup(page)).toEqual(original);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});
test('FR-019 centre alignment uses the combined box; repeating an alignment is a no-op and adds no history',async({page})=>{
  const panel=await start(page);
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).check();await panel.getByLabel('Select furniture fu_wardrobe',{exact:true}).check();
  await group(page).getByRole('button',{name:'Align centres top to bottom',exact:true}).click();await saved(page);
  // sofa y 3850..4750 and wardrobe y 4200..4800 -> combined 3850..4800, centre 4325 for both.
  let doc=await backup(page) as Doc;expect(at(doc,'fu_sofa').y).toBe(4325);expect(at(doc,'fu_wardrobe').y).toBe(4325);expect(at(doc,'fu_sofa').x).toBe(1300);expect(at(doc,'fu_wardrobe').x).toBe(6250);
  await group(page).getByRole('button',{name:'Align centres top to bottom',exact:true}).click();
  doc=await backup(page) as Doc;expect(at(doc,'fu_sofa').y).toBe(4325);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled(); // the repeated click added no second history entry
});
test('FR-019 a selection that includes a wall cannot be aligned',async({page})=>{
  const panel=await start(page);
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).check();await panel.getByLabel('Select furniture fu_tv',{exact:true}).check();
  await panel.getByLabel(/^Select wall /).first().check();
  await expect(group(page).getByRole('button',{name:'Align left edges',exact:true})).toBeDisabled();
});
