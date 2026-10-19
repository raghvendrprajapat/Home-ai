import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
async function setup(page:Page){await page.addInitScript(()=>{
 const Native=window.Worker;
 type Reply={requestId:number;tag:{localGeneration:number}};
 const probe={hold:false,requests:[] as Reply[],queued:[] as {run:()=>void;reply:Reply}[],replay:null as (()=>void)|null,worker:null as Worker|null};
 Object.assign(window,{workerProbe:probe});
 window.Worker=class extends Native{
  constructor(url:string|URL,options?:WorkerOptions){super(url,options);if(!String(url).includes('mesh.worker'))return;probe.worker=this;
   let handler:((e:MessageEvent)=>void)|null=null;Object.defineProperty(this,'onmessage',{get:()=>handler,set:(v:typeof handler)=>{handler=v;}});
   const post=this.postMessage.bind(this);this.postMessage=(data:unknown)=>{probe.requests.push(data as Reply);post(data);};
   this.addEventListener('message',e=>{const captured=handler,run=()=>captured?.(e);if(probe.hold)probe.queued.push({run,reply:e.data as Reply});else run();});
  }
 };
 });await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');await page.getByRole('button',{name:'3D view',exact:true}).click();await expect(page.getByTestId('three-view')).toHaveAttribute('data-rendered-generation','0');}
async function probe(page:Page,action:'hold'|'release'|'replay'|'fail'){await page.evaluate(action=>{
 const p=(window as unknown as {workerProbe:{hold:boolean;queued:{run:()=>void}[];replay:(()=>void)|null;worker:Worker}}).workerProbe;
 if(action==='hold')p.hold=true;else if(action==='release'){const first=p.queued.shift()!;p.replay=first.run;first.run();}else if(action==='replay')p.replay?.();else p.worker.dispatchEvent(new ErrorEvent('error',{message:'Injected runtime failure'}));
 },action);}
async function queue(page:Page){await expect.poll(()=>page.evaluate(()=>(window as unknown as {workerProbe:{queued:unknown[]}}).workerProbe.queued.length)).toBe(1);}
async function height(page:Page,value:string){const room=page.getByRole('region',{name:'Room properties',exact:true});await room.getByLabel('Choose room',{exact:true}).selectOption('r_living');await room.getByLabel('Ceiling height (mm)',{exact:true}).fill(value);await room.getByRole('button',{name:'Apply room properties',exact:true}).click();}
test('SYNC-001/006 actual delayed worker coalesces edits/Undo; stale/duplicate results never replace current scene',async({page})=>{
 await setup(page);const original=await backup(page),view=page.getByTestId('three-view');await probe(page,'hold');await height(page,'3500');await queue(page);await height(page,'3600');await page.getByRole('button',{name:'Undo',exact:true}).click();const current=await backup(page);expect(current.rooms.find((r:{id:string})=>r.id==='r_living').ceilingHeight).toBe(3500);expect(current.walls).toEqual(original.walls);await expect(view).toHaveAttribute('data-rendered-generation','');await probe(page,'release');await queue(page);await expect(view).toHaveAttribute('data-rendered-generation','');await probe(page,'replay');await expect(view).toHaveAttribute('data-rendered-generation','');await probe(page,'release');await expect(view).toHaveAttribute('data-rendered-generation','3');await expect(view).toHaveAttribute('data-scene-state','current');await probe(page,'replay');await expect(view).toHaveAttribute('data-rendered-generation','3');expect(await backup(page)).toEqual(current);expect(await page.evaluate(()=>(window as unknown as {workerProbe:{requests:unknown[]}}).workerProbe.requests.length)).toBe(3);
});
test('SYNC-006 runtime failure keeps labelled previous scene; context restoration cannot claim current and fresh view recovers',async({page})=>{
 await setup(page);const view=page.getByTestId('three-view');await probe(page,'hold');await height(page,'3500');await queue(page);const current=await backup(page);await probe(page,'fail');await expect(view).toHaveAttribute('data-scene-state','stale');await expect(view).toHaveAttribute('data-rendered-generation','');await expect(view).toHaveAttribute('data-previous-generation','0');await expect(view.getByRole('status')).toContainText('previous complete scene');await probe(page,'release');await expect(view).toHaveAttribute('data-rendered-generation','');
 await view.locator('canvas').evaluate(c=>{c.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));c.dispatchEvent(new Event('webglcontextrestored'));});await expect(view.getByRole('status')).toContainText('previous complete scene');await expect(view).toHaveAttribute('data-scene-state','stale');await expect(view).toHaveAttribute('data-rendered-generation','');expect(await backup(page)).toEqual(current);
 await page.getByRole('button',{name:'2D plan',exact:true}).click();await page.evaluate(()=>(window as unknown as {workerProbe:{hold:boolean}}).workerProbe.hold=false);await page.getByRole('button',{name:'3D view',exact:true}).click();await expect(view).toHaveAttribute('data-rendered-generation','1');await expect(view).toHaveAttribute('data-scene-state','current');await expect(view.getByRole('status')).not.toContainText('previous complete scene');expect(await backup(page)).toEqual(current);
});
test('SYNC-001 actual room-name and unit edits reuse all structural meshes while model changes stay authoritative',async({page})=>{
 await setup(page);const original=await backup(page),view=page.getByTestId('three-view'),room=page.getByRole('region',{name:'Room properties',exact:true});await room.getByLabel('Choose room',{exact:true}).selectOption('r_living');await room.getByLabel('Room name',{exact:true}).fill('Renamed living');await room.getByRole('button',{name:'Apply room properties',exact:true}).click();await expect(view).toHaveAttribute('data-rendered-generation','1');await expect(view).toHaveAttribute('data-meshes-built','0');expect(JSON.parse((await view.getAttribute('data-invalidation'))!).geometryChanged).toBe(false);expect(JSON.parse((await view.getAttribute('data-mesh-changes'))!).replaced).toEqual([]);
 await page.getByLabel('Drawing display units',{exact:true}).selectOption('imperial');await expect(view).toHaveAttribute('data-rendered-generation','2');await expect(view).toHaveAttribute('data-meshes-built','0');expect(JSON.parse((await view.getAttribute('data-invalidation'))!).geometryChanged).toBe(false);const current=await backup(page);expect(current.units).toBe('imperial');expect(current.rooms.find((r:{id:string})=>r.id==='r_living').name).toBe('Renamed living');for(const key of ['walls','junctions','openings','furniture'])expect(current[key]).toEqual(original[key]);
});

// D76 M1 (setup only, no assertion changed): these tests were written for the plain fixture, "auto" quality resolving
// to low on a budget phone, and full-height walls in 3D. M1 made the furnished sample, mid on capable devices and
// low walls the defaults, so this file starts like a budget phone with the fixture and full walls.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});
