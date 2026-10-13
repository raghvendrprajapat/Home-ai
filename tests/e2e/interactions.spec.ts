import {test,expect} from '@playwright/test';
import type {Page,CDPSession} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
async function begin(page:Page){await page.goto('/');await page.getByRole('button',{name:'Get started',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');await page.getByTestId('plan-canvas').scrollIntoViewIfNeeded();}
async function backup(page:Page){const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,'utf8'));}
async function frame(page:Page){const canvas=page.getByTestId('plan-canvas'),box=await canvas.boundingBox();expect(box).toBeTruthy();const view=await canvas.evaluate(el=>({x:Number((el as HTMLElement).dataset.viewX),y:Number((el as HTMLElement).dataset.viewY),scale:Number((el as HTMLElement).dataset.viewScale)}));return {box:box!,view};}
async function touch(cdp:CDPSession,type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel',points:{id:number;x:number;y:number}[]){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});}
test('GEO-008 actual two-finger pinch follows its midpoint with≤2px anchor drift and never edits a drawing',async({page})=>{
 await begin(page);const original=await backup(page),{box,view}=await frame(page),cdp=await page.context().newCDPSession(page);
 const a={id:1,x:box.x+view.x+4500*view.scale,y:box.y+view.y},b={id:2,x:a.x+80,y:a.y+40};
 const nativeCanvas=await page.getByTestId('plan-canvas').locator('canvas').first().elementHandle();expect(nativeCanvas).toBeTruthy();
 await touch(cdp,'touchStart',[a]);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-picked-kind','junction');await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));expect(await nativeCanvas!.evaluate(node=>node.isConnected)).toBe(true);await touch(cdp,'touchStart',[a,b]);
 const midpoint={x:(a.x+b.x)/2-box.x,y:(a.y+b.y)/2-box.y},anchor={x:(midpoint.x-view.x)/view.scale,y:(midpoint.y-view.y)/view.scale};
 const nextA={id:1,x:a.x+20-16,y:a.y+10-8},nextB={id:2,x:b.x+20+16,y:b.y+10+8};await touch(cdp,'touchMove',[nextA,nextB]);
 await expect.poll(async()=> (await frame(page)).view.scale).toBeCloseTo(view.scale*1.4,6);
 const after=(await frame(page)).view;expect(Math.hypot(anchor.x*after.scale+after.x-(midpoint.x+20),anchor.y*after.scale+after.y-(midpoint.y+10))).toBeLessThanOrEqual(2);
 const secondA={id:1,x:a.x+35-24,y:a.y-5-12},secondB={id:2,x:b.x+35+24,y:b.y-5+12};await touch(cdp,'touchMove',[secondA,secondB]);await expect.poll(async()=> (await frame(page)).view.scale).toBeCloseTo(view.scale*1.6,6);
 const secondView=(await frame(page)).view;expect(Math.hypot(anchor.x*secondView.scale+secondView.x-(midpoint.x+35),anchor.y*secondView.scale+secondView.y-(midpoint.y-5))).toBeLessThanOrEqual(2);
 await touch(cdp,'touchEnd',[secondB]);const half=(await frame(page)).view;await touch(cdp,'touchMove',[{...secondB,x:secondB.x+50,y:secondB.y+30}]);expect((await frame(page)).view).toEqual(half);await touch(cdp,'touchEnd',[]);
 expect(await backup(page)).toEqual(original);await expect(page.getByTestId('touch-loupe')).toHaveCount(0);
});
test('UX-004 touch hold/loupe commits once; early pan, second finger and pointer cancel leave canonical data unchanged',async({page})=>{
 await begin(page);const original=await backup(page),cdp=await page.context().newCDPSession(page);let {box,view}=await frame(page);
 let a={id:1,x:box.x+view.x+4500*view.scale,y:box.y+view.y};
 await touch(cdp,'touchStart',[a]);await touch(cdp,'touchMove',[{...a,x:a.x+30}]);await touch(cdp,'touchEnd',[]);expect(await backup(page)).toEqual(original);
 await page.getByRole('button',{name:'Fit floor plan',exact:true}).click();({box,view}=await frame(page));a={id:1,x:box.x+view.x+4500*view.scale,y:box.y+view.y};
 await touch(cdp,'touchStart',[a]);await expect(page.getByTestId('touch-loupe')).toBeVisible();await touch(cdp,'touchMove',[{...a,x:a.x+100*view.scale}]);
 await expect(page.getByTestId('touch-loupe')).toContainText('4600');await expect(page.getByLabel('Corner X coordinate',{exact:true})).toHaveValue('4500');
 const b={id:2,x:a.x+90,y:a.y+50};await touch(cdp,'touchStart',[{...a,x:a.x+100*view.scale},b]);await expect(page.getByTestId('touch-loupe')).toHaveCount(0);await touch(cdp,'touchCancel',[]);expect(await backup(page)).toEqual(original);
 await page.getByRole('button',{name:'Fit floor plan',exact:true}).click();({box,view}=await frame(page));a={id:1,x:box.x+view.x+4500*view.scale,y:box.y+view.y};
 await touch(cdp,'touchStart',[a]);await expect(page.getByTestId('touch-loupe')).toBeVisible();await touch(cdp,'touchMove',[{...a,x:a.x+100*view.scale}]);await touch(cdp,'touchEnd',[]);await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');
 const changed=await backup(page);expect(changed.junctions.find((j:{id:string})=>j.id==='j2').x).toBe(4600);expect(changed.junctions.every((j:{x:number;y:number})=>Number.isInteger(j.x)&&Number.isInteger(j.y))).toBe(true);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();expect(await backup(page)).toEqual(original);
});
test('GEO-008 wheel anchor, GEO-012 cycling, Escape and stale-generation drag never add extra history',async({page})=>{
 await begin(page);const original=await backup(page);let {box,view}=await frame(page);const screen={x:box.x+view.x+4500*view.scale,y:box.y+view.y};
 await page.mouse.move(screen.x,screen.y);await page.mouse.wheel(0,-150);await expect.poll(async()=> (await frame(page)).view.scale).toBeGreaterThan(view.scale);
 const zoomed=(await frame(page)).view;expect(Math.abs(4500*zoomed.scale+zoomed.x-(screen.x-box.x))).toBeLessThanOrEqual(1);expect(Math.abs(zoomed.y-(screen.y-box.y))).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'Fit floor plan',exact:true}).click();({box,view}=await frame(page));const corner={x:box.x+view.x,y:box.y+view.y};
 await page.mouse.click(corner.x,corner.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-picked-kind','junction');await page.mouse.click(corner.x,corner.y);await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-picked-kind','wall');expect(await backup(page)).toEqual(original);
 const partition={x:box.x+view.x+4500*view.scale,y:box.y+view.y};await page.mouse.move(partition.x,partition.y);await page.mouse.down();await page.mouse.move(partition.x+100*view.scale,partition.y);await page.keyboard.press('Escape');await page.mouse.up();expect(await backup(page)).toEqual(original);
 await page.getByLabel('Corner X coordinate',{exact:true}).fill('4600');await page.getByRole('button',{name:'Apply coordinates',exact:false}).click();const committed=await backup(page);
 await page.getByTestId('plan-canvas').scrollIntoViewIfNeeded();({box,view}=await frame(page));await page.mouse.move(box.x+view.x+4600*view.scale,box.y+view.y);await page.mouse.down();await page.mouse.move(box.x+view.x+4800*view.scale,box.y+view.y);await page.keyboard.press('Control+z');await page.mouse.up();
 expect(await backup(page)).toEqual(original);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await backup(page)).toEqual(committed);await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await backup(page)).toEqual(original);
});
test('GEO-012 opening/furniture overlap cycling survives zero-distance pan; canvas keyboard zoom/pan never edits',async({page})=>{
 await begin(page);const source=await backup(page),doc=structuredClone(source);doc.id='pick_overlap';
 const opening=doc.openings[0],wall=doc.walls.find((w:{id:string})=>w.id===opening.wallId),a=doc.junctions.find((j:{id:string})=>j.id===wall.a),b=doc.junctions.find((j:{id:string})=>j.id===wall.b),length=Math.hypot(b.x-a.x,b.y-a.y),centre={x:a.x+(b.x-a.x)/length*opening.offset,y:a.y+(b.y-a.y)/length*opening.offset};
 doc.furniture=[{...doc.furniture[0],id:'pick_lower',position:centre,size:{w:600,d:600,h:600},rotationDeg:37},{...doc.furniture[0],id:'pick_upper',position:centre,size:{w:600,d:600,h:600},rotationDeg:37}];
 await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByLabel('Choose project backup JSON',{exact:true}).setInputFiles({name:'overlap.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await page.getByRole('button',{name:'Open backup with original IDs',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');
 const canvas=page.getByTestId('plan-canvas');await canvas.scrollIntoViewIfNeeded();const {box,view}=await frame(page),point={x:box.x+view.x+centre.x*view.scale,y:box.y+view.y+centre.y*view.scale};
 const image=async()=>createHash('sha256').update(await canvas.locator('canvas').first().evaluate(node=>(node as HTMLCanvasElement).toDataURL())).digest('hex');const unselected=await image();
 for(const [kind,id] of [['opening',opening.id],['furniture','pick_upper'],['furniture','pick_lower'],['wall',wall.id]]){await page.mouse.click(point.x,point.y);await expect(canvas).toHaveAttribute('data-picked-kind',kind);await expect(canvas).toHaveAttribute('data-picked-id',id);if(kind==='opening')await expect.poll(image).not.toBe(unselected);}
 expect(await backup(page)).toEqual(doc);await canvas.focus();await page.keyboard.press('ArrowLeft');expect((await frame(page)).view.x).toBe(view.x+50);await page.keyboard.press('+');expect((await frame(page)).view.scale).toBeCloseTo(view.scale*1.25,6);expect(await backup(page)).toEqual(doc);
 const current=await frame(page),corner={x:current.box.x+current.view.x,y:current.box.y+current.view.y};await canvas.focus();await page.keyboard.down('Space');await page.mouse.move(corner.x,corner.y);await page.mouse.down();await page.mouse.move(corner.x+30,corner.y);await page.mouse.up();await page.keyboard.up('Space');// Native PointerEvent coordinates are float32-quantized;0.01px is stricter than the1px viewport gate.
 expect(Math.abs((await frame(page)).view.x-(current.view.x+30))).toBeLessThanOrEqual(0.01);expect(await backup(page)).toEqual(doc);
});
test('missed pointerup plus browser blur cancels drafts and allows the next genuine drag',async({page})=>{
 await begin(page);const original=await backup(page),{box,view}=await frame(page),p={x:box.x+view.x+4500*view.scale,y:box.y+view.y};
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+100*view.scale,p.y);
 await page.evaluate(()=>window.addEventListener('pointerup',event=>event.stopImmediatePropagation(),{capture:true,once:true}));await page.mouse.up();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 expect(await backup(page)).toEqual(original);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+100*view.scale,p.y);await page.mouse.up();
 const changed=await backup(page);expect(changed.junctions.find((j:{id:string})=>j.id==='j2').x).toBe(4600);await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await backup(page)).toEqual(original);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});

test('UX-004 responsive buttons keep48CSSpx targets at mobile/tablet/desktop without horizontal overflow',async({page})=>{
 await begin(page);
 for(const [width,height] of [[360,800],[768,1024],[1440,900]]){
  await page.setViewportSize({width:width!,height:height!});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const sizes=await page.getByRole('button').evaluateAll(buttons=>buttons.filter(b=>(b as HTMLElement).offsetParent!==null).map(b=>({label:b.textContent,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})));
  expect(sizes.length).toBeGreaterThan(5);for(const size of sizes){expect(size.width,`${size.label} width`).toBeGreaterThanOrEqual(48);expect(size.height,`${size.label} height`).toBeGreaterThanOrEqual(48);}
 }
});
