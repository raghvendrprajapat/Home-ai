import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {VIEWPORTS,start,exportDoc,open3d,chooseQuality,threeView,numAttr,polygon,area,inside,activeFloorId} from './helpers';
import type {Doc,Furniture} from './helpers';

// D76 M1 "realistic 3D" acceptance tests, written from docs/specs/phase1-quality.md only.
test.use({viewport:VIEWPORTS.desktop,actionTimeout:15000});

const MiB=1024*1024;
type CatalogAsset={id:string;version:number;name_en:string;category:string};
const catalog=(JSON.parse(readFileSync('apps/web/public/catalog/catalog.json','utf8')) as {assets:CatalogAsset[]}).assets;
const catalogAsset=(item:Furniture)=>catalog.find(a=>a.id===item.assetId&&a.version===item.assetVersion);
const KINDS:[string,RegExp][]=[['sofa',/sofa/i],['coffee table',/coffee table/i],['TV unit',/\btv unit\b/i],['bed',/\bbed\b/i],['wardrobe',/wardrobe/i]];

/** Waits until every furniture model listed in the 3D view is ready, paging through the list if it is paged. */
async function modelPhases(page:Page){
  const view=threeView(page),seen=new Map<string,{phase:string;text:string}>(),previous=view.getByRole('button',{name:'Previous page',exact:true});
  for(let guard=0;guard<20&&await previous.count()&&!await previous.isDisabled();guard++)await previous.evaluate(b=>(b as HTMLButtonElement).click());
  for(let guard=0;guard<20;guard++){
    for(const entry of await view.locator('[data-model-phase]').all()){
      const id=(await entry.getAttribute('data-model-id'))??`#${seen.size}`;
      seen.set(id,{phase:(await entry.getAttribute('data-model-phase'))??'',text:(await entry.textContent())??''});
    }
    const next=view.getByRole('button',{name:'Next page',exact:true});
    if(!await next.count()||await next.isDisabled())break;
    await next.evaluate(b=>(b as HTMLButtonElement).click());
  }
  return seen;
}

async function waitForModels(page:Page,expected:number){
  await expect.poll(async()=>{const phases=[...(await modelPhases(page)).values()];return {count:phases.length,ready:phases.filter(p=>p.phase==='ready').length};},{timeout:45000}).toEqual({count:expected,ready:expected});
}
/** Waits until every listed furniture model has finished loading (ready or failed); R3 checks readiness itself. */
async function waitForModelsSettled(page:Page,expected:number){
  await expect.poll(async()=>{const phases=[...(await modelPhases(page)).values()];return {count:phases.length,settled:phases.filter(p=>p.phase!==''&&p.phase!=='loading').length};},{timeout:45000}).toEqual({count:expected,settled:expected});
}

test('R3 the sample opens furnished with real catalog models (sofa, coffee table, TV unit, bed, wardrobe) in both rooms',async({page})=>{
  // R3: the bundled sample opens with real catalog models in both rooms.
  await start(page);
  const doc=await exportDoc(page),floor=activeFloorId(doc),items=doc.furniture.filter(f=>f.floorId===floor);
  for(const [kind,pattern] of KINDS){
    const found=items.filter(item=>{const asset=catalogAsset(item);return asset!==undefined&&pattern.test(asset.name_en);});
    expect(found.length,`sample has a ${kind} from the catalog`).toBeGreaterThan(0);
  }
  const rooms=doc.rooms.filter(r=>r.floorId===floor);
  expect(rooms.length).toBeGreaterThanOrEqual(2);
  for(const room of rooms){
    const poly=polygon(doc,room),real=items.filter(item=>catalogAsset(item)&&inside(poly,[item.position.x,item.position.y]));
    expect(real.length,`room "${room.name}" holds at least one real catalog model`).toBeGreaterThan(0);
  }
});

test('R3 in 3D every furniture item reaches data-model-phase="ready" and no placeholder box remains',async({page})=>{
  // R3: every furniture item reaches ready; no grey placeholder boxes once loading finishes.
  await start(page);
  const doc=await exportDoc(page),count=doc.furniture.filter(f=>f.floorId===activeFloorId(doc)).length;
  expect(count).toBeGreaterThanOrEqual(5);
  await open3d(page);
  await waitForModels(page,count);
  // A model that falls back to a measured/dimension box says so in its status line; none may.
  for(const [id,state] of await modelPhases(page))expect(state.text,`model ${id} status`).not.toMatch(/box|dimension|unavailable|cannot|नाप/i);
});

test('R1/R2 mid tier: ACES, HDRI environment, shadows, at least 3 textured materials, texture memory within 64 MiB and at most 200 draw calls',async({page})=>{
  // R1/R2 attribute table on mid with the furnished sample.
  await start(page);
  const doc=await exportDoc(page),count=doc.furniture.filter(f=>f.floorId===activeFloorId(doc)).length;
  await open3d(page);
  await chooseQuality(page,'mid');
  const view=threeView(page);
  await waitForModelsSettled(page,count);
  await expect(view).toHaveAttribute('data-tone-mapping','aces');
  await expect(view).toHaveAttribute('data-environment',/^hdri:\S+$/);
  await expect(view).toHaveAttribute('data-shadows','on');
  await expect.poll(()=>numAttr(view,'data-textured-materials'),{timeout:30000}).toBeGreaterThanOrEqual(3);
  await expect(view).toHaveAttribute('data-texture-bytes',/^\d+$/);
  const bytes=await numAttr(view,'data-texture-bytes');
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThanOrEqual(64*MiB);
  await expect.poll(()=>numAttr(view,'data-draw-calls')).toBeGreaterThan(0);
  expect(await numAttr(view,'data-draw-calls')).toBeLessThanOrEqual(200);
});

test('R2 low tier: no shadows, no environment map and no textures',async({page})=>{
  // R2: on low no shadows, no environment map, no textures; data-texture-bytes 0 and data-textured-materials 0.
  await start(page);
  await open3d(page);
  await chooseQuality(page,'low');
  const view=threeView(page);
  await expect(view).toHaveAttribute('data-tone-mapping',/^(aces|none)$/);
  await expect(view).toHaveAttribute('data-environment','none');
  await expect(view).toHaveAttribute('data-shadows','off');
  await expect(view).toHaveAttribute('data-textured-materials','0');
  await expect(view).toHaveAttribute('data-texture-bytes','0');
});

test('R1/R2 high (or the tier actually in use when high is refused) keeps the realistic settings and the texture budget',async({page})=>{
  // data-quality-tier is the tier actually in use; budgets: 64 MiB on mid, 96 MiB on high.
  await start(page);
  await open3d(page);
  await chooseQuality(page,'high');
  const view=threeView(page);
  await expect.poll(()=>view.getAttribute('data-quality-tier')).toMatch(/^(mid|high)$/);
  const tier=await view.getAttribute('data-quality-tier');
  await expect(view).toHaveAttribute('data-tone-mapping','aces');
  await expect(view).toHaveAttribute('data-environment',/^hdri:\S+$/);
  await expect(view).toHaveAttribute('data-shadows','on');
  await expect.poll(()=>numAttr(view,'data-textured-materials'),{timeout:30000}).toBeGreaterThanOrEqual(3);
  const bytes=await numAttr(view,'data-texture-bytes');
  expect(Number.isInteger(bytes)).toBe(true);
  expect(bytes).toBeLessThanOrEqual((tier==='high'?96:64)*MiB);
});

// ---- R1 pixel check -------------------------------------------------------------------------------------------
// Same camera pose rendered on mid and on low; crop the floor of the largest room; the mean absolute difference
// between horizontally adjacent pixels on mid must be at least 1.5x the low value.
// The crop is computed geometrically: each canvas pixel's view ray (from data-camera-pose, with the 3D view's
// existing 45° vertical field of view, as used by tests/e2e/surface-controls.spec.ts) is intersected with the floor
// plane. A pixel counts only when that point lies inside the largest room at least 350 mm from its boundary, the ray
// is not blocked by any wall or furniture box, and no page element covers that pixel of the canvas.
type Box=[number,number,number,number,number,number];
function occluders(doc:Doc,floor:string,floorElevation:number):Box[]{
  const boxes:Box[]=[],m=1000;
  for(const w of doc.walls.filter(w=>w.floorId===floor)){
    const a=doc.junctions.find(j=>j.id===w.a)!,b=doc.junctions.find(j=>j.id===w.b)!,pad=w.thickness/2+50;
    boxes.push([(Math.min(a.x,b.x)-pad)/m,(floorElevation-50)/m,(Math.min(a.y,b.y)-pad)/m,(Math.max(a.x,b.x)+pad)/m,(floorElevation+w.height+50)/m,(Math.max(a.y,b.y)+pad)/m]);
  }
  for(const f of doc.furniture.filter(f=>f.floorId===floor)){
    const r=f.rotationDeg*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),hx=c*f.size.w/2+s*f.size.d/2+100,hy=s*f.size.w/2+c*f.size.d/2+100;
    boxes.push([(f.position.x-hx)/m,(floorElevation-50)/m,(f.position.y-hy)/m,(f.position.x+hx)/m,(floorElevation+f.elevation+f.size.h+100)/m,(f.position.y+hy)/m]);
  }
  return boxes;
}
async function stableCanvasShot(page:Page){
  const canvas=threeView(page).locator('canvas').first();
  let last=await canvas.screenshot();
  for(let i=0;i<20;i++){await page.waitForTimeout(400);const next=await canvas.screenshot();if(next.equals(last))return next;last=next;}
  return last;
}
async function pose(page:Page){
  // Waits for the camera to come to rest (the same pose twice, 300 ms apart).
  const read=async()=>(await threeView(page).getAttribute('data-camera-pose'))??'';
  let last=await read();
  for(let i=0;i<30;i++){await page.waitForTimeout(300);const next=await read();if(next===last)break;last=next;}
  return JSON.parse(last) as {position:number[];target:number[]};
}

test('R1 pixel check: the largest room floor on mid has at least 1.5x the horizontal pixel detail of low (same camera pose)',async({page})=>{
  test.setTimeout(120000);
  await start(page);
  const doc=await exportDoc(page),floorId=activeFloorId(doc),floor=doc.floors.find(f=>f.id===floorId)!;
  const rooms=doc.rooms.filter(r=>r.floorId===floorId).sort((a,b)=>area(polygon(doc,b))-area(polygon(doc,a))),largest=rooms[0]!;
  const count=doc.furniture.filter(f=>f.floorId===floorId).length;
  await open3d(page);
  await chooseQuality(page,'low');
  await waitForModelsSettled(page,count);
  // A steeper, closer view (existing keyboard camera controls) so that more of the floor is visible over the walls.
  const canvas=threeView(page).locator('canvas').first();
  await canvas.focus();
  for(let i=0;i<12;i++)await page.keyboard.press('ArrowUp');
  for(let i=0;i<4;i++)await page.keyboard.press('+');
  const lowPose=await pose(page),low=await stableCanvasShot(page);
  expect(await pose(page)).toEqual(lowPose);
  await chooseQuality(page,'mid');
  await waitForModelsSettled(page,count);
  let midPose=await pose(page),mid=await stableCanvasShot(page);
  expect(midPose,'same camera pose for both renders').toEqual(lowPose);
  const args={poly:polygon(doc,largest),floorY:floor.elevation/1000,boxes:occluders(doc,floorId,floor.elevation)};
  const measure=(midShot:Buffer)=>page.evaluate(async({low,mid,pose,poly,floorY,boxes})=>{
    const canvas=document.querySelector('[data-testid="three-view"] canvas') as HTMLCanvasElement,rect=canvas.getBoundingClientRect();
    const decode=async(b64:string)=>{const bmp=await createImageBitmap(await(await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d')!;ctx.drawImage(bmp,0,0);const d=ctx.getImageData(0,0,bmp.width,bmp.height);bmp.close();return d;};
    const a=await decode(low),b=await decode(mid),W=a.width,H=a.height;
    if(b.width!==W||b.height!==H)throw Error('render sizes differ');
    const p=pose.position,f0=pose.target.map((v,i)=>v-p[i]!),fl=Math.hypot(...f0),f=f0.map(v=>v/fl);
    const r0=[-f[2]!,0,f[0]!],rl=Math.hypot(...r0),r=r0.map(v=>v/rl),up=[r[1]!*f[2]!-r[2]!*f[1]!,r[2]!*f[0]!-r[0]!*f[2]!,r[0]!*f[1]!-r[1]!*f[0]!];
    const t=Math.tan(Math.PI/8),aspect=rect.width/rect.height,sx=rect.width/W,sy=rect.height/H;
    const edgeDistance=(x:number,y:number)=>{let d=Infinity;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i]!,[x2,y2]=poly[(i+1)%poly.length]!,dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/l)):0;d=Math.min(d,Math.hypot(x-x1-u*dx,y-y1-u*dy));}return d;};
    const inPoly=(x:number,y:number)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i]!,[xj,yj]=poly[j]!;if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;};
    const blocked=(d:number[],limit:number)=>boxes.some(box=>{let lo=0,hi=limit;for(let k=0;k<3;k++){const o=p[k]!,v=d[k]!,mn=box[k]!,mx=box[k+3]!;if(Math.abs(v)<1e-12){if(o<mn||o>mx)return false;continue;}let t1=(mn-o)/v,t2=(mx-o)/v;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;}return true;});
    const mask=new Uint8Array(W*H);let pixels=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const nx=((x+.5)*sx/rect.width)*2-1,ny=1-((y+.5)*sy/rect.height)*2,d=[0,1,2].map(k=>f[k]!+r[k]!*nx*t*aspect+up[k]!*ny*t*1);
      if(d[1]!>=-1e-9)continue;
      const s=(floorY-p[1]!)/d[1]!;if(s<=0)continue;
      const px=(p[0]!+d[0]!*s)*1000,py=(p[2]!+d[2]!*s)*1000;
      if(!inPoly(px,py)||edgeDistance(px,py)<350||blocked(d,s))continue;
      if(document.elementFromPoint(rect.left+(x+.5)*sx,rect.top+(y+.5)*sy)!==canvas)continue;
      mask[y*W+x]=1;pixels++;
    }
    const detail=(img:ImageData)=>{let sum=0,n=0;for(let y=0;y<H;y++)for(let x=0;x<W-1;x++){const i=y*W+x;if(!mask[i]||!mask[i+1])continue;const o=i*4;sum+=(Math.abs(img.data[o]!-img.data[o+4]!)+Math.abs(img.data[o+1]!-img.data[o+5]!)+Math.abs(img.data[o+2]!-img.data[o+6]!))/3;n++;}return n?sum/n:NaN;};
    const view=document.createElement('canvas');view.width=W;view.height=H;const vctx=view.getContext('2d')!,shown=new ImageData(new Uint8ClampedArray(b.data),W,H);
    for(let i=0;i<W*H;i++)if(!mask[i]){shown.data[i*4]=shown.data[i*4]!/4;shown.data[i*4+1]=shown.data[i*4+1]!/4;shown.data[i*4+2]=shown.data[i*4+2]!/4;}
    vctx.putImageData(shown,0,0);
    return {pixels,width:W,height:H,low:detail(a),mid:detail(b),crop:view.toDataURL('image/png')};
  },{low:low.toString('base64'),mid:midShot.toString('base64'),pose:lowPose,...args});
  // Textures may still be streaming in: re-render the mid shot until the check holds or 40 s pass.
  let result=await measure(mid);
  for(const until=Date.now()+40000;!(result.mid>=1.5*result.low&&result.mid>result.low)&&Date.now()<until;){
    await page.waitForTimeout(1000);midPose=await pose(page);mid=await stableCanvasShot(page);result=await measure(mid);
  }
  expect(midPose,'same camera pose for both renders').toEqual(lowPose);
  await test.info().attach('R1-floor-crop-mid.png',{body:Buffer.from(result.crop.split(',')[1]!,'base64'),contentType:'image/png'});
  await test.info().attach('R1-low.png',{body:low,contentType:'image/png'});
  test.info().annotations.push({type:'R1-pixel-check',description:JSON.stringify({room:largest.name,pixels:result.pixels,width:result.width,height:result.height,low:result.low,mid:result.mid})});
  expect(result.pixels,'enough visible floor of the largest room in the crop').toBeGreaterThanOrEqual(2000);
  expect(result.mid).toBeGreaterThan(result.low);
  expect(result.mid).toBeGreaterThanOrEqual(1.5*result.low);
});

// ---- R4 auto quality ------------------------------------------------------------------------------------------
type Device={memory?:number|'unreported';cores:number};
async function fakeDevice(page:Page,device:Device){
  await page.addInitScript(({memory,cores})=>{
    Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{configurable:true,get:()=>cores});
    if(memory==='unreported'){delete (Navigator.prototype as unknown as {deviceMemory?:number}).deviceMemory;delete (navigator as unknown as {deviceMemory?:number}).deviceMemory;}
    else Object.defineProperty(Navigator.prototype,'deviceMemory',{configurable:true,get:()=>memory});
  },{memory:device.memory??'unreported',cores:device.cores});
}
async function maxTextureSize(page:Page){
  return page.evaluate(()=>{const c=document.createElement('canvas'),gl=(c.getContext('webgl2')??c.getContext('webgl')) as WebGLRenderingContext|null;if(!gl)return 0;const v=gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;gl.getExtension('WEBGL_lose_context')?.loseContext();return v;});
}

test('R4 auto picks mid on a device with at least 4 GB and 4 cores (GPU allows 4096 px textures); the person can override to low',async({page})=>{
  // R4: "auto" -> mid when 4096 px textures, >= 4 GB and >= 4 cores; the tier can always be overridden.
  await fakeDevice(page,{memory:8,cores:8});
  await start(page);
  const big=(await maxTextureSize(page))>=4096,view=await open3d(page);
  await expect.poll(()=>view.getAttribute('data-quality-tier'),{timeout:30000}).toBe(big?'mid':'low');
  await chooseQuality(page,big?'low':'mid');
  await expect(view).toHaveAttribute('data-quality-tier',big?'low':'mid');
});

test('R4 auto picks mid when memory is not reported but 4 cores are (where reported)',async({page})=>{
  // R4: the memory/core rule applies "where reported".
  await fakeDevice(page,{memory:'unreported',cores:4});
  await start(page);
  const big=(await maxTextureSize(page))>=4096,view=await open3d(page);
  expect(await page.evaluate(()=>'deviceMemory' in navigator)).toBe(false);
  await expect.poll(()=>view.getAttribute('data-quality-tier'),{timeout:30000}).toBe(big?'mid':'low');
});

test('R4 auto picks low on a device reporting less than 4 GB; the person can override to mid',async({page})=>{
  // R4: otherwise auto picks low; override always possible.
  await fakeDevice(page,{memory:2,cores:8});
  await start(page);
  const view=await open3d(page);
  await expect.poll(()=>view.getAttribute('data-quality-tier'),{timeout:30000}).toBe('low');
  await chooseQuality(page,'mid');
  await expect(view).toHaveAttribute('data-quality-tier','mid');
});

test('R4 auto picks low on a device reporting fewer than 4 cores',async({page})=>{
  // R4: otherwise auto picks low.
  await fakeDevice(page,{memory:8,cores:2});
  await start(page);
  const view=await open3d(page);
  await expect.poll(()=>view.getAttribute('data-quality-tier'),{timeout:30000}).toBe('low');
});

// ---- R5 licences ----------------------------------------------------------------------------------------------
// The contract does not fix where rights records live, so a record is found by the file's SHA-256 anywhere in the
// repository's text files; the text around that hash must also give a source URL, the CC0 licence and a date checked.
const TEXTURE_FILE=/\.(hdr|exr|ktx2|basis|jpe?g|png|webp|avif)$/i;
const NOT_A_TEXTURE=/(icon|favicon|logo|splash|screenshot)/i;
function repoTextFiles(){
  const listed=execFileSync('git',['ls-files','-co','--exclude-standard'],{encoding:'utf8',maxBuffer:64*MiB}).split('\n').filter(Boolean);
  return listed.filter(f=>/\.(json|jsonl|md|csv|tsv|ya?ml|txt|mjs|js|ts)$/i.test(f)&&!f.startsWith('tests/acceptance/')&&!f.includes('node_modules/')&&existsSync(f)&&statSync(f).size<8*MiB).map(f=>({file:f,text:readFileSync(f,'utf8')}));
}
function recordProblem(corpus:{file:string;text:string}[],sha:string){
  const hits=corpus.filter(c=>c.text.toLowerCase().includes(sha));
  if(!hits.length)return 'no rights record names its SHA-256';
  for(const hit of hits){
    const at=hit.text.toLowerCase().indexOf(sha),near=hit.text.slice(Math.max(0,at-1500),at+1500);
    if(/CC0/i.test(near)&&/https?:\/\/\S+/.test(near)&&/\b\d{4}-\d{2}-\d{2}\b/.test(near))return null;
  }
  return `record in ${hits.map(h=>h.file).join(', ')} lacks source URL, CC0 licence or date checked`;
}
function shippedTextureFiles(){
  const out:string[]=[],walk=(dir:string)=>{if(!existsSync(dir))return;for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else if(TEXTURE_FILE.test(name)&&!NOT_A_TEXTURE.test(name))out.push(p);}};
  walk('apps/web/public');walk('apps/web/dist-e2e');
  return out;
}

test('R5 every texture and HDRI file the mid scene loads, and every one shipped with the app, has a CC0 rights record; the asset check passes',async({page})=>{
  // R5: each texture/HDRI file has source URL, licence CC0, author or site, date checked and SHA-256.
  const loaded=new Map<string,string>();
  page.on('response',async response=>{
    const url=response.url(),type=response.headers()['content-type']??'',path=url.split(/[?#]/)[0]!;
    if(url.startsWith('data:')||url.startsWith('blob:')||/svg/i.test(type)||/\.svg$/i.test(path))return;
    if(!TEXTURE_FILE.test(path)&&!/^image\/|radiance|ktx/i.test(type))return;
    try{loaded.set(path,createHash('sha256').update(await response.body()).digest('hex'));}catch{/* redirected or aborted */}
  });
  await start(page);
  await open3d(page);
  await chooseQuality(page,'mid');
  await expect.poll(()=>numAttr(threeView(page),'data-textured-materials'),{timeout:30000}).toBeGreaterThanOrEqual(3);
  await expect.poll(()=>loaded.size,{timeout:30000}).toBeGreaterThanOrEqual(3);
  const corpus=repoTextFiles(),problems:string[]=[];
  for(const [url,sha] of loaded){const problem=recordProblem(corpus,sha);if(problem)problems.push(`${url}: ${problem}`);}
  for(const file of shippedTextureFiles()){const problem=recordProblem(corpus,createHash('sha256').update(readFileSync(file)).digest('hex'));if(problem)problems.push(`${file}: ${problem}`);}
  test.info().annotations.push({type:'R5-loaded-textures',description:JSON.stringify([...loaded.keys()])});
  expect(problems).toEqual([]);
  // The repository's asset check (pnpm assets:check) must pass with the shipped textures.
  execFileSync('pnpm',['assets:check'],{stdio:'pipe'});
});

test.fixme('R5 the asset check fails when a texture or HDRI file has no rights record',async()=>{
  // Not testable from the contract alone: proving the failure needs deleting or editing a rights record, and the
  // contract does not say where those records live or how the asset check finds them. Guessing a file layout would
  // test the implementation, not the contract. Verify in review (or in the asset pipeline's own unit tests).
});
