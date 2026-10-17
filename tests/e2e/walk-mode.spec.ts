import {test,expect} from '@playwright/test';
import type {Page,CDPSession} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-026 walk mode (REN-002 in a real browser). Claude-authored (D52 continuation); not an independent fixture.
// H.6 sample: living clear area x 115..4442.5, y 115..4885; partition at x=4500 (faces 4442.5/4557.5) with a 900 mm door at y 550..1450.
// A capsule centre (radius 250) stops 250 mm from a wall face: north wall y=365, partition x=4192.5.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);await page.getByRole('button',{name:'3D view',exact:true}).click();await expect(page.getByTestId('three-view')).toHaveAttribute('data-rendered-generation','0');}
type Walk={x:number;y:number;yaw:number;pitch:number;eye:number};
async function walk(page:Page):Promise<Walk>{return JSON.parse((await page.getByTestId('three-view').getAttribute('data-walk-pose'))!) as Walk;}
async function holdUntil(page:Page,key:string,done:(w:Walk)=>boolean,timeout=9000){
  await page.keyboard.down(key);try{await expect.poll(async()=>done(await walk(page)),{timeout,intervals:[16]}).toBe(true);}finally{await page.keyboard.up(key);}
}
async function touch(cdp:CDPSession,type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel',points:{id:number;x:number;y:number}[]){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});}
const enter=async(page:Page)=>{await page.getByTestId('walk-enter').click();await expect(page.getByTestId('three-view')).toHaveAttribute('data-walk-active','true');};

test('FR-026 walking starts in the largest room, W moves north and the north wall stops the camera 250 mm short; nothing is written to the model',async({page})=>{
  await start(page);const before=await backup(page);await enter(page);
  const first=await walk(page);expect(first.x).toBeCloseTo(2278.8,0);expect(first.y).toBeCloseTo(2500,0);expect([first.yaw,first.pitch,first.eye]).toEqual([0,0,1600]);
  await holdUntil(page,'w',w=>w.y<=366);
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w'); // keep pushing into the wall
  const end=await walk(page);expect(end.y).toBeGreaterThanOrEqual(364.9);expect(end.y).toBeLessThanOrEqual(365.2);expect(end.x).toBeCloseTo(first.x,0);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();expect(await backup(page)).toEqual(before);
});
test('FR-026 the partition blocks at y=2500 but the 900 mm door lets the camera through into the bedroom',async({page})=>{
  await start(page);await enter(page);
  // Turn to face east (yaw 90 degrees), then walk: no door at y=2500, so the partition face stops the camera at x=4192.5.
  await holdUntil(page,'ArrowRight',w=>w.yaw>=Math.PI/2-0.02&&w.yaw<=Math.PI/2+0.2);
  await holdUntil(page,'w',w=>w.x>=4192);await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  const blocked=await walk(page);expect(blocked.x).toBeGreaterThanOrEqual(4192.4);expect(blocked.x).toBeLessThanOrEqual(4192.7);
  // Go north to the door line (y about 1000), face east again and walk through.
  await holdUntil(page,'ArrowLeft',w=>w.yaw<=0.2||w.yaw>=2*Math.PI-0.2);
  await holdUntil(page,'w',w=>w.y<=1050);
  await holdUntil(page,'ArrowRight',w=>w.yaw>=Math.PI/2-0.05&&w.yaw<=Math.PI/2+0.2);
  await holdUntil(page,'w',w=>w.x>=5200);
  expect((await walk(page)).x).toBeGreaterThan(4557.5+250);
});
test('FR-026 Exit is always visible; Exit and Escape both return to the exact orbit pose',async({page})=>{
  await start(page);const view=page.getByTestId('three-view'),orbit=await view.getAttribute('data-camera-pose');
  await expect(page.getByTestId('walk-exit')).toHaveCount(0);await enter(page);await expect(page.getByTestId('walk-exit')).toBeVisible();
  await holdUntil(page,'w',w=>w.y<=2000);
  await page.getByTestId('walk-exit').click();await expect(view).toHaveAttribute('data-walk-active','false');await expect.poll(()=>view.getAttribute('data-camera-pose')).toBe(orbit);
  await enter(page);await page.keyboard.press('Escape');await expect(view).toHaveAttribute('data-walk-active','false');await expect.poll(()=>view.getAttribute('data-camera-pose')).toBe(orbit);
  await expect(page.getByTestId('walk-enter')).toBeVisible();
});
test('FR-026 the on-screen joystick walks by touch and stops on release; dragging the view looks around',async({page})=>{
  await start(page);await enter(page);const cdp=await page.context().newCDPSession(page),pad=(await page.getByTestId('walk-joystick').boundingBox())!;
  const centre={x:pad.x+pad.width/2,y:pad.y+pad.height/2},origin=await walk(page);
  await touch(cdp,'touchStart',[{id:1,x:centre.x,y:centre.y-pad.height*0.4}]);
  await expect.poll(async()=> (await walk(page)).y,{timeout:6000,intervals:[16]}).toBeLessThan(origin.y-300);
  await touch(cdp,'touchEnd',[]);await page.waitForTimeout(150);const stopped=await walk(page);await page.waitForTimeout(300);expect((await walk(page)).y).toBe(stopped.y);
  const canvas=(await page.getByTestId('three-view').locator('canvas').boundingBox())!,from={x:canvas.x+canvas.width*0.6,y:canvas.y+canvas.height*0.5};
  await touch(cdp,'touchStart',[{id:2,...from}]);await touch(cdp,'touchMove',[{id:2,x:from.x+100,y:from.y}]);await touch(cdp,'touchEnd',[]);
  await expect.poll(async()=> (await walk(page)).yaw).toBeGreaterThan(0.3); // 100 px x 0.004 rad = 0.4 rad
  await cdp.detach();
});
test('FR-026 + and - change the eye height within 1000..2000 mm; a project with no room refuses to start walking',async({page})=>{
  await start(page);await enter(page);
  await page.keyboard.press('+');await expect.poll(async()=> (await walk(page)).eye).toBe(1700);
  for(let i=0;i<12;i++)await page.keyboard.press('-');await expect.poll(async()=> (await walk(page)).eye).toBe(1000);
  await page.getByTestId('walk-exit').click();
  await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('button',{name:'Create drawing',exact:true}).click();await saved(page);
  await page.getByRole('button',{name:'3D view',exact:true}).click();await expect(page.getByTestId('three-view')).toBeVisible();
  await expect(page.getByTestId('three-view')).toHaveAttribute('data-scene-state','current',{timeout:15000});
  await page.getByTestId('walk-enter').click();await expect(page.getByTestId('three-view')).toHaveAttribute('data-walk-active','false');
  await expect(page.getByText('Draw a room first, then you can walk through it.',{exact:true})).toBeVisible();
});
