import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openTool,closeTool} from './helpers/tools';

// Codex-authored integration evidence. The independent acceptance suite stays untouched.
test.use({viewport:{width:1280,height:800}});
async function backup(page:Page){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return readFile((await(await download).path())!,'utf8');}
async function start(page:Page,tier:'low'|'mid'){
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');
 await page.getByRole('button',{name:'3D view',exact:true}).click();await openTool(page,'Project');await page.getByLabel('3D quality',{exact:true}).selectOption(tier);
 const view=page.getByTestId('three-view');await expect(view).toHaveAttribute('data-rendered-generation','0');await expect(view).toHaveAttribute('data-quality-tier',tier);
 if(tier==='mid')await expect(view).toHaveAttribute('data-environment',/^hdri:/);
 await expect.poll(()=>view.locator('[data-model-phase="loading"]').count()).toBe(0);
 return view;
}
async function meanLuma(page:Page,png:Buffer){return page.evaluate(async base64=>{
 const image=await createImageBitmap(await(await fetch(`data:image/png;base64,${base64}`)).blob()),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d')!;context.drawImage(image,0,0);image.close();const p=context.getImageData(0,0,canvas.width,canvas.height).data;
 let total=0;for(let i=0;i<p.length;i+=4)total+=.2126*p[i]!+.7152*p[i+1]!+.0722*p[i+2]!;return total/(p.length/4);
 },png.toString('base64'));}

test('D81 mid: actual night lamps brighten pixels without canvas/model/camera/history changes; <=200 draws',async({page})=>{
 const view=await start(page,'mid'),before=await backup(page);await page.getByLabel('Lighting preset',{exact:true}).selectOption('night');await closeTool(page);
 await expect(view).toHaveAttribute('data-lighting','night');await expect(view).toHaveAttribute('data-point-lights','2');
 const canvas=view.locator('canvas'),handle=await canvas.elementHandle();expect(handle).not.toBeNull();
 const sources=JSON.parse((await view.getAttribute('data-lamp-sources'))!);expect(sources).toEqual([
  {id:'furniture:fu_floor_lamp',position:[3.35,1.46,2.25],intensity:35,distance:3.5,castsShadow:false},
  {id:'furniture:fu_table_lamp',position:[5.295,.88,.34],intensity:20,distance:3.5,castsShadow:false},
 ]);
 const lit=await canvas.screenshot();await view.getByLabel('Night lights',{exact:true}).uncheck();await expect(view).toHaveAttribute('data-point-lights','0');
 const dark=await canvas.screenshot(),on=await meanLuma(page,lit),off=await meanLuma(page,dark);expect(on-off).toBeGreaterThan(1);
 const pose=await view.getAttribute('data-camera-pose'),memory=await view.getAttribute('data-gpu-memory');
 for(let i=0;i<5;i++){await view.getByLabel('Night lights',{exact:true}).check();await expect(view).toHaveAttribute('data-point-lights','2');await view.getByLabel('Night lights',{exact:true}).uncheck();await expect(view).toHaveAttribute('data-point-lights','0');}
 await view.getByLabel('Night lights',{exact:true}).check();await expect(view).toHaveAttribute('data-point-lights','2');
 expect(await canvas.evaluate((el,old)=>el===old,handle)).toBe(true);expect(await view.getAttribute('data-camera-pose')).toBe(pose);expect(await view.getAttribute('data-gpu-memory')).toBe(memory);
 expect(Number(await view.getAttribute('data-draw-calls'))).toBeGreaterThan(0);expect(Number(await view.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(200);
 await openTool(page,'Project');expect(await backup(page)).toBe(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await test.info().attach('night-lit.png',{body:lit,contentType:'image/png'});await test.info().attach('night-lights-off.png',{body:dark,contentType:'image/png'});
 await test.info().attach('night-pixel-evidence.json',{body:JSON.stringify({on,off,difference:on-off,sources,drawCalls:await view.getAttribute('data-draw-calls')}),contentType:'application/json'});
});

test('D81 presets preserve the actual Walk camera and live renderer; Low never gains point lights/textures/shadows',async({page})=>{
 const view=await start(page,'low'),before=await backup(page);await closeTool(page);await page.getByTestId('walk-enter').click();await expect(view).toHaveAttribute('data-walk-active','true');
 const camera=await view.getAttribute('data-walk-pose'),canvas=view.locator('canvas'),handle=await canvas.elementHandle();
 await openTool(page,'Project');for(const mode of ['night','warm','day','night']){
  await page.getByLabel('Lighting preset',{exact:true}).selectOption(mode);await expect(view).toHaveAttribute('data-lighting',mode);
  await expect(view).toHaveAttribute('data-walk-active','true');expect(await view.getAttribute('data-walk-pose')).toBe(camera);
  await expect(view).toHaveAttribute('data-point-lights','0');await expect(view).toHaveAttribute('data-shadows','off');await expect(view).toHaveAttribute('data-environment','none');await expect(view).toHaveAttribute('data-texture-bytes','0');
 }
 expect(await canvas.evaluate((el,old)=>el===old,handle)).toBe(true);expect(await backup(page)).toBe(before);await closeTool(page);await page.getByTestId('walk-exit').click();await expect(view).toHaveAttribute('data-walk-active','false');
});

test('D81 a real furniture edit/Undo moves the lamp source with its floor/elevation, with no additional history',async({page})=>{
 const view=await start(page,'mid'),before=await backup(page);await page.getByLabel('Lighting preset',{exact:true}).selectOption('night');await closeTool(page);await view.getByLabel('Low walls',{exact:true}).uncheck();
 await openTool(page,'Furniture');await page.getByLabel('Choose furniture',{exact:true}).selectOption('fu_table_lamp');
 const form=page.getByRole('region',{name:'Furniture adjustments',exact:true});
 await form.getByLabel('Furniture X position',{exact:true}).fill('5400 mm');await form.getByLabel('Furniture elevation',{exact:true}).fill('650 mm');
 await form.getByRole('button',{name:'Apply furniture changes',exact:true}).click();await expect(view).toHaveAttribute('data-rendered-generation','1');
 const position=async()=>JSON.parse((await view.getAttribute('data-lamp-sources'))!).find((s:{id:string})=>s.id==='furniture:fu_table_lamp').position;
 expect(await position()).toEqual([5.4,1.01,.34]);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(view).toHaveAttribute('data-rendered-generation','2');expect(await position()).toEqual([5.295,.88,.34]);
 await openTool(page,'Project');expect(await backup(page)).toBe(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});
