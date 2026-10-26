import {test,expect} from '@playwright/test';
import type {Page,Route} from '@playwright/test';
import {inflateSync} from 'node:zlib';
import {CLOUD,FakeCloud,install} from './cloud-stand-in';
import {openTool} from './helpers/tools';

// D86 Room photo AI (Phase 2) against an in-test stand-in for Supabase (Auth, the AI database functions, Storage and
// the two Edge Functions). No request ever reaches fal.ai: the "AI result" is a solid-colour picture served by the
// stand-in, so the local composite can be checked exactly. Claude-authored builder test, not an independent fixture.
const W=600,H=400,AI=[200,30,30];
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});

/** Pictures drawn in the page: the room (grey 128 with a dark band), a solid "AI result", and a SAM-style mask. */
async function png(page:Page,kind:'room'|'ai'|'tap'):Promise<Buffer>{
 const url=await page.evaluate(({kind,w,h,ai})=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;
  if(kind==='room'){g.fillStyle='rgb(128,128,128)';g.fillRect(0,0,w,h);g.fillStyle='rgb(60,70,80)';g.fillRect(0,h*.8,w,h*.2);}
  else if(kind==='ai'){g.fillStyle=`rgb(${ai.join(',')})`;g.fillRect(0,0,w,h);}
  else{g.fillStyle='#000';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.fillRect(400,40,120,100);}
  return c.toDataURL('image/png');},{kind,w:W,h:H,ai:AI});
 return Buffer.from(url.split(',')[1]!,'base64');
}
/** The first PNG inside a multipart upload (storage-js sends Blobs as form data). */
function pngIn(body:Buffer):Buffer{const start=body.indexOf(Buffer.from([137,80,78,71])),end=body.indexOf(Buffer.from('IEND'),start)+8;return body.subarray(start,end);}
/** Greyscale 8-bit PNG → mask bytes (filter 0 rows, as the app writes them). */
function readMask(file:Buffer){
 let at=8,width=0,height=0;const idat:Buffer[]=[];
 while(at<file.length){const n=file.readUInt32BE(at),type=file.toString('latin1',at+4,at+8),data=file.subarray(at+8,at+8+n);if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);expect([data[8],data[9]]).toEqual([8,0]);}if(type==='IDAT')idat.push(data);at+=12+n;}
 const raw=inflateSync(Buffer.concat(idat)),at2=(x:number,y:number)=>raw[y*(width+1)+1+x]!;
 return {width,height,at:at2};
}
class FakeAi {
 quota={previewsLeft:3,segmentsLeft:20};jobs=new Map<string,{status:string;polls:number}>();uploads=new Map<string,Buffer>();submits:Record<string,unknown>[]=[];removed:string[]=[];segments:Record<string,unknown>[]=[];reserves:string[]=[];
 constructor(readonly result:Buffer,readonly tap:Buffer){}
}
async function installAi(page:Page,ai:FakeAi){
 await page.route(`${CLOUD}/**`,async(route:Route)=>{
  const request=route.request(),url=new URL(request.url()),cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'};
  const json=(body:unknown,status=200)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(body)});
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  const path=url.pathname;
  if(path==='/rest/v1/rpc/ai_quota')return json({ok:true,enabled:true,paused:false,segmentPaused:false,previewsPerMonth:3,...ai.quota});
  if(path==='/rest/v1/rpc/reserve_ai_job'){const a=request.postDataJSON() as {p_client_job_id:string;p_kind:string};ai.reserves.push(a.p_client_job_id);const job=ai.jobs.get(a.p_client_job_id);
   if(job)return json({ok:true,jobId:a.p_client_job_id,status:job.status,replayed:true});
   ai.jobs.set(a.p_client_job_id,{status:'reserved',polls:0});if(a.p_kind==='edit')ai.quota.previewsLeft--;return json({ok:true,jobId:a.p_client_job_id,status:'reserved'});}
  if(path==='/rest/v1/rpc/get_ai_job'){const id=(request.postDataJSON() as {p_job_id:string}).p_job_id,job=ai.jobs.get(id)!;job.polls++;if(job.polls>=2)job.status='succeeded';
   return json({ok:true,jobId:id,kind:'edit',status:job.status,outputPath:job.status==='succeeded'?`00000000-0000-4000-8000-0000000000e2/results/${id}.jpg`:null});}
  if(path==='/functions/v1/room-ai-submit'){const body=request.postDataJSON() as {clientJobId:string};ai.submits.push(body);ai.jobs.get(body.clientJobId)!.status='running';return json({ok:true,jobId:body.clientJobId,status:'running'});}
  if(path==='/functions/v1/room-ai-segment'){const body=request.postDataJSON() as Record<string,unknown>;ai.segments.push(body);ai.quota.segmentsLeft--;return json({ok:true,mask:ai.tap.toString('base64'),contentType:'image/png'});}
  if(path.startsWith('/storage/v1/object/room-photos/')){
   const key=decodeURIComponent(path.slice('/storage/v1/object/room-photos/'.length));
   if(request.method()==='POST'||request.method()==='PUT'){ai.uploads.set(key,request.postDataBuffer()!);return json({Key:`room-photos/${key}`,Id:'x'});}
   if(request.method()==='GET')return route.fulfill({status:200,headers:{...cors,'content-type':'image/png'},body:ai.result});
  }
  if(path==='/storage/v1/object/room-photos'&&request.method()==='DELETE'){ai.removed.push(...(request.postDataJSON() as {prefixes:string[]}).prefixes);return json([]);}
  return route.fallback();
 });
}
const pixel=(page:Page,selector:string,x:number,y:number)=>page.locator(selector).evaluate((c,[px,py])=>Array.from((c as HTMLCanvasElement).getContext('2d')!.getImageData(px!,py!,1,1).data),[x,y]);
const shot=(name:string)=>test.info().outputPath(name);

async function signedInVisualizer(page:Page,ai:FakeAi,viewport:{width:number;height:number}){
 await page.setViewportSize(viewport);
 const cloud=new FakeCloud();await install(page,cloud);await installAi(page,ai);
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();
 await openTool(page,'Project');await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
 await openTool(page,'Project');await expect(page.getByText('Signed in as Raghvendr Test',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Privacy policy',exact:true})).toHaveAttribute('href',/\/privacy\.html$/);
 await openTool(page,'Room photo');
 const chooser=page.waitForEvent('filechooser');await page.getByRole('region',{name:'Room photo',exact:true}).getByRole('button',{name:'Choose room photo',exact:true}).click();
 await (await chooser).setFiles({name:'room.png',mimeType:'image/png',buffer:await png(page,'room')});
 const view=page.getByRole('dialog',{name:'Room photo'});await expect(view.getByTestId('viz-mask')).toBeVisible();
 await expect(view.getByTestId('ai-quota')).toHaveText('AI previews left this month: 3 of 3');
 return {view,requests};
}

for(const [label,viewport] of [['desktop 1280x800',{width:1280,height:800}],['phone 412x915',{width:412,height:915}]] as const){
 test(`D86 AI preview (${label}): consent, upload, job, and the result changes only the chosen area`,async({page})=>{
  const ai=new FakeAi(await png(page,'ai'),await png(page,'tap')),{view,requests}=await signedInVisualizer(page,ai,viewport);
  await view.getByLabel('Brush size',{exact:true}).fill('20');
  const mask=view.getByTestId('viz-mask'),box=(await mask.boundingBox())!,y=box.y+box.height*.5;
  await page.mouse.move(box.x+box.width*.2,y);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,y,{steps:10});await page.mouse.up();
  await view.getByLabel('This area is',{exact:true}).selectOption('wall');
  await view.getByRole('button',{name:'Paint - mint green',exact:true}).click();
  await view.getByRole('button',{name:'Make AI preview (uses 1)',exact:true}).click();
  // Consent before anything is sent.
  const consent=view.getByTestId('ai-consent');await expect(consent).toBeVisible();
  expect(ai.reserves).toEqual([]);
  await expect(consent.getByRole('link',{name:'Privacy policy',exact:true})).toBeVisible();
  await page.screenshot({path:shot(`consent-${viewport.width}.png`)});
  await consent.getByRole('button',{name:'I agree, continue',exact:true}).click();
  await expect(view.getByTestId('ai-note')).toHaveText('AI preview ready. It was kept as an option.',{timeout:20000});
  // Exactly one job, with the three files in the person's own job folder.
  expect(ai.submits).toHaveLength(1);
  const submit=ai.submits[0] as {clientJobId:string;surface:string;material:{kind:string;label:string;colour:string};files:{photo:string;mask:string;references:string[]}};
  const folder=`00000000-0000-4000-8000-0000000000e2/${submit.clientJobId}`;
  expect(submit).toEqual({clientJobId:submit.clientJobId,surface:'wall',material:{kind:'paint',label:'Paint - mint green',colour:'#cfe3d3'},files:{photo:`${folder}/photo.jpg`,mask:`${folder}/mask.png`,references:[]}});
  expect([...ai.uploads.keys()].sort()).toEqual([`${folder}/mask.png`,`${folder}/photo.jpg`]);
  // The mask the AI got: greyscale PNG at the photo's exact size, white on the stroke, black elsewhere.
  const sent=readMask(pngIn(ai.uploads.get(`${folder}/mask.png`)!));
  expect([sent.width,sent.height]).toEqual([W,H]);
  expect([sent.at(240,200),sent.at(10,10),sent.at(560,30)]).toEqual([255,0,0]);
  // Local composite: inside the stroke the AI colour; outside, the person's own photo byte for byte (the AI result
  // was red everywhere).
  for(const x of [150,240,330])expect(await pixel(page,'[data-testid=viz-result]',x,200)).toEqual([...AI,255]);
  for(const [x,py] of [[10,10],[560,30],[590,390],[300,330],[60,200]] as const)expect(await pixel(page,'[data-testid=viz-result]',x,py)).toEqual(py>=320?[60,70,80,255]:[128,128,128,255]);
  await expect(view.getByText('AI',{exact:true})).toBeVisible();// kept option label
  await expect(view.getByTestId('ai-quota')).toHaveText('AI previews left this month: 2 of 3');
  await expect.poll(()=>ai.removed.length).toBe(2);// the app removed the mask and the result after showing it
  await page.screenshot({path:shot(`ai-result-${viewport.width}.png`)});
  // Nothing ever went anywhere but the app itself and its own Supabase project.
  expect(requests.filter(u=>!u.startsWith('http://127.0.0.1:4185/')&&!u.startsWith(`${CLOUD}/`)&&!u.startsWith('data:')&&!u.startsWith('blob:'))).toEqual([]);
 });
}

test('D86 Tap to select (AI) adds the found surface as one undoable area step',async({page})=>{
 const ai=new FakeAi(await png(page,'ai'),await png(page,'tap')),{view}=await signedInVisualizer(page,ai,{width:1280,height:800});
 await view.getByRole('button',{name:'Tap to select (AI)',exact:true}).click();
 await view.getByTestId('ai-consent').getByRole('button',{name:'I agree, continue',exact:true}).click();
 await expect(view.getByTestId('ai-tap-note')).toHaveText('Tap a wall, floor or object; AI adds it to the area. Taps left today: 20.');
 await view.screenshot({path:shot('ai-controls-1280.png')});
 const mask=view.getByTestId('viz-mask'),box=(await mask.boundingBox())!;
 await page.mouse.click(box.x+box.width*460/W,box.y+box.height*90/H);
 await expect(view.getByTestId('ai-tap-note')).toHaveText('Added to the area. "Undo area change" removes it.');
 expect(ai.segments).toHaveLength(1);
 expect(ai.segments[0]).toMatchObject({x:460,y:90});
 expect(ai.uploads.size).toBe(1);
 expect((await pixel(page,'[data-testid=viz-mask]',460,90))[3]).toBeGreaterThan(100);
 expect(await pixel(page,'[data-testid=viz-mask]',100,300)).toEqual([0,0,0,0]);
 await view.getByRole('button',{name:'Undo area change',exact:true}).click();
 expect(await pixel(page,'[data-testid=viz-mask]',460,90)).toEqual([0,0,0,0]);
});

for(const viewport of [{width:412,height:915},{width:1280,height:800}]){
 test(`D86 the bilingual privacy policy page (${viewport.width}px)`,async({page})=>{
  await page.setViewportSize(viewport);await page.goto('/privacy.html');
  await expect(page.getByRole('heading',{level:1})).toHaveText('GharPlan privacy policy');
  await expect(page.getByText('deleted automatically after 7 days at the latest',{exact:false})).toBeVisible();
  await expect(page.getByRole('heading',{name:'GharPlan निजता नीति (हिंदी सार)'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Delete your GharPlan account'})).toHaveAttribute('href','delete-account.html');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:shot(`privacy-${viewport.width}.png`),fullPage:true});
 });
}
