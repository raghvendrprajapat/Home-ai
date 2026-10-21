import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openTool,closeTool} from './helpers/tools';

// Codex-authored: real catalog placement into a fresh unfurnished living-room template, never a fixture mutation.
test.use({viewport:{width:1280,height:800}});
const catalog=JSON.parse(await readFile('apps/web/public/catalog/catalog.json','utf8')) as {assets:{id:string;version:number;name_en:string;dims:{w:number;d:number;h:number}}[]};
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await event).path())!,'utf8'));}
const groups=[
 ['seating',[['a_l0_cane_lounge_chair',900,1100],['a_l0_compact_recliner',3000,1200],['a_l0_storage_ottoman',2800,2800]]],
 ['tables-storage',[['a_l0_nesting_table',1100,1100],['a_l0_round_dining_table',2200,2300],['a_l0_compact_almirah',3800,700]]],
] as const;
for(const [name,items] of groups)test(`D83 ${name}: all new models place exact pins, render within budget and Undo/reload exactly`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Get started',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByLabel('Start from',{exact:true}).selectOption('living');await page.getByLabel('Project name',{exact:true}).fill(`Furniture ${name}`);await page.getByRole('button',{name:'Create drawing',exact:true}).click();await saved(page);const before=await backup(page);expect(before.furniture).toEqual([]);
 const ids:string[]=[];for(const [id,x,y] of items){
  const a=catalog.assets.find(a=>a.id===id&&a.version===1)!;expect(a).toBeDefined();await openTool(page,'Furniture');await page.getByRole('button',{name:'Browse furniture',exact:true}).click();const catalogDialog=page.getByRole('dialog',{name:'Furniture catalog',exact:true});await catalogDialog.getByLabel('Search furniture',{exact:true}).fill(a.name_en);await catalogDialog.getByRole('article',{name:a.name_en,exact:true}).getByRole('button',{name:'Place in drawing',exact:true}).click();
  const form=page.getByRole('region',{name:'Place furniture',exact:true});await form.getByLabel('Furniture X position',{exact:true}).fill(`${x} mm`);await form.getByLabel('Furniture Y position',{exact:true}).fill(`${y} mm`);if(id==='a_l0_compact_almirah')await form.getByLabel('Furniture rotation (degrees)',{exact:true}).fill('180');await form.getByRole('button',{name:'Add furniture',exact:true}).click();await saved(page);const piece=(await backup(page)).furniture.at(-1);expect(piece).toMatchObject({assetId:id,assetVersion:1,size:a.dims,position:{x,y},elevation:0,rotationDeg:id==='a_l0_compact_almirah'?180:0});ids.push(piece.id);
 }
 const after=await backup(page);await closeTool(page);await page.getByRole('button',{name:'3D view',exact:true}).click();await openTool(page,'Project');await page.getByLabel('3D quality',{exact:true}).selectOption('mid');await closeTool(page);const view=page.getByTestId('three-view');await expect(view).toHaveAttribute('data-rendered-generation','3');for(const id of ids)await expect(view.locator(`[data-model-id="${id}"]`)).toHaveAttribute('data-model-phase','ready');
 await expect.poll(async()=>JSON.parse((await view.getAttribute('data-model-scene'))!).ids.sort()).toEqual(ids.sort());expect(Number(await view.getAttribute('data-draw-calls'))).toBeGreaterThan(0);expect(Number(await view.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(200);await view.screenshot({path:test.info().outputPath(`${name}.png`)});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);expect((await backup(page)).furniture).toEqual(after.furniture.slice(0,-1));await page.getByRole('button',{name:'Redo',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(after);await page.reload();await page.getByRole('button',{name:'Restore saved changes',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(after);
});
