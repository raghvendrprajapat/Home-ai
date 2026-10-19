import {test,expect} from '@playwright/test';
import type {Locator,Page} from '@playwright/test';
import {VIEWPORTS,start,exportRaw,exportDoc,openTool,reveal,undoButton,redoButton,polygon,inside,roomOf,isBedroom,isLiving,activeFloorId} from './helpers';
import type {Doc,Material} from './helpers';

// D76 M3 "Copilot (offline stand-in)" acceptance tests, written from docs/specs/phase1-quality.md only.
// Results are verified through the exported drawing JSON ("Export drawing") and the Undo/Redo buttons.
test.use({viewport:VIEWPORTS.desktop,actionTimeout:15000});

const copilot=(page:Page)=>openTool(page,'Copilot');
const askBox=(region:Locator)=>region.getByRole('textbox',{name:'Ask Copilot',exact:true});
const sendButton=(region:Locator)=>region.getByRole('button',{name:'Send',exact:true});
const regionText=(region:Locator)=>region.evaluate(el=>(el as HTMLElement).innerText);

/** Types a request, presses Send and returns the text that appeared in the panel because of it (request + reply). */
async function ask(page:Page,request:string,waitForReply=true){
  const region=await copilot(page),before=await regionText(region);
  await askBox(region).fill(request);
  await sendButton(region).click();
  let added='';
  if(!waitForReply)return {region,added};
  await expect.poll(async()=>{
    const after=await regionText(region);
    let p=0;while(p<before.length&&p<after.length&&before[p]===after[p])p++;
    let s=0;while(s<before.length-p&&s<after.length-p&&before[before.length-1-s]===after[after.length-1-s])s++;
    added=after.slice(p,after.length-s);
    const i=added.lastIndexOf(request);
    return i>=0&&added.slice(i+request.length).trim().length>0;
  },{message:`"${request}" and a reply appear in the conversation`,timeout:20000}).toBe(true);
  return {region,added};
}

const ROOMS_2BHK=['Bathroom','Bedroom','Bedroom 2','Dining room','Kitchen','Living room'];
const same=(a:Doc,b:Doc,fields:string[])=>{for(const f of fields)expect(a[f],`${f} unchanged`).toEqual(b[f]);};
const omit=(o:object,keys:string[])=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const hex=(c:string)=>{const m=/^#?([0-9a-f]{6})$/i.exec(c.trim());return m?[0,2,4].map(i=>parseInt(m[1]!.slice(i,i+2),16)):null;};
const isBeige=(m:Material|undefined)=>{
  if(!m)return false;
  if(/beige/i.test(`${m.id} ${m.name}`))return true;
  const rgb=hex(m.baseColor);if(!rgb)return false;const [r,g,b]=rgb as [number,number,number];
  return r>=170&&r>=g&&g>=b&&r-b>=15&&r-b<=90;
};
const isWood=(m:Material|undefined)=>!!m&&/wood/i.test(`${m.id} ${m.name} ${m.textureAssetId??''}`);

// ---- C1 panel -------------------------------------------------------------------------------------------------
test('C1 the Copilot panel shows the offline note, three starter chips, the "Ask Copilot" box and Send; messages read newest last',async({page})=>{
  // C1: offline helper note; three starter chips; textbox "Ask Copilot"; "Send"; conversation newest last.
  await start(page);
  const region=await copilot(page);
  await expect(region).toContainText(/offline/i);
  await expect(askBox(region)).toBeVisible();
  await expect(sendButton(region)).toBeVisible();
  const buttons=await region.getByRole('button').filter({visible:true}).evaluateAll(els=>els.map(e=>(e.getAttribute('aria-label')??(e as HTMLElement).innerText).trim()));
  const chipNames=buttons.filter(n=>n&&!/^(send|close\b.*|×|✕)$/i.test(n));
  expect(chipNames.length,`starter chips: ${JSON.stringify(chipNames)}`).toBeGreaterThanOrEqual(3);
  // A chip is a starter: tapping it fills the box or starts a conversation.
  const before=await regionText(region);
  await region.getByRole('button',{name:chipNames[0]!,exact:true}).first().click();
  await expect.poll(async()=>(await askBox(region).inputValue()).trim().length>0||(await regionText(region))!==before).toBe(true);
  // Conversation order: the newest message is last.
  const first='What is the weather like today?',second='Tell me a joke about cricket';
  await ask(page,first);
  const {region:chat}=await ask(page,second);
  const text=await regionText(chat);
  expect(text.lastIndexOf(first)).toBeGreaterThanOrEqual(0);
  expect(text.lastIndexOf(second)).toBeGreaterThan(text.lastIndexOf(first));
  const a=(await chat.getByText(first,{exact:true}).last().boundingBox())!,b=(await chat.getByText(second,{exact:true}).last().boundingBox())!;
  expect(b.y).toBeGreaterThan(a.y);
});

// ---- C2 requests ----------------------------------------------------------------------------------------------
for(const request of ['Make a 2BHK','2BHK banao']){
  test(`C2 "${request}" opens a new 2BHK project (six named rooms) and leaves the previous drawing untouched`,async({page})=>{
    // C2 row 1.
    await start(page);
    const before=await exportDoc(page);
    await ask(page,request,false);
    await expect.poll(async()=>(await exportDoc(page)).rooms.map(r=>r.name).sort(),{timeout:20000}).toEqual(ROOMS_2BHK);
    const made=await exportDoc(page);
    expect(made.id).not.toBe(before.id);
    expect(made.rooms).toHaveLength(6);
    // The previous drawing is still there, unchanged.
    const projects=await reveal(page,page.getByRole('button',{name:'Projects',exact:true}).filter({visible:true}));
    await projects.click();
    const open=page.getByRole('button',{name:`Open ${before.name}`,exact:true});
    await expect(open.first()).toBeVisible();
    await (await open.count()>1?page.locator(`[data-project-id="${before.id}"]`).getByRole('button',{name:`Open ${before.name}`,exact:true}):open).click();
    await expect(page.getByTestId('editor-views')).toBeVisible();
    expect(await exportDoc(page)).toEqual(before);
  });
}

for(const request of ['Furnish the bedroom','bedroom furnish karo']){
  test(`C2 "${request}" shows the checked bedroom layout preview; Apply adds it as one undo step and Undo removes all of it`,async({page})=>{
    // C2 row 2 and C3.
    await start(page);
    const before=await exportDoc(page),bedroom=roomOf(before,isBedroom),poly=polygon(before,bedroom);
    const {region}=await ask(page,request);
    const apply=region.getByRole('button',{name:/^(Apply|Add this layout)\b/i});
    await expect(apply).toBeVisible({timeout:20000});
    await expect(undoButton(page),'the preview alone changes nothing').toBeDisabled();
    await apply.click();
    await expect(undoButton(page)).toBeEnabled();
    const after=await exportDoc(page),known=new Set(before.furniture.map(f=>f.id)),added=after.furniture.filter(f=>!known.has(f.id));
    expect(added.length).toBeGreaterThan(0);
    for(const item of added)expect(inside(poly,[item.position.x,item.position.y]),`${item.assetId} is in the bedroom`).toBe(true);
    for(const item of before.furniture)expect(after.furniture.find(f=>f.id===item.id)).toEqual(item);
    same(after,before,['floors','junctions','walls','rooms','openings']);
    await undoButton(page).click();
    expect(await exportDoc(page),'one Undo removes all of it').toEqual(before);
    await expect(undoButton(page)).toBeDisabled();
    await redoButton(page).click();
    expect(await exportDoc(page)).toEqual(after);
  });
}

for(const request of ['Paint the walls beige','deewar beige karo']){
  test(`C2 "${request}" paints every wall side of the active floor beige as one undo step`,async({page})=>{
    // C2 row 3 and C3.
    await start(page);
    const before=await exportDoc(page),floor=activeFloorId(before);
    await ask(page,request);
    await expect(undoButton(page)).toBeEnabled({timeout:20000});
    const after=await exportDoc(page),walls=after.walls.filter(w=>w.floorId===floor);
    expect(walls.length).toBeGreaterThan(0);
    for(const w of walls){
      expect(isBeige(after.materials.find(m=>m.id===w.leftMaterial)),`${w.id} left side beige`).toBe(true);
      expect(isBeige(after.materials.find(m=>m.id===w.rightMaterial)),`${w.id} right side beige`).toBe(true);
      expect(omit(w,['leftMaterial','rightMaterial','rev'])).toEqual(omit(before.walls.find(o=>o.id===w.id)!,['leftMaterial','rightMaterial','rev']));
    }
    expect(after.walls.filter(w=>w.floorId!==floor)).toEqual(before.walls.filter(w=>w.floorId!==floor));
    same(after,before,['floors','junctions','rooms','openings','furniture']);
    await undoButton(page).click();
    expect(await exportDoc(page),'one Undo restores every wall').toEqual(before);
    await expect(undoButton(page)).toBeDisabled();
    await redoButton(page).click();
    expect(await exportDoc(page)).toEqual(after);
  });
}

for(const request of ['Wooden floor in the living room','living room mein wooden floor']){
  test(`C2 "${request}" gives the living room the wood floor material as one undo step`,async({page})=>{
    // C2 row 4 and C3.
    await start(page);
    const before=await exportDoc(page),living=roomOf(before,isLiving);
    await ask(page,request);
    await expect(undoButton(page)).toBeEnabled({timeout:20000});
    const after=await exportDoc(page),room=after.rooms.find(r=>r.id===living.id)!;
    expect(isWood(after.materials.find(m=>m.id===room.floorMaterial)),`living room floor ${room.floorMaterial} is wood`).toBe(true);
    expect(omit(room,['floorMaterial','rev'])).toEqual(omit(living,['floorMaterial','rev']));
    expect(after.rooms.filter(r=>r.id!==living.id)).toEqual(before.rooms.filter(r=>r.id!==living.id));
    same(after,before,['floors','junctions','walls','openings','furniture']);
    await undoButton(page).click();
    expect(await exportDoc(page)).toEqual(before);
    await expect(undoButton(page)).toBeDisabled();
    await redoButton(page).click();
    expect(await exportDoc(page)).toEqual(after);
  });
}

for(const request of ['Book a cab to the airport','mujhe airport ke liye cab book karo']){
  test(`C2 an unsupported request ("${request}") gets a short reply listing what Copilot can do and the drawing does not change`,async({page})=>{
    // C2 last row: reply lists the abilities; exported JSON byte-identical.
    await start(page);
    const before=await exportRaw(page);
    const {added}=await ask(page,request),reply=added.slice(added.lastIndexOf(request)+request.length);
    test.info().annotations.push({type:'C2-reply',description:reply});
    expect(reply).toMatch(/2\s*BHK/i);
    expect(reply).toMatch(/furnish|furniture/i);
    expect(reply).toMatch(/paint|beige|colou?r|rang/i);
    expect(reply).toMatch(/floor|farsh/i);
    await expect(undoButton(page)).toBeDisabled();
    expect(await exportRaw(page)).toBe(before);
  });
}

// ---- C3 undo/redo ---------------------------------------------------------------------------------------------
test('C3 a Copilot change undoes and redoes exactly like a manual edit, including the keyboard shortcuts',async({page})=>{
  // C3: changes go through the normal commands; Undo/Redo (buttons and Ctrl+Z / Ctrl+Shift+Z) behave as for manual edits.
  await start(page);
  const before=await exportDoc(page);
  await ask(page,'Paint the walls beige');
  await expect(undoButton(page)).toBeEnabled({timeout:20000});
  const painted=await exportDoc(page);
  expect(painted).not.toEqual(before);
  await ask(page,'Wooden floor in the living room');
  await expect.poll(async()=>JSON.stringify((await exportDoc(page)).rooms)).not.toBe(JSON.stringify(painted.rooms));
  const both=await exportDoc(page);
  await page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await page.keyboard.press('Control+z');
  await expect.poll(()=>exportDoc(page)).toEqual(painted);
  await page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await page.keyboard.press('Control+z');
  await expect.poll(()=>exportDoc(page)).toEqual(before);
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeEnabled();
  await page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(()=>exportDoc(page)).toEqual(painted);
  await redoButton(page).click();
  expect(await exportDoc(page)).toEqual(both);
  await expect(redoButton(page)).toBeDisabled();
});
