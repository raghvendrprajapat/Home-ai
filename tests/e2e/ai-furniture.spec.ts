import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// D73 AI furniture ideas with the offline stand-in. Expected lists are worked out by hand in
// apps/web/src/ai/furniture-suggest.test.ts for the sample plan's clear rooms (Living 4327×4770, Bedroom 3327×4770).
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
const panel=(page:Page)=>page.getByRole('region',{name:'AI furniture ideas',exact:true});

test('D73 stand-in suggests bedroom furniture that fits, and Place opens the normal form centred in the room',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 const before=await backup(page),ai=panel(page);
 await expect(ai.getByText('Test mode: offline rules stand in for the AI',{exact:false})).toBeVisible();
 await ai.getByLabel('Room for ideas',{exact:true}).selectOption({label:'Bedroom'});
 await ai.getByLabel('Furniture size',{exact:true}).selectOption('spacious');
 await ai.getByRole('button',{name:'Suggest furniture for this room',exact:true}).click();
 const ideas=ai.locator('ul.ai-ideas > li');
 await expect(ideas).toHaveCount(5);
 expect(await ideas.evaluateAll(items=>items.map(i=>i.getAttribute('data-asset-id')))).toEqual(['a_l0_king_bed','a_l0_wardrobe_sliding','a_l0_nightstand','a_l0_dressing_table','a_l0_study_desk']);
 await expect(ideas.first()).toContainText('1900 × 2150 mm');
 await expect(ideas.first()).toContainText('The biggest choice that still leaves 600 mm to walk.');
 // Suggesting changes nothing in the drawing.
 expect(await backup(page)).toEqual(before);

 await ideas.first().getByRole('button',{name:'Place in this room',exact:true}).click();
 const form=page.getByRole('region',{name:'Place furniture',exact:true});
 // Bedroom clear rectangle x 4557.5–7885, y 115–4885 → centre (6221.25, 2500), rounded to whole mm.
 await expect(form.getByLabel('Furniture X position',{exact:true})).toHaveValue('6221 mm');
 await expect(form.getByLabel('Furniture Y position',{exact:true})).toHaveValue('2500 mm');
 await form.getByRole('button',{name:'Add furniture',exact:true}).click();await saved(page);
 const after=await backup(page);
 expect(after.furniture.length).toBe(before.furniture.length+1);
 expect(after.furniture.at(-1)).toMatchObject({assetId:'a_l0_king_bed',assetVersion:2,size:{w:1900,d:2150,h:1100},position:{x:6221,y:2500}});

 // The living room gets its own list; the sample's older demo pieces are not catalog IDs, so they do not count.
 await ai.getByLabel('Room for ideas',{exact:true}).selectOption({label:'Living'});
 await expect(ideas).toHaveCount(0);
 await ai.getByRole('button',{name:'Suggest furniture for this room',exact:true}).click();
 await expect(ideas).toHaveCount(6);
 expect(await ideas.evaluateAll(items=>items.map(i=>i.getAttribute('data-asset-id')))).toEqual(['a_l0_sofa_l','a_l0_tv_unit','a_l0_coffee_table','a_l0_armchair','a_l0_side_table','a_l0_rug']);
});

test('D73 the AI panel works in Hindi',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Language',{exact:true}).selectOption('hi');await page.getByRole('button',{name:'ड्रॉइंग पर वापस',exact:true}).click();
 const ai=page.getByRole('region',{name:'AI फर्नीचर सुझाव',exact:true});
 await ai.getByRole('button',{name:'इस कमरे के लिए फर्नीचर सुझाएँ',exact:true}).click();
 await expect(ai.locator('ul.ai-ideas > li').first().getByRole('button',{name:'इस कमरे में रखें',exact:true})).toBeVisible();
});

test('D73 AI-2 arranges the bedroom ideas around the existing bed and wardrobe, adds them in one step, and one Undo removes them',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 const before=await backup(page),ai=panel(page);
 await ai.getByLabel('Room for ideas',{exact:true}).selectOption({label:'Bedroom'});
 await ai.getByLabel('Furniture size',{exact:true}).selectOption('spacious');
 await ai.getByRole('button',{name:'Suggest furniture for this room',exact:true}).click();
 await expect(ai.locator('ul.ai-ideas > li')).toHaveCount(5);
 await ai.getByRole('button',{name:'Arrange these in the room',exact:true}).click();
 const preview=ai.getByTestId('ai-layout');
 await expect(preview.getByRole('img',{name:'Suggested layout, seen from above',exact:true})).toBeVisible();
 const pieces=await preview.locator('g[data-asset-id]').evaluateAll(gs=>gs.map(g=>({id:g.getAttribute('data-asset-id')!,x:Number(g.getAttribute('data-x')),y:Number(g.getAttribute('data-y')),r:Number(g.getAttribute('data-rotation'))})));
 expect(pieces.length).toBeGreaterThan(0);
 // Hand-derived from the sample: bedroom clear floor, the partition door's 900 mm swing, the existing bed and wardrobe.
 const floor=[4557.5,115,7885,4885],keepClear=[[4557.5,550,5457.5,1450],[5550,200,7350,2200],[5350,4200,7150,4800]];
 const dims:Record<string,[number,number]>={a_l0_king_bed:[1900,2150],a_l0_wardrobe_sliding:[1800,650],a_l0_nightstand:[450,400],a_l0_dressing_table:[1000,450],a_l0_study_desk:[1200,600]};
 const boxes=pieces.map(p=>{const [w,d]=dims[p.id]!,[hx,hy]=p.r%180===0?[w/2,d/2]:[d/2,w/2];return [p.x-hx,p.y-hy,p.x+hx,p.y+hy];});
 const hit=(a:number[],b:number[])=>a[0]!<b[2]!&&b[0]!<a[2]!&&a[1]!<b[3]!&&b[1]!<a[3]!;
 for(const [i,b] of boxes.entries()){
  expect(b[0]).toBeGreaterThanOrEqual(floor[0]!);expect(b[1]).toBeGreaterThanOrEqual(floor[1]!);expect(b[2]).toBeLessThanOrEqual(floor[2]!);expect(b[3]).toBeLessThanOrEqual(floor[3]!);
  for(const zone of keepClear)expect(hit(b,zone)).toBe(false);
  for(const other of boxes.slice(i+1))expect(hit(b,other)).toBe(false);
 }
 await preview.screenshot({path:test.info().outputPath('ai-layout-preview.png')});
 // Previewing changes nothing.
 expect(await backup(page)).toEqual(before);
 await preview.getByRole('button',{name:`Add this layout (${pieces.length} items)`,exact:true}).click();await saved(page);
 await expect(ai.getByRole('status')).toHaveText(`Layout added: ${pieces.length} items. One Undo removes all of them.`);
 const after=await backup(page);
 expect(after.furniture.length).toBe(before.furniture.length+pieces.length);
 expect(after.furniture.slice(-pieces.length).map((f:{assetId:string;position:{x:number;y:number};rotationDeg:number})=>({id:f.assetId,x:f.position.x,y:f.position.y,r:f.rotationDeg}))).toEqual(pieces);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);
 expect(await backup(page)).toEqual(before);
});

test('D73 size choice: balanced by default, compact on request, and "Show another option" swaps within the floor budget',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 const before=await backup(page),ai=panel(page),ideas=ai.locator('ul.ai-ideas > li'),list=()=>ideas.evaluateAll(items=>items.map(i=>i.getAttribute('data-asset-id')));
 await expect(ai.getByLabel('Furniture size',{exact:true})).toHaveValue('balanced');
 await expect(ai.getByText('Tip: choose the room and a size, then ask.',{exact:false})).toBeVisible();
 await ai.getByLabel('Room for ideas',{exact:true}).selectOption({label:'Bedroom'});
 await ai.getByRole('button',{name:'Suggest furniture for this room',exact:true}).click();
 // Balanced: one size down, 45% budget (worked out in furniture-suggest.test.ts).
 await expect(ideas).toHaveCount(5);
 expect(await list()).toEqual(['a_l0_queen_bed','a_l0_wardrobe_3','a_l0_nightstand','a_l0_dressing_table','a_l0_study_desk']);
 await expect(ideas.first()).toContainText('1620 × 2150 mm');await expect(ideas.first()).toContainText('Fits with 600 mm walking space in front.');
 // The bed has other sizes; the bedside table has none.
 await expect(ideas.nth(2).getByRole('button',{name:'Show another option',exact:true})).toHaveCount(0);
 await ideas.first().getByRole('button',{name:'Show another option',exact:true}).click();
 await expect(ideas.first()).toHaveAttribute('data-asset-id','a_l0_double_bed');await expect(ideas.first()).toContainText('1460 × 2150 mm');
 await ideas.first().getByRole('button',{name:'Show another option',exact:true}).click();
 await expect(ideas.first()).toHaveAttribute('data-asset-id','a_l0_single_bed');
 expect(await backup(page)).toEqual(before);
 // Compact: two sizes down, and changing the size clears the old list.
 await ai.getByLabel('Furniture size',{exact:true}).selectOption('compact');
 await expect(ideas).toHaveCount(0);
 await ai.getByRole('button',{name:'Suggest furniture for this room',exact:true}).click();
 await expect(ideas).toHaveCount(5);
 expect(await list()).toEqual(['a_l0_double_bed','a_l0_wardrobe_2','a_l0_nightstand','a_l0_dressing_table','a_l0_study_desk']);
});
