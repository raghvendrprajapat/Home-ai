import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openTool,closeTool} from './helpers/tools';

// Codex-authored D82 regressions; no independent fixture or existing assertion is edited.
test.use({viewport:{width:1280,height:800}});
async function backup(page:Page){const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await event).path())!,'utf8'));}
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
const choices=[['m_wood_walnut','Wood - walnut','wood_walnut',.8],['m_tile_terracotta','Tile - terracotta 600x600','tile_terracotta_600',.5],['m_marble_charcoal','Marble - charcoal','marble_charcoal',1],['m_wallpaper_linen','Wallpaper - linen stripe','wallpaper_linen',1]] as const;

test('D82 four actual material maps apply at real scale, Undo exactly, persist and stay within Mid budgets',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);const before=await backup(page);
 await page.getByRole('button',{name:'3D view',exact:true}).click();await openTool(page,'Project');await page.getByLabel('3D quality',{exact:true}).selectOption('mid');const view=page.getByTestId('three-view');await expect(view).toHaveAttribute('data-environment',/^hdri:/);
 await closeTool(page);await expect.poll(()=>view.locator('[data-model-phase="loading"]').count()).toBe(0);
 const responses=new Set<string>();page.on('response',r=>{if(r.status()===200)responses.add(new URL(r.url()).pathname);});
 for(const [id,name,texture,repeat] of choices){
  await openTool(page,'Materials');const panel=page.getByRole('region',{name:'Surface colours',exact:true});await panel.getByLabel('Surface to paint',{exact:true}).selectOption(id==='m_wallpaper_linen'?'wall:w7':'floor:r_living');await panel.getByRole('button',{name:`Apply ${name}`,exact:true}).click();await saved(page);
  await expect.poll(async()=>{const live=JSON.parse((await view.getAttribute('data-surface-textures'))??'[]') as {id:string;texture:string;ready:boolean;repeat:number[]}[];return live.find(b=>b.id===id);}).toEqual({id,texture,ready:true,repeat:[repeat,repeat]});
  expect(responses.has(`/textures/${texture}/color.jpg`)).toBe(true);const after=await backup(page);if(id==='m_wallpaper_linen'){expect(after.walls.find((w:{id:string})=>w.id==='w7').leftMaterial).toBe(id);expect(after.rooms).toEqual(before.rooms);expect(after.walls.filter((w:{id:string})=>w.id!=='w7')).toEqual(before.walls.filter((w:{id:string})=>w.id!=='w7'));}else{expect(after.rooms.find((r:{id:string})=>r.id==='r_living').floorMaterial).toBe(id);expect(after.walls).toEqual(before.walls);}expect(after.furniture).toEqual(before.furniture);
  expect(Number(await view.getAttribute('data-texture-bytes'))).toBeLessThanOrEqual(64*1024**2);expect(Number(await view.getAttribute('data-draw-calls'))).toBeGreaterThan(0);expect(Number(await view.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(200);
  await closeTool(page);await view.screenshot({path:test.info().outputPath(`${texture}.png`)});
  if(id!=='m_wallpaper_linen'){await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();}
 }
 const edited=await backup(page);await page.reload();await page.getByRole('button',{name:'Restore saved changes',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(edited);
});

test('D82 texture failures keep the selected material usable; Low never requests or binds the new maps',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});});
 const requests:string[]=[];page.on('request',r=>{if(/\/textures\//.test(r.url()))requests.push(r.url());});await page.route('**/textures/**',route=>route.abort());
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);await openTool(page,'Materials');const panel=page.getByRole('region',{name:'Surface colours',exact:true});await panel.getByLabel('Surface to paint',{exact:true}).selectOption('floor:r_living');await panel.getByRole('button',{name:'Apply Wood - walnut',exact:true}).click();await saved(page);const edited=await backup(page);
 await page.getByRole('button',{name:'3D view',exact:true}).click();const view=page.getByTestId('three-view');await expect(view).toHaveAttribute('data-rendered-generation','1');await expect(view).toHaveAttribute('data-quality-tier','low');await expect(view).toHaveAttribute('data-surface-textures','[]');await expect(view).toHaveAttribute('data-texture-bytes','0');expect(requests).toEqual([]);
 await openTool(page,'Project');await page.getByLabel('3D quality',{exact:true}).selectOption('mid');await expect(view).toHaveAttribute('data-rendered-generation','1');await expect.poll(()=>requests.length).toBeGreaterThan(0);expect(await backup(page)).toEqual(edited);await expect(view).toHaveAttribute('data-textured-materials','0');
 await closeTool(page);await view.screenshot({path:test.info().outputPath('texture-fallback.png')});
});
