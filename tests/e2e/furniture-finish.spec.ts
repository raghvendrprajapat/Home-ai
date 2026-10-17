import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-022 furniture colour variants in the real selection panel. Claude-authored (D52 continuation); not an independent fixture.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,'utf8'));}
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);const panel=page.getByRole('region',{name:'Selection and copies',exact:true});await panel.locator('summary').click();return panel;}
type Doc={furniture:{id:string;materialOverrides:Record<string,string>}[];materials:{id:string;baseColor:string}[]};
const overrides=(doc:Doc,id:string)=>doc.furniture.find(f=>f.id===id)!.materialOverrides;
const swatches=(page:Page)=>page.getByRole('group',{name:'Furniture colour',exact:true});
/** Reads the plan canvas pixel under a plan point from every Konva layer and returns the topmost opaque colour. */
async function planPixel(page:Page,x:number,y:number){
 const canvas=page.getByTestId('plan-canvas');await canvas.scrollIntoViewIfNeeded();
 return canvas.evaluate((el,[px,py])=>{const host=el as HTMLElement,view={x:Number(host.dataset.viewX),y:Number(host.dataset.viewY),scale:Number(host.dataset.viewScale)},box=host.getBoundingClientRect(),sx=box.left+view.x+px!*view.scale,sy=box.top+view.y+py!*view.scale;let found:number[]|null=null;
  for(const c of host.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(sx<r.left||sx>=r.right||sy<r.top||sy>=r.bottom)continue;const d=c.getContext('2d')!.getImageData(Math.floor((sx-r.left)*c.width/r.width),Math.floor((sy-r.top)*c.height/r.height),1,1).data;if(d[3]===255)found=[d[0]!,d[1]!,d[2]!];}
  return found;},[x,y]);
}

test('FR-022 a colour swatch gives the selected furniture a main finish shown in 2D; Original colours and Undo restore it',async({page})=>{
  const panel=await start(page),original=await backup(page) as Doc;
  await expect(swatches(page).getByRole('button',{name:'Colour: Finish - navy',exact:true})).toBeDisabled();
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).check();await panel.getByLabel('Select furniture fu_tv',{exact:true}).check();
  // Sofa centre (1300,4300) is plain furniture fill before any finish.
  expect(await planPixel(page,1300,4300)).toEqual([0xc8,0xaf,0x90]);
  await swatches(page).getByRole('button',{name:'Colour: Finish - navy',exact:true}).click();await saved(page);
  const navy=await backup(page) as Doc;
  expect(overrides(navy,'fu_sofa')).toEqual({main:'m_fin_navy'});expect(overrides(navy,'fu_tv')).toEqual({main:'m_fin_navy'});
  expect(navy.materials.filter(m=>m.id==='m_fin_navy')).toEqual([{id:'m_fin_navy',name:'Finish - navy',baseColor:'#2f3e5c',roughness:.8,metalness:0}]);
  expect(overrides(navy,'fu_bed')).toEqual(overrides(original,'fu_bed'));
  await expect(swatches(page).getByRole('button',{name:'Colour: Finish - navy',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>planPixel(page,1300,4300)).toEqual([0x2f,0x3e,0x5c]);
  await swatches(page).getByRole('button',{name:'Colour: Finish - navy',exact:true}).click(); // same colour again: no-op
  await expect(page.getByRole('status').filter({hasText:'Already this colour; nothing changed.'})).toHaveCount(1);
  await swatches(page).getByRole('button',{name:'Original colours',exact:true}).click();await saved(page);
  const plain=await backup(page) as Doc;expect(overrides(plain,'fu_sofa')).toEqual({});expect(overrides(plain,'fu_tv')).toEqual({});
  await expect.poll(()=>planPixel(page,1300,4300)).toEqual([0xc8,0xaf,0x90]);
  const undo=page.getByRole('button',{name:'Undo',exact:true});await undo.click();await undo.click();await saved(page);
  expect(await backup(page)).toEqual(original);await expect(undo).toBeDisabled();
});
test('FR-022 a selection that includes a wall cannot be coloured',async({page})=>{
  const panel=await start(page);
  await panel.getByLabel('Select furniture fu_sofa',{exact:true}).check();await expect(swatches(page).getByRole('button',{name:'Colour: Finish - teak',exact:true})).toBeEnabled();
  await panel.getByLabel(/^Select wall /).first().check();
  await expect(swatches(page).getByRole('button',{name:'Colour: Finish - teak',exact:true})).toBeDisabled();await expect(swatches(page).getByRole('button',{name:'Original colours',exact:true})).toBeDisabled();
});
test('FR-022 a finished catalog model still draws as the real 3D model (not the fallback box) with the same parts',async({page})=>{
  const panel=await start(page);
  await page.getByRole('button',{name:'Browse furniture',exact:true}).click();await page.getByRole('article',{name:'Original demo desk',exact:true}).getByRole('button',{name:'Place in drawing',exact:true}).click();
  const place=page.getByRole('region',{name:'Place furniture',exact:true});await place.getByLabel('Furniture X position',{exact:true}).fill('1200 mm');await place.getByLabel('Furniture Y position',{exact:true}).fill('1500 mm');await place.getByRole('button',{name:'Add furniture',exact:true}).click();await saved(page);
  const id=(await backup(page) as Doc).furniture.at(-1)!.id;
  await panel.getByLabel(`Select furniture ${id}`,{exact:true}).check();await swatches(page).getByRole('button',{name:'Colour: Finish - teak',exact:true}).click();await saved(page);
  expect(overrides(await backup(page) as Doc,id)).toEqual({main:'m_fin_teak'});
  await page.getByRole('button',{name:'3D view',exact:true}).click();const view=page.getByTestId('three-view');
  await expect(view.locator(`[data-model-id="${id}"]`)).toHaveAttribute('data-model-phase','ready');
  await expect.poll(async()=>JSON.parse((await view.getAttribute('data-model-scene'))!)).toEqual({meshes:6,instances:6,triangles:72,ids:[id]});
});
