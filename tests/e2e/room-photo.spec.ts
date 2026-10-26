import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openTool} from './helpers/tools';

// D85 Room photo visualizer, Phase 1 (offline). Claude-authored builder test, not an independent fixture.
// The photo is an original PNG drawn in the test: grey 128 with a darker band, so expected colours are exact
// (uniform light → shading 1 → the paint colour itself).
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
const W=600,H=400,MINT=[207,227,211];// Paint - mint green, #cfe3d3
async function roomPng(page:Page):Promise<Buffer>{
 const url=await page.evaluate(({w,h})=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;g.fillStyle='rgb(128,128,128)';g.fillRect(0,0,w,h);g.fillStyle='rgb(60,70,80)';g.fillRect(0,h*.8,w,h*.2);return c.toDataURL('image/png');},{w:W,h:H});
 return Buffer.from(url.split(',')[1]!,'base64');
}
/** RGBA of working-size pixel (x, y) on a canvas found by test id or accessible name. */
const pixel=(page:Page,selector:string,x:number,y:number)=>page.locator(selector).evaluate((c,[px,py])=>Array.from((c as HTMLCanvasElement).getContext('2d')!.getImageData(px!,py!,1,1).data),[x,y]);
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});

for(const [label,viewport] of [['desktop 1280x800',{width:1280,height:800}],['phone 360x800',{width:360,height:800}]] as const){
 test(`D85 Room photo (${label}): paint a brushed area, only the area changes, compare slider moves, closing leaves the drawing unchanged`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
  const before=await backup(page),png=await roomPng(page);
  await openTool(page,'Room photo');
  const panel=page.getByRole('region',{name:'Room photo',exact:true});
  await expect(panel.getByText('Preview only — colours and sizes from one photo are approximate. Check a real sample before buying.',{exact:true})).toBeVisible();
  // From here on, nothing may leave the device: only same-origin GETs (the lazily loaded visualizer code) are allowed.
  const requests:string[]=[];page.on('request',r=>requests.push(`${r.method()} ${r.url()}`));
  const chooser=page.waitForEvent('filechooser');await panel.getByRole('button',{name:'Choose room photo',exact:true}).click();
  await (await chooser).setFiles({name:'room.png',mimeType:'image/png',buffer:png});
  const view=page.getByRole('dialog',{name:'Room photo'});await expect(view).toBeVisible();
  const mask=view.getByTestId('viz-mask');await expect(mask).toBeVisible();
  expect(await mask.evaluate(c=>[(c as HTMLCanvasElement).width,(c as HTMLCanvasElement).height])).toEqual([W,H]);
  expect(await pixel(page,'[data-testid=viz-photo]',300,200)).toEqual([128,128,128,255]);
  await expect(view.getByText('Preview only — colours and sizes from one photo are approximate. Check a real sample before buying.',{exact:true})).toBeVisible();
  // Brush a horizontal stroke through the middle, from 20 % to 60 % of the width.
  await view.getByLabel('Brush size',{exact:true}).fill('20');
  const box=(await mask.boundingBox())!,y=box.y+box.height*.5;
  await page.mouse.move(box.x+box.width*.2,y);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,y,{steps:10});await page.mouse.up();
  // The overlay shows the chosen area: half-alpha blue on the stroke, nothing in a far corner.
  expect((await pixel(page,'[data-testid=viz-mask]',240,200))[3]).toBeGreaterThan(100);
  expect(await pixel(page,'[data-testid=viz-mask]',560,30)).toEqual([0,0,0,0]);
  await expect(view.getByRole('button',{name:'Undo area change',exact:true})).toBeEnabled();
  await view.getByRole('button',{name:'Paint - mint green',exact:true}).click();
  await view.getByRole('button',{name:'Show result',exact:true}).click();
  const result=view.getByTestId('viz-result');await expect(result).toBeAttached();
  // Inside the stroke: exactly the paint colour (uniform grey light). Outside: byte-identical to the photo.
  for(const x of [150,240,330])expect(await pixel(page,'[data-testid=viz-result]',x,200)).toEqual([...MINT,255]);
  for(const [x,py] of [[10,10],[560,30],[590,390],[300,330],[60,200]] as const)expect(await pixel(page,'[data-testid=viz-result]',x,py)).toEqual(py>=320?[60,70,80,255]:[128,128,128,255]);
  // Before/after slider: a keyboard slider that also follows a drag.
  const slider=view.getByRole('slider',{name:'Before and after divider'});await expect(slider).toHaveAttribute('aria-valuenow','50');
  await slider.focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');await expect(slider).toHaveAttribute('aria-valuenow','40');
  await page.keyboard.press('End');await expect(slider).toHaveAttribute('aria-valuenow','100');
  const frame=(await view.getByTestId('viz-compare').boundingBox())!;await page.mouse.move(frame.x+frame.width*.75,frame.y+frame.height/2);await page.mouse.down();await page.mouse.move(frame.x+frame.width*.25,frame.y+frame.height/2,{steps:5});await page.mouse.up();
  const moved=Number(await slider.getAttribute('aria-valuenow'));expect(moved).toBeGreaterThanOrEqual(23);expect(moved).toBeLessThanOrEqual(27);
  await view.screenshot({path:test.info().outputPath('room-photo-result.png')});
  // Ctrl+Z inside the view never reaches the drawing's Undo.
  await view.getByRole('button',{name:'Show result',exact:true}).focus();await page.keyboard.press('Control+z');
  await view.getByRole('button',{name:'Close room photo',exact:true}).click();
  await expect(view).toBeHidden();await expect(panel).toBeVisible();
  await expect(page.getByTestId('editor-views')).toBeVisible();
  expect(requests.filter(r=>!r.startsWith('GET http://127.0.0.1:4185/')),`requests: ${requests.join(', ')}`).toEqual([]);
  await saved(page);expect(await backup(page)).toEqual(before);
 });
}
