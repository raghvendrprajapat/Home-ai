import {test,expect} from '@playwright/test';
import type {Locator,Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {openTool} from './helpers/tools';

// D89 builder (Claude) integration evidence for the HD picture of the 3D view. The independent acceptance suite is untouched.
// Runs the furnished sample (the M1 default) on mid quality, at a desktop and a phone-sized viewport.
async function start(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');
 await page.getByRole('button',{name:'3D view',exact:true}).click();await openTool(page,'Project');await page.getByLabel('3D quality',{exact:true}).selectOption('mid');
 const view=page.getByTestId('three-view');await expect(view).toHaveAttribute('data-rendered-generation','0',{timeout:30000});await expect(view).toHaveAttribute('data-quality-tier','mid');
 await expect(view).toHaveAttribute('data-environment',/^hdri:/,{timeout:30000});await expect.poll(()=>view.locator('[data-model-phase="loading"]').count(),{timeout:30000}).toBe(0);
 await expect(view.locator('details.furniture-models.all-ready')).toHaveCount(1,{timeout:30000});
 // Settled: furniture models attach a little after loading; the baseline must be the finished scene.
 let last='';await expect.poll(async()=>{const now=JSON.stringify(await live(view));const same=now===last&&!now.includes('"drawCalls":""');last=now;if(!same)await page.waitForTimeout(700);return same;},{timeout:30000,intervals:[100]}).toBe(true);
 return view;
}
/** Everything about the live view a picture must leave exactly as it was. */
async function live(view:Locator){
 const attributes=await view.evaluate(e=>{const d=(e as HTMLElement).dataset;return {drawCalls:d.drawCalls,tier:d.qualityTier,antialias:d.antialias,pixelRatio:d.pixelRatio,shadows:d.shadows,shadowLights:d.shadowLights,pointLights:d.pointLights,lighting:d.lighting,gpuMemory:d.gpuMemory,pose:d.cameraPose,generation:d.renderedGeneration,toneMapping:d.toneMapping,context:d.contextState??'',scene:d.sceneState,picture:d.pictureState??''};});
 const canvas=await view.locator('canvas').evaluate(c=>{if(!(c instanceof HTMLCanvasElement))throw new Error('Expected renderer canvas');return {width:c.width,height:c.height,style:c.getAttribute('style')};});
 return {...attributes,canvas};
}
async function makePicture(page:Page,preset:'hd'|'qhd'|'square',format:'png'|'jpeg'='png',controlsShot?:string){
 const panel=page.getByRole('region',{name:'3D image export',exact:true});await openTool(page,'Project');
 await panel.getByLabel('Picture size',{exact:true}).selectOption(preset);await panel.getByLabel('File type',{exact:true}).selectOption(format);
 if(controlsShot){await panel.getByRole('button',{name:'Make HD picture',exact:true}).scrollIntoViewIfNeeded();await panel.screenshot({path:controlsShot});}
 await panel.getByRole('button',{name:'Make HD picture',exact:true}).click();
 const preview=panel.getByRole('region',{name:'HD picture preview',exact:true});await expect(preview).toBeVisible({timeout:180000});await expect(panel.getByRole('alert')).toHaveCount(0);
 const download=page.waitForEvent('download');await preview.getByRole('button',{name:'Save picture',exact:true}).click();const file=await download;
 await expect(panel.getByRole('status').filter({hasText:'Download requested'})).toBeVisible();
 return {bytes:await readFile((await file.path())!),name:file.suggestedFilename(),panel};
}
/** Decodes the real file in the browser: size, spread of brightness and number of distinct colours. */
async function pixels(page:Page,bytes:Buffer,type:string){
 return page.evaluate(async({base64,type})=>{const b=await createImageBitmap(await(await fetch(`data:${type};base64,${base64}`)).blob()),c=document.createElement('canvas');c.width=96;c.height=96;const ctx=c.getContext('2d')!;ctx.drawImage(b,0,0,96,96);const size={width:b.width,height:b.height};b.close();
  const p=ctx.getImageData(0,0,96,96).data;let sum=0,sq=0;const colours=new Set<number>();for(let i=0;i<p.length;i+=4){const l=.2126*p[i]!+.7152*p[i+1]!+.0722*p[i+2]!;sum+=l;sq+=l*l;colours.add((p[i]!>>3)<<10|(p[i+1]!>>3)<<5|p[i+2]!>>3);}
  const n=p.length/4,mean=sum/n;return {...size,mean,deviation:Math.sqrt(Math.max(0,sq/n-mean*mean)),colours:colours.size};},{base64:bytes.toString('base64'),type});
}
const pngSize=(bytes:Buffer)=>({signature:Array.from(bytes.subarray(0,8)),chunk:bytes.subarray(12,16).toString('latin1'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});

for(const viewport of [{width:1280,height:800},{width:412,height:915}]){
 test.describe(`D89 HD picture at ${viewport.width}×${viewport.height}`,()=>{
  test.use({viewport});
  test('HD 1920×1080 PNG (day and night): real pixel size, not blank, live view unchanged and still rendering',async({page},info)=>{
   test.setTimeout(420000);const view=await start(page),before=await live(view);
   expect(Number(before.drawCalls)).toBeGreaterThan(0);expect(Number(before.drawCalls)).toBeLessThanOrEqual(200);
   await openTool(page,'Project');await expect(page.getByRole('checkbox',{name:'Add a small GharPlan mark',exact:true})).toBeChecked();
   await view.screenshot({path:info.outputPath(`live-${viewport.width}.png`)});
   const day=await makePicture(page,'hd','png',info.outputPath(`export-controls-${viewport.width}.png`));
   expect(day.name).toMatch(/^gharplan-[\p{L}\p{M}\p{N}-]+-\d{4}-\d{2}-\d{2}-1920x1080\.png$/u);
   expect(pngSize(day.bytes)).toEqual({signature:[137,80,78,71,13,10,26,10],chunk:'IHDR',width:1920,height:1080});
   const dayPixels=await pixels(page,day.bytes,'image/png');expect(dayPixels).toMatchObject({width:1920,height:1080});expect(dayPixels.deviation).toBeGreaterThan(8);expect(dayPixels.colours).toBeGreaterThan(40);
   await expect(day.panel.getByText('PNG: 1920 × 1080 pixels',{exact:false})).toBeVisible();
   await writeFile(info.outputPath(`hd-day-${viewport.width}.png`),day.bytes);await info.attach('hd-day.png',{path:info.outputPath(`hd-day-${viewport.width}.png`),contentType:'image/png'});
   await day.panel.screenshot({path:info.outputPath(`export-panel-${viewport.width}.png`)});
   // The live view: same canvas size/CSS, draw calls and quality attributes, GPU memory counts and camera.
   await expect.poll(()=>live(view),{timeout:15000}).toEqual(before);
   // ...and it still renders: a camera key moves the camera and a new frame is drawn.
   await view.locator('canvas').focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await live(view)).pose).not.toBe(before.pose);
   await expect.poll(async()=>Number((await live(view)).drawCalls)).toBeGreaterThan(0);await expect(view).toHaveAttribute('data-rendered-generation','0');
   const turned=await live(view);
   // Night preset: same checks; the lamps-only night picture is darker overall than the day one.
   await openTool(page,'Project');await page.getByLabel('Lighting preset',{exact:true}).selectOption('night');await expect(view).toHaveAttribute('data-lighting','night');await expect(view).toHaveAttribute('data-point-lights','2');
   await expect.poll(async()=>(await live(view)).drawCalls).not.toBe('');const nightBefore=await live(view);
   const night=await makePicture(page,'hd');expect(pngSize(night.bytes)).toMatchObject({width:1920,height:1080});
   const nightPixels=await pixels(page,night.bytes,'image/png');expect(nightPixels.deviation).toBeGreaterThan(5);expect(nightPixels.colours).toBeGreaterThan(20);expect(nightPixels.mean).toBeLessThan(dayPixels.mean);
   await writeFile(info.outputPath(`hd-night-${viewport.width}.png`),night.bytes);await info.attach('hd-night.png',{path:info.outputPath(`hd-night-${viewport.width}.png`),contentType:'image/png'});
   await expect.poll(()=>live(view),{timeout:15000}).toEqual(nightBefore);expect(nightBefore.pose).toBe(turned.pose);
   await writeFile(info.outputPath(`evidence-${viewport.width}.json`),JSON.stringify({viewport,lens:await view.getAttribute('data-picture-lens'),before}));
   await info.attach('hd-picture-evidence.json',{body:JSON.stringify({viewport,before,nightBefore,day:{name:day.name,bytes:day.bytes.length,...dayPixels},night:{name:night.name,bytes:night.bytes.length,...nightPixels},lens:await view.getAttribute('data-picture-lens')}),contentType:'application/json'});
  });
 });
}

test.describe('D89 HD picture options',()=>{
 test.use({viewport:{width:1280,height:800}});
 test('Square JPEG without mark, then cancel leaves no picture and the live view unchanged',async({page},info)=>{
  test.setTimeout(420000);const view=await start(page),before=await live(view),panel=page.getByRole('region',{name:'3D image export',exact:true});
  await panel.getByLabel('Picture size',{exact:true}).selectOption('square');await panel.getByRole('checkbox',{name:'Add a small GharPlan mark',exact:true}).uncheck();
  const square=await makePicture(page,'square','jpeg');expect(square.name).toMatch(/-2048x2048\.jpg$/);expect(Array.from(square.bytes.subarray(0,3))).toEqual([0xff,0xd8,0xff]);
  const decoded=await pixels(page,square.bytes,'image/jpeg');expect(decoded).toMatchObject({width:2048,height:2048});expect(decoded.deviation).toBeGreaterThan(8);
  await writeFile(info.outputPath('square.jpg'),square.bytes);await info.attach('square.jpg',{path:info.outputPath('square.jpg'),contentType:'image/jpeg'});
  await expect.poll(()=>live(view),{timeout:15000}).toEqual(before);
  // Cancel while tiles are being drawn: no preview, a calm message, nothing leaked or left changed.
  // Deterministic: the first tile copy holds its slice past the 40 ms budget and queues a Cancel press before the next slice.
  await page.evaluate(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage;let armed=true;CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...args:[CanvasImageSource,...number[]]){Reflect.apply(draw,this,args);const source=args[0];
   if(armed&&source instanceof HTMLCanvasElement&&source.closest('[data-testid=three-view]')&&args.length===9){armed=false;const until=performance.now()+60;while(performance.now()<until){/* hold the slice */}
    setTimeout(()=>{(window as unknown as {cancelSeen:string}).cancelSeen=document.querySelector('[data-testid=three-view]')!.getAttribute('data-picture-state')??'';[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel picture')!.click();},0);}};});
  await panel.getByLabel('Picture size',{exact:true}).selectOption('qhd');await panel.getByRole('button',{name:'Make HD picture',exact:true}).click();
  await expect(panel.getByRole('status').filter({hasText:'Picture cancelled'})).toBeVisible({timeout:60000});await expect(panel.getByRole('region',{name:'HD picture preview',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {cancelSeen:string}).cancelSeen)).toBe('rendering');
  await expect.poll(()=>live(view),{timeout:15000}).toEqual(before);
 });
});
