import {test,expect} from '@playwright/test';
import type {Locator,Page,Route} from '@playwright/test';
import {inflateSync} from 'node:zlib';
import process from 'node:process';
import {openTool} from '../e2e/helpers/tools';

// D92 AI test mode (build flag VITE_ROOM_AI_TEST_MODE=1) against an in-test stand-in for the app's own
// /api/room-ai/* functions (page.route). No request ever reaches OpenAI or fal.ai: the "AI result" is a solid red JPEG
// made in the page, so the local composite can be checked. Claude-authored builder test, not an independent fixture.
const W=600,H=400,AI=[200,30,30],CODE='tester-code-2026';
// aiSize(600, 400): s = √(655360/240000) = 1.6525 → 991.5 × 661.0 → 992 × 656 = 650 752 < 655 360 → 992 × 672.
const AIW=992,AIH=672;
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});
const shot=(name:string)=>process.env.AITEST_SHOTS?`${process.env.AITEST_SHOTS}/${name}`:test.info().outputPath(name);

/** Pictures drawn in the page: the room (grey 128 with a dark band), the AI answer (solid red JPEG), a SAM-style mask. */
async function picture(page:Page,kind:'room'|'ai'|'tap'):Promise<Buffer>{
 const url=await page.evaluate(({kind,w,h,aw,ah,ai})=>{const c=document.createElement('canvas');c.width=kind==='ai'?aw:w;c.height=kind==='ai'?ah:h;const g=c.getContext('2d')!;
  if(kind==='room'){g.fillStyle='rgb(128,128,128)';g.fillRect(0,0,w,h);g.fillStyle='rgb(60,70,80)';g.fillRect(0,h*.8,w,h*.2);return c.toDataURL('image/png');}
  if(kind==='ai'){g.fillStyle=`rgb(${ai.join(',')})`;g.fillRect(0,0,aw,ah);return c.toDataURL('image/jpeg',.95);}
  g.fillStyle='#000';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.fillRect(400,40,120,100);return c.toDataURL('image/png');},{kind,w:W,h:H,aw:AIW,ah:AIH,ai:AI});
 return Buffer.from(url.split(',')[1]!,'base64');
}
interface Part {readonly name:string;readonly filename:string|null;readonly type:string|null;readonly data:Buffer}
/** The parts of a multipart/form-data body. */
function multipart(body:Buffer,contentType:string):Part[]{
 const boundary=/boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType)!,marker=Buffer.from(`--${boundary[1]??boundary[2]}`),out:Part[]=[];
 let at=body.indexOf(marker);
 while(at>=0){
  const start=at+marker.length;if(body.subarray(start,start+2).toString()==='--')break;
  const next=body.indexOf(marker,start),chunk=body.subarray(start+2,next-2),split=chunk.indexOf('\r\n\r\n'),head=chunk.subarray(0,split).toString('utf8');
  out.push({name:/name="([^"]*)"/.exec(head)![1]!,filename:/filename="([^"]*)"/.exec(head)?.[1]??null,type:/content-type:\s*([^\r\n]+)/i.exec(head)?.[1]??null,data:Buffer.from(chunk.subarray(split+4))});
  at=next;
 }
 return out;
}
/** The 8-bit RGBA PNG the app writes (filter 0 rows): size, colour type and the alpha at a pixel. */
function readRgba(file:Buffer){
 let at=8,width=0,height=0,colour=-1;const idat:Buffer[]=[];
 while(at<file.length){const n=file.readUInt32BE(at),type=file.toString('latin1',at+4,at+8),data=file.subarray(at+8,at+8+n);if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);colour=data[9]!;}if(type==='IDAT')idat.push(data);at+=12+n;}
 const raw=inflateSync(Buffer.concat(idat));
 return {width,height,colour,alpha:(x:number,y:number)=>raw[y*(width*4+1)+1+x*4+3]!};
}
const pngSize=(file:Buffer)=>[file.readUInt32BE(16),file.readUInt32BE(20)];
class FakeApi {
 edits:{code:string;parts:Part[]}[]=[];segments:{code:string;parts:Part[]}[]=[];
 #release:(()=>void)|null=null;#held:Promise<void>|null=null;
 constructor(readonly result:Buffer,readonly tap:Buffer){}
 hold(){this.#held=new Promise(r=>{this.#release=r;});}
 release(){this.#release?.();this.#held=null;}
 get held(){return this.#held;}
}
async function install(page:Page,api:FakeApi){
 const answer=(route:Route,status:number,body:unknown)=>route.fulfill({status,headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(()=>undefined);
 await page.route('**/api/room-ai/edit',async route=>{
  const request=route.request(),code=request.headers()['x-room-ai-code']??'';
  api.edits.push({code,parts:multipart(request.postDataBuffer()!,request.headers()['content-type']!)});
  if(code!==CODE)return answer(route,401,{ok:false,code:'WRONG_CODE'});
  await api.held;
  return answer(route,200,{ok:true,image:api.result.toString('base64'),width:AIW,height:AIH});
 });
 await page.route('**/api/room-ai/segment',async route=>{
  const request=route.request(),code=request.headers()['x-room-ai-code']??'';
  api.segments.push({code,parts:multipart(request.postDataBuffer()!,request.headers()['content-type']!)});
  if(code!==CODE)return answer(route,401,{ok:false,code:'WRONG_CODE'});
  return answer(route,200,{ok:true,mask:api.tap.toString('base64')});
 });
}
const pixel=(page:Page,selector:string,x:number,y:number)=>page.locator(selector).evaluate((c,[px,py])=>Array.from((c as HTMLCanvasElement).getContext('2d')!.getImageData(px!,py!,1,1).data),[x,y]);

async function visualizer(page:Page,api:FakeApi,viewport:{width:number;height:number}){
 await page.setViewportSize(viewport);await install(page,api);
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();
 await openTool(page,'Room photo');
 const chooser=page.waitForEvent('filechooser');await page.getByRole('region',{name:'Room photo',exact:true}).getByRole('button',{name:'Choose room photo',exact:true}).click();
 await (await chooser).setFiles({name:'room.png',mimeType:'image/png',buffer:await picture(page,'room')});
 const view=page.getByRole('dialog',{name:'Room photo'});await expect(view.getByTestId('viz-mask')).toBeVisible();
 await expect(view.getByTestId('viz-ai-test')).toContainText('AI test mode');
 return {view,requests};
}
async function brushLine(page:Page,view:Locator){
 await view.getByLabel('Brush size',{exact:true}).fill('20');
 const mask=view.getByTestId('viz-mask'),box=(await mask.boundingBox())!,y=box.y+box.height*.5;
 await page.mouse.move(box.x+box.width*.2,y);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,y,{steps:10});await page.mouse.up();
}

for(const [label,viewport] of [['desktop 1280x800',{width:1280,height:800}],['phone 412x915',{width:412,height:915}]] as const){
 test(`D92 AI test mode (${label}): code → consent → wait → AI result only inside the brushed area`,async({page})=>{
  const api=new FakeApi(await picture(page,'ai'),await picture(page,'tap')),{view,requests}=await visualizer(page,api,viewport),w=viewport.width;
  await brushLine(page,view);
  await view.getByLabel('This area is',{exact:true}).selectOption('wall');
  await view.getByRole('button',{name:'Paint - mint green',exact:true}).click();
  await view.getByRole('button',{name:'Make AI preview',exact:true}).click();
  // 1. The access code, before anything is sent.
  const prompt=view.getByTestId('ai-code');await expect(prompt).toBeVisible();
  await page.screenshot({path:shot(`code-prompt-${w}.png`)});
  await prompt.getByLabel('Access code',{exact:true}).fill(CODE);
  await prompt.getByRole('button',{name:'Use this code',exact:true}).click();
  // 2. Consent with the test-mode providers.
  const consent=view.getByTestId('ai-consent');await expect(consent).toContainText('to OpenAI');
  await expect(consent).toContainText('fal.ai');
  await expect(consent).toContainText('GharPlan\'s own server stores none of these.');
  expect(api.edits).toEqual([]);
  await page.screenshot({path:shot(`consent-${w}.png`)});
  api.hold();
  await consent.getByRole('button',{name:'I agree, continue',exact:true}).click();
  // 3. The wait (the stand-in holds the answer): a clear message and a Cancel button.
  await expect(view.getByTestId('ai-test-note')).toHaveText('The AI is working. This can take up to 2 minutes. Keep this screen open.');
  await expect(view.getByRole('button',{name:'Cancel AI preview',exact:true})).toBeVisible();
  await expect(view.getByRole('button',{name:'Make AI preview',exact:true})).toBeDisabled();
  await view.getByTestId('ai-test-note').scrollIntoViewIfNeeded();
  await page.screenshot({path:shot(`waiting-${w}.png`)});
  // Exactly one request, with the code, the material fields, the room PNG and OpenAI's alpha mask at the AI size.
  expect(api.edits).toHaveLength(1);
  const sent=api.edits[0]!,field=(name:string)=>sent.parts.find(p=>p.name===name);
  expect(sent.code).toBe(CODE);
  expect(sent.parts.map(p=>p.name)).toEqual(['room','mask','kind','surface','label','colour']);
  expect([field('kind')!.data.toString(),field('surface')!.data.toString(),field('label')!.data.toString(),field('colour')!.data.toString()]).toEqual(['paint','wall','Paint - mint green','#cfe3d3']);
  const room=field('room')!,maskPart=field('mask')!;
  expect([room.type,room.data.subarray(1,4).toString()]).toEqual(['image/png','PNG']);
  expect(pngSize(room.data)).toEqual([AIW,AIH]);
  const mask=readRgba(maskPart.data);
  expect([mask.width,mask.height,mask.colour]).toEqual([AIW,AIH,6]);
  // The stroke at photo (240, 200) → AI (396.8, 336): transparent; the corners and the band stay opaque.
  const toAi=(x:number,y:number):[number,number]=>[Math.floor(x*AIW/W),Math.floor(y*AIH/H)];
  expect([mask.alpha(...toAi(240,200)),mask.alpha(...toAi(150,200)),mask.alpha(...toAi(10,10)),mask.alpha(...toAi(560,30)),mask.alpha(...toAi(300,330))]).toEqual([0,0,255,255,255]);
  api.release();
  await expect(view.getByTestId('ai-test-note')).toHaveText('AI preview ready. It was kept as an option.',{timeout:20000});
  // Local composite: inside the stroke the AI colour (JPEG, so within 3 levels); outside, the photo byte for byte.
  for(const x of [150,240,330]){const p=await pixel(page,'[data-testid=viz-result]',x,200);p.slice(0,3).forEach((v,i)=>expect(Math.abs(v-AI[i]!),`x=${x}`).toBeLessThanOrEqual(3));expect(p[3]).toBe(255);}
  for(const [x,py] of [[10,10],[560,30],[590,390],[300,330],[60,200]] as const)expect(await pixel(page,'[data-testid=viz-result]',x,py)).toEqual(py>=320?[60,70,80,255]:[128,128,128,255]);
  await expect(view.getByText('AI',{exact:true})).toBeVisible();
  await expect(view.getByRole('button',{name:'Forget code',exact:true})).toBeVisible();
  await view.getByTestId('ai-test-note').scrollIntoViewIfNeeded();
  await page.screenshot({path:shot(`ai-result-${w}.png`)});
  // Nothing went anywhere but the app itself (its /api functions included).
  expect(requests.filter(u=>!u.startsWith('http://127.0.0.1:4186/')&&!u.startsWith('data:')&&!u.startsWith('blob:'))).toEqual([]);
 });
}

test('D92 a wrong access code is explained and asked again; the right one then works',async({page})=>{
 const api=new FakeApi(await picture(page,'ai'),await picture(page,'tap')),{view}=await visualizer(page,api,{width:412,height:915});
 await brushLine(page,view);
 await view.getByRole('button',{name:'Make AI preview',exact:true}).click();
 await view.getByTestId('ai-code').getByLabel('Access code',{exact:true}).fill('wrong-code-123');
 await view.getByTestId('ai-code').getByRole('button',{name:'Use this code',exact:true}).click();
 await view.getByTestId('ai-consent').getByRole('button',{name:'I agree, continue',exact:true}).click();
 const prompt=view.getByTestId('ai-code');
 await expect(prompt.getByTestId('ai-code-wrong')).toHaveText('That access code is not right. Check it and type it again.');
 expect(await page.evaluate(()=>localStorage.getItem('gharplan.roomAi.testCode'))).toBeNull();
 await page.screenshot({path:shot('wrong-code-412.png')});
 await prompt.getByLabel('Access code',{exact:true}).fill(CODE);
 await prompt.getByRole('button',{name:'Use this code',exact:true}).click();
 await expect(view.getByTestId('ai-consent')).toHaveCount(0);// consent is asked once per device
 await expect(view.getByTestId('ai-test-note')).toHaveText('AI preview ready. It was kept as an option.',{timeout:20000});
 expect(api.edits.map(e=>e.code)).toEqual(['wrong-code-123',CODE]);
});

test('D92 Cancel stops the wait; nothing is retried',async({page})=>{
 const api=new FakeApi(await picture(page,'ai'),await picture(page,'tap')),{view}=await visualizer(page,api,{width:1280,height:800});
 await page.evaluate(code=>{localStorage.setItem('gharplan.roomAi.testCode',code);localStorage.setItem('gharplan.roomAi.testConsent.v1',new Date().toISOString());},CODE);
 await brushLine(page,view);
 api.hold();
 await view.getByRole('button',{name:'Make AI preview',exact:true}).click();
 await expect(view.getByTestId('ai-code')).toHaveCount(0);
 await expect(view.getByTestId('ai-test-note')).toHaveText('The AI is working. This can take up to 2 minutes. Keep this screen open.');
 await view.getByRole('button',{name:'Cancel AI preview',exact:true}).click();
 await expect(view.getByTestId('ai-test-note')).toHaveText('Stopped. If the photo was already sent, the AI may still have been used once.');
 await expect(view.getByRole('button',{name:'Make AI preview',exact:true})).toBeEnabled();
 api.release();
 await page.waitForTimeout(500);
 expect(api.edits).toHaveLength(1);
 await expect(view.getByTestId('viz-result')).toHaveCount(0);
});

test('D92 Tap to select (AI) unions the found surface as one undoable area step',async({page})=>{
 const api=new FakeApi(await picture(page,'ai'),await picture(page,'tap')),{view}=await visualizer(page,api,{width:1280,height:800});
 await view.getByRole('button',{name:'Tap to select (AI)',exact:true}).click();
 await view.getByTestId('ai-code').getByLabel('Access code',{exact:true}).fill(CODE);
 await view.getByTestId('ai-code').getByRole('button',{name:'Use this code',exact:true}).click();
 await view.getByTestId('ai-consent').getByRole('button',{name:'I agree, continue',exact:true}).click();
 await expect(view.getByTestId('ai-tap-note')).toHaveText('Tap a wall, floor or object; AI adds it to the area.');
 const mask=view.getByTestId('viz-mask'),box=(await mask.boundingBox())!;
 await page.mouse.click(box.x+box.width*460/W,box.y+box.height*90/H);
 await expect(view.getByTestId('ai-tap-note')).toHaveText('Added to the area. "Undo area change" removes it.');
 expect(api.segments).toHaveLength(1);
 const parts=api.segments[0]!.parts,value=(n:string)=>parts.find(p=>p.name===n)!.data.toString();
 expect([api.segments[0]!.code,value('x'),value('y'),parts.find(p=>p.name==='room')!.type]).toEqual([CODE,'460','90','image/jpeg']);
 expect((await pixel(page,'[data-testid=viz-mask]',460,90))[3]).toBeGreaterThan(100);
 expect((await pixel(page,'[data-testid=viz-mask]',405,45))[3]).toBeGreaterThan(100);
 expect(await pixel(page,'[data-testid=viz-mask]',100,300)).toEqual([0,0,0,0]);
 await view.screenshot({path:shot('tap-select-1280.png')});
 await view.getByRole('button',{name:'Undo area change',exact:true}).click();
 expect(await pixel(page,'[data-testid=viz-mask]',460,90)).toEqual([0,0,0,0]);
});
