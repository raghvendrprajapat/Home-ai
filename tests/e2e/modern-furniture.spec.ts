import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// D72 modern original living-room designs placed through the real catalog dialog and drawn by the real 3D view.
const manifest=JSON.parse(await readFile('apps/web/public/catalog/catalog.json','utf8')) as {assets:{id:string;version:number;name_en:string;dims:{w:number;d:number;h:number};lods:{triangles:number}[]}[]};
const dialog=(page:Page)=>page.getByRole('dialog',{name:'Furniture catalog',exact:true});
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}

test('D72 L-shape sofa, TV unit, coffee table and accent armchair place their newest versions and load as real 3D models',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 const chosen:[string,number,number,number,number][]=[['a_l0_sofa_l',1,2250,3850,0],['a_l0_tv_unit',1,2250,450,180],['a_l0_coffee_table',2,2250,2500,0],['a_l0_armchair',2,700,2300,90]],placed:{id:string}[]=[];
 for(const [id,version,x,y,rotation] of chosen){
  const asset=manifest.assets.find(a=>a.id===id&&a.version===version)!;expect(asset).toBeDefined();
  // Exactly this version is the newest one published for the ID.
  expect(Math.max(...manifest.assets.filter(a=>a.id===id).map(a=>a.version))).toBe(version);
  await page.getByRole('button',{name:'Browse furniture',exact:true}).click();await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel('Search furniture',{exact:true}).fill(asset.name_en);
  await dialog(page).getByRole('article',{name:asset.name_en,exact:true}).getByRole('button',{name:'Place in drawing',exact:true}).click();
  const form=page.getByRole('region',{name:'Place furniture',exact:true});
  await form.getByLabel('Furniture X position',{exact:true}).fill(`${x} mm`);await form.getByLabel('Furniture Y position',{exact:true}).fill(`${y} mm`);await form.getByLabel('Furniture rotation (degrees)',{exact:true}).fill(String(rotation));
  await form.getByRole('button',{name:'Add furniture',exact:true}).click();await saved(page);
  const item=(await backup(page)).furniture.at(-1);
  expect(item).toMatchObject({assetId:id,assetVersion:version,size:asset.dims,position:{x,y},rotationDeg:rotation});placed.push(item);
 }
 await page.getByRole('button',{name:'3D view',exact:true}).click();const view=page.getByTestId('three-view');
 for(const item of placed)await expect(page.locator(`[data-model-id="${item.id}"]`)).toHaveAttribute('data-model-phase','ready');
 const triangles=chosen.reduce((n,[id,version])=>n+manifest.assets.find(a=>a.id===id&&a.version===version)!.lods[0]!.triangles,0);
 await expect.poll(async()=>JSON.parse((await view.getAttribute('data-model-scene'))!).triangles).toBe(triangles);
 await view.screenshot({path:test.info().outputPath('modern-living-room-3d.png')});
});
