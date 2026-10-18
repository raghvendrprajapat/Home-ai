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
