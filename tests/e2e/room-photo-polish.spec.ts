import {test,expect} from '@playwright/test';
import type {Locator,Page} from '@playwright/test';
import {openTool} from './helpers/tools';

// D87 Room photo polish: zoom/pan on the photo and room photo sessions kept on this device. Claude-authored builder
// test, not an independent fixture. The photo is an original PNG drawn in the test (grey 128 with a darker band), so
// expected colours are exact; expected positions come from the zoom definition (zoom about the frame centre keeps
// the centre pixel; one CSS px is 600 / (frame width × zoom) photo px), not from the app's code.
const W=600,H=400,MINT=[207,227,211];
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});

async function roomPng(page:Page):Promise<Buffer>{
 const url=await page.evaluate(({w,h})=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;g.fillStyle='rgb(128,128,128)';g.fillRect(0,0,w,h);g.fillStyle='rgb(60,70,80)';g.fillRect(0,h*.8,w,h*.2);return c.toDataURL('image/png');},{w:W,h:H});
 return Buffer.from(url.split(',')[1]!,'base64');
}
const pixel=(page:Page,selector:string,x:number,y:number)=>page.locator(selector).evaluate((c,[px,py])=>Array.from((c as HTMLCanvasElement).getContext('2d')!.getImageData(Math.floor(px!),Math.floor(py!),1,1).data),[x,y]);
/** FNV-1a of every RGBA byte of a canvas, plus its size: equal digests mean equal pixels. */
const digest=(canvas:Locator)=>canvas.evaluate(c=>{const k=c as HTMLCanvasElement,d=k.getContext('2d')!.getImageData(0,0,k.width,k.height).data;let h=0x811c9dc5;for(let i=0;i<d.length;i++){h^=d[i]!;h=Math.imul(h,16777619)>>>0;}return `${k.width}x${k.height}:${h}`;});
const alphaSum=(canvas:Locator)=>canvas.evaluate(c=>{const k=c as HTMLCanvasElement,d=k.getContext('2d')!.getImageData(0,0,k.width,k.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i]!;return s;});
/** Reads the stored sessions straight from IndexedDB and decodes their JPEGs the way the app does (upright, same size). */
const stored=(page:Page)=>page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((ok,no)=>{const r=indexedDB.open('gharplan-room-photos');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 const all=await new Promise<{id:string;photo:Uint8Array;options:{label:string;jpeg:Uint8Array}[]}[]>((ok,no)=>{const r=db.transaction('sessions').objectStore('sessions').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 db.close();
 const decode=async(bytes:Uint8Array)=>{const b=await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'image/jpeg'}),{imageOrientation:'from-image'}),c=document.createElement('canvas');c.width=b.width;c.height=b.height;const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(b,0,0);b.close();
  const d=g.getImageData(0,0,c.width,c.height).data;let h=0x811c9dc5;for(let i=0;i<d.length;i++){h^=d[i]!;h=Math.imul(h,16777619)>>>0;}return `${c.width}x${c.height}:${h}`;};
 const hash=(bytes:Uint8Array)=>{let h=0x811c9dc5;for(const v of bytes){h^=v;h=Math.imul(h,16777619)>>>0;}return `${bytes.length}:${h}`;};
 return Promise.all(all.map(async s=>({id:s.id,photo:await decode(s.photo),labels:s.options.map(o=>o.label),options:s.options.map(o=>hash(o.jpeg)),newest:s.options.length?await decode(s.options.at(-1)!.jpeg):null})));
});
/** Bytes of each kept option's image, as the page holds them (blob URLs). */
const optionBytes=(view:Locator)=>view.locator('.viz-variants img').evaluateAll(async imgs=>Promise.all(imgs.map(async i=>{const b=new Uint8Array(await (await fetch((i as HTMLImageElement).src)).arrayBuffer());let h=0x811c9dc5;for(const v of b){h^=v;h=Math.imul(h,16777619)>>>0;}return `${b.length}:${h}`;})));

for(const [label,viewport] of [['desktop 1280x800',{width:1280,height:800}],['phone 360x800',{width:360,height:800}]] as const){
 test(`D87 Room photo (${label}): pinch never draws, brushing while zoomed hits exactly the zoomed spot, the session reopens exactly and can be deleted`,async({page})=>{
  test.setTimeout(60_000);
  await page.setViewportSize(viewport);
  await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();
  const png=await roomPng(page);
  await openTool(page,'Room photo');
  const panel=page.getByRole('region',{name:'Room photo',exact:true});
  // A fresh device has no saved room photos, so there is no Recent list yet.
  await expect(panel.getByRole('button',{name:'Choose room photo',exact:true})).toBeVisible();
  await expect(panel.getByRole('region',{name:'Recent room photos'})).toHaveCount(0);
  const chooser=page.waitForEvent('filechooser');await panel.getByRole('button',{name:'Choose room photo',exact:true}).click();
  await (await chooser).setFiles({name:'room.png',mimeType:'image/png',buffer:png});
  const view=page.getByRole('dialog',{name:'Room photo'});await expect(view).toBeVisible();
  const frame=view.getByTestId('viz-frame'),mask=view.getByTestId('viz-mask'),level=view.getByTestId('viz-zoom-level');
  await expect(mask).toBeVisible();await expect(level).toHaveText('Zoom 1.0×');
  const fb=(await frame.boundingBox())!,cx=fb.x+fb.width/2,cy=fb.y+fb.height/2;

  // 1. A real two-finger touch pinch (Chrome DevTools touch events) zooms in and never draws.
  const cdp=await page.context().newCDPSession(page);
  const touch=(type:'touchStart'|'touchMove'|'touchEnd',points:[number,number][])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
  await touch('touchStart',[[cx-20,cy]]);await touch('touchMove',[[cx-24,cy]]);
  // One finger alone draws (live, not yet a recorded step) …
  await expect.poll(()=>alphaSum(mask)).toBeGreaterThan(0);
  // … and the second finger turns it into a pinch: that live stroke is removed again.
  await touch('touchStart',[[cx-24,cy],[cx+20,cy]]);
  for(let i=1;i<=5;i++)await touch('touchMove',[[cx-24-i*12,cy],[cx+20+i*12,cy]]);
  await touch('touchEnd',[]);
  const pinched=Number(await frame.getAttribute('data-zoom'));
  // Finger distance 44 → 164 px: zoom 164/44 ≈ 3.7.
  expect(pinched).toBeGreaterThan(3.3);expect(pinched).toBeLessThan(4.1);
  expect(await alphaSum(mask)).toBe(0);
  await expect(view.getByRole('button',{name:'Undo area change',exact:true})).toBeDisabled();
  await expect(view.getByRole('button',{name:'Clear area',exact:true})).toBeDisabled();
  // The mouse wheel zooms too (up = in), also without drawing.
  await view.getByRole('button',{name:'Fit the whole photo',exact:true}).click();await expect(level).toHaveText('Zoom 1.0×');
  await page.mouse.move(cx,cy);await page.mouse.wheel(0,-200);
  await expect.poll(async()=>Number(await frame.getAttribute('data-zoom'))).toBeGreaterThan(1.2);expect(await alphaSum(mask)).toBe(0);
  await view.getByRole('button',{name:'Fit the whole photo',exact:true}).click();await expect(level).toHaveText('Zoom 1.0×');

  // 2. Zoom in twice (1.5 × 1.5 = 2.25, about the centre), then brush a horizontal line through the centre.
  await view.getByRole('button',{name:'Zoom in',exact:true}).click();await view.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(frame).toHaveAttribute('data-zoom','2.250');await expect(level).toHaveText('Zoom 2.3×');
  const zoom=2.25,perCss=W/(fb.width*zoom),brush=20,r=brush*perCss,d=fb.width*.2;
  await view.getByLabel('Brush size',{exact:true}).fill(String(brush));
  await page.mouse.move(cx-d,cy);await page.mouse.down();await page.mouse.move(cx+d,cy,{steps:12});await page.mouse.up();
  const x0=300-d*perCss,x1=300+d*perCss;// the stroke's ends in photo px
  for(const x of [x0+1,300,x1-1])expect((await pixel(page,'[data-testid=viz-mask]',x,200))[3],`inside at x=${x}`).toBeGreaterThan(100);
  for(const y of [200-(r-2),200+(r-2)])expect((await pixel(page,'[data-testid=viz-mask]',300,y))[3],`inside at y=${y}`).toBeGreaterThan(100);
  for(const [x,y] of [[300,200+r+3],[300,200-r-3],[x1+r+3,200],[x0-r-3,200]] as const)expect(await pixel(page,'[data-testid=viz-mask]',x,y),`outside at ${x},${y}`).toEqual([0,0,0,0]);
  // Without the zoom the same screen stroke would have reached photo x = 300 + d·600/frame width; that spot is untouched.
  const unzoomedEnd=300+d*W/fb.width;expect(unzoomedEnd).toBeGreaterThan(x1+r+3);
  expect(await pixel(page,'[data-testid=viz-mask]',unzoomedEnd-2,200)).toEqual([0,0,0,0]);
  const areaDigest=await digest(mask);
  await page.screenshot({path:test.info().outputPath('zoomed-brush.png')});

  // 3. The result keeps the zoom; the before/after divider still works by keys and by dragging.
  await view.getByRole('button',{name:'Paint - mint green',exact:true}).click();
  await view.getByRole('button',{name:'Show result',exact:true}).click();
  const result=view.getByTestId('viz-result');await expect(result).toBeAttached();
  await expect(frame).toHaveAttribute('data-zoom','2.250');
  expect(await pixel(page,'[data-testid=viz-result]',300,200)).toEqual([...MINT,255]);
  expect(await pixel(page,'[data-testid=viz-result]',300,200+r+3)).toEqual([128,128,128,255]);
  expect(await pixel(page,'[data-testid=viz-result]',unzoomedEnd-2,200)).toEqual([128,128,128,255]);
  const slider=view.getByRole('slider',{name:'Before and after divider'});
  await slider.focus();await page.keyboard.press('Home');await expect(slider).toHaveAttribute('aria-valuenow','0');
  await page.keyboard.press('End');await expect(slider).toHaveAttribute('aria-valuenow','100');
  await page.mouse.move(fb.x+fb.width*.75,cy);await page.mouse.down();await page.mouse.move(fb.x+fb.width*.25,cy,{steps:5});await page.mouse.up();
  const moved=Number(await slider.getAttribute('aria-valuenow'));expect(moved).toBeGreaterThanOrEqual(23);expect(moved).toBeLessThanOrEqual(27);
  // "Move photo": a drag pans the zoomed photo instead of moving the divider.
  const layer=view.locator('.viz-compare .viz-zoomed').first(),before=await layer.getAttribute('style');
  await view.getByRole('button',{name:'Move photo',exact:true}).click();
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+fb.width*.1,cy,{steps:4});await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuenow',String(moved));
  expect(await layer.getAttribute('style')).not.toBe(before);
  await view.getByRole('button',{name:'Move photo',exact:true}).click();
  // Holding Shift while dragging pans as well.
  const panned=await layer.getAttribute('style');
  await page.keyboard.down('Shift');await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-fb.width*.05,cy,{steps:4});await page.mouse.up();await page.keyboard.up('Shift');
  await expect(slider).toHaveAttribute('aria-valuenow',String(moved));
  expect(await layer.getAttribute('style')).not.toBe(panned);

  // 4. Keeping the option saves the session on this device.
  await view.getByRole('button',{name:'Keep as option',exact:true}).click();
  await expect(view.getByTestId('viz-session-note')).toHaveText('Saved on this device. Open it again from "Recent room photos".');
  const keptBytes=await optionBytes(view);expect(keptBytes).toHaveLength(1);
  let saved=await stored(page);expect(saved).toHaveLength(1);expect(saved[0]!.labels).toEqual(['Option A']);expect(saved[0]!.options).toEqual(keptBytes);
  await view.getByRole('button',{name:'Close room photo',exact:true}).click();await expect(view).toBeHidden();

  // 5. Reopen from "Recent room photos": photo, area and option come back exactly.
  const recent=panel.getByRole('region',{name:'Recent room photos'});await expect(recent).toBeVisible();
  const open=recent.locator('.room-recent-open');await expect(open).toHaveCount(1);await expect(open).toContainText('1 option');
  await page.screenshot({path:test.info().outputPath('recent-list.png')});
  await open.click();await expect(view).toBeVisible();
  await expect(view.getByRole('button',{name:'Before / after',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(level).toHaveText('Zoom 1.0×');
  await expect(view.locator('.viz-variants li')).toHaveText(['Option A']);
  expect(await optionBytes(view)).toEqual(keptBytes);
  saved=await stored(page);
  // The shown result is the stored option, decoded; the photo is the stored photo, decoded (both byte for byte).
  expect(await digest(view.getByTestId('viz-result'))).toBe(saved[0]!.newest);
  await expect(view.getByTestId('viz-result')).toBeAttached();
  const restored=(await pixel(page,'[data-testid=viz-result]',300,200)).slice(0,3);for(const [i,v] of restored.entries())expect(Math.abs(v-MINT[i]!)).toBeLessThanOrEqual(4);
  await page.screenshot({path:test.info().outputPath('restored.png')});
  await view.getByRole('button',{name:'Area',exact:true}).click();
  expect(await digest(view.getByTestId('viz-photo'))).toBe(saved[0]!.photo);
  expect(await digest(mask)).toBe(areaDigest);
  await view.getByRole('button',{name:'Close room photo',exact:true}).click();await expect(view).toBeHidden();

  // 6. Delete the session.
  await recent.getByRole('button',{name:/^Delete room photo from /}).click();
  await expect(panel.getByRole('region',{name:'Recent room photos'})).toHaveCount(0);
  expect(await stored(page)).toEqual([]);
 });
}
