import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openTool } from './helpers/tools';
async function begin(page: Page) {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Make room for your ideas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Get started', exact: true }).click(); await saved(page);
}
async function saved(page: Page) { await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved', { timeout:15000 }); }
async function backup(page: Page) {
  const download = page.waitForEvent('download'); await page.getByRole('button', { name:'Export drawing',exact:true }).click();
  const result = await download; const path = await result.path(); expect(path).toBeTruthy(); return JSON.parse(await readFile(path!, 'utf8'));
}
async function restore(page: Page) {
  await page.reload(); const button = page.getByRole('button',{name:'Restore saved changes',exact:true});
  await Promise.race([button.waitFor(),page.getByTestId('save-status').waitFor()]); if(await button.isVisible()) await button.click(); await saved(page);
}
test('UX-001 onboarding, cancel focus, measured creation, undo/redo and reload preserve complete canonical drawing', async ({page}) => {
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message)); await begin(page);
  await page.getByRole('button',{name:'Projects',exact:true}).click(); await page.getByRole('button',{name:'New project',exact:true}).click();
  await expect(page.getByLabel('Project name',{exact:true})).toBeFocused(); await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'New project',exact:true})).toBeFocused(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Test house <private>');
  await page.getByRole('button',{name:'Create drawing',exact:true}).click();await saved(page);
  await openTool(page,'Draw');await page.getByRole('button',{name:'Add a starter room',exact:true}).click();await saved(page);await expect(page.getByTestId('total-area')).toContainText('14.44');
  await page.getByLabel('Corner X coordinate',{exact:true}).fill('4500');await page.getByRole('button',{name:'Apply coordinates',exact:false}).click();await saved(page);await expect(page.getByTestId('total-area')).toContainText('16.34');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);await expect(page.getByTestId('total-area')).toContainText('14.44');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await saved(page); const before = await backup(page); await restore(page); expect(await backup(page)).toEqual(before);expect(errors).toEqual([]);
});
test('render crash retains unsaved latest drawing, exports exact content, requires explicit reload confirmation', async ({page}) => {
  await begin(page); const original=await backup(page);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Injected write quota','QuotaExceededError');};});
  await openTool(page,'Draw');await page.getByLabel('Corner X coordinate',{exact:true}).fill('4700');await page.getByRole('button',{name:'Apply coordinates',exact:false}).click();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','error'); const changed=await backup(page); expect(changed).not.toEqual(original);
  await page.evaluate(()=>{window.dispatchEvent(new Event('gharplan-e2e-render-fault'));});
  await expect(page.getByRole('heading',{name:'The screen stopped working',exact:true})).toBeVisible();
  expect(await backup(page)).toEqual(changed); await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','error');
  await page.getByRole('button',{name:'Reload after saving a copy',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Reload after saving a copy',exact:true})).toBeFocused();expect(await backup(page)).toEqual(changed);
  await page.getByRole('button',{name:'Reload after saving a copy',exact:true}).click(); await page.getByRole('button',{name:'I kept a safe copy — reload',exact:true}).click();
  const button=page.getByRole('button',{name:'Restore saved changes',exact:true});await Promise.race([button.waitFor(),page.getByTestId('save-status').waitFor()]);if(await button.isVisible())await button.click();await saved(page);
  expect(await backup(page)).toEqual(original); // Unsaved latest edit survives in the exported copy, not falsely claimed on disk.
});
test('diagnostics defaults off, unconfigured opt-in sends nothing, revocation survives reload; Hindi settings work',async({page})=>{
  const outbound:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4185'))outbound.push(r.url());});await begin(page);
  await page.getByRole('button',{name:'Settings',exact:true}).click();const check=page.getByRole('checkbox',{name:'Allow error reports for this session',exact:true});await expect(check).not.toBeChecked();await check.check();
  await expect(page.getByText('Error reporting is not configured in this build. Nothing is sent.',{exact:true})).toBeVisible();await check.uncheck();await page.getByLabel('Language',{exact:true}).selectOption('hi');await expect(page.getByRole('checkbox',{name:'इस सत्र में त्रुटि रिपोर्ट की अनुमति दें',exact:true})).not.toBeChecked();
  await page.reload();const restoreButton=page.getByRole('button',{name:'सेव बदलाव वापस लाएँ',exact:true});await Promise.race([restoreButton.waitFor(),page.getByTestId('save-status').waitFor()]);if(await restoreButton.isVisible())await restoreButton.click();
  await page.getByRole('button',{name:'सेटिंग्स',exact:true}).click();await expect(page.getByRole('checkbox',{name:'इस सत्र में त्रुटि रिपोर्ट की अनुमति दें',exact:true})).not.toBeChecked();expect(outbound).toEqual([]);
});
test('invalid upload cannot change source; collision import is explicit and remaps all IDs',async({page})=>{
  await begin(page);const source=await backup(page);await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByLabel('Choose project backup JSON',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":999}')});
  await expect(page.getByRole('alert')).toContainText('Update the app');
  await page.getByLabel('Choose project backup JSON',{exact:true}).setInputFiles({name:'source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await expect(page.getByRole('button',{name:'Open backup with original IDs',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Back to drawing',exact:true}).click();expect(await backup(page)).toEqual(source);
  await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByLabel('Choose project backup JSON',{exact:true}).setInputFiles({name:'source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await page.getByRole('button',{name:'Import as a separate copy',exact:true}).click();await saved(page);const copy=await backup(page);
  const ids=(doc:typeof source)=>[doc.id,...['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'].flatMap(key=>doc[key].map((entity:{id:string})=>entity.id))];
  const oldIds=new Set(ids(source));expect(ids(copy).every(id=>!oldIds.has(id))).toBe(true);expect(copy.rooms).toHaveLength(2);await expect(page.getByTestId('total-area')).toContainText('36.51');expect(copy.junctions.map(({x,y}:{x:number;y:number})=>[x,y])).toEqual(source.junctions.map(({x,y}:{x:number;y:number})=>[x,y]));
});
test('UX-001 blocked storage and missing WebGL retain an editable/exportable drawing; welcome skip works',async({page})=>{
  await page.addInitScript(()=>{
    indexedDB.open=()=>{throw new DOMException('Blocked storage','SecurityError');};
    Storage.prototype.getItem=()=>{throw new DOMException('Blocked preferences','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('Blocked preferences','SecurityError');};
    const get=HTMLCanvasElement.prototype.getContext;Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,...args:Parameters<typeof get>){if(String(args[0]).startsWith('webgl'))return null;return get.apply(this,args);}});
  });
  await page.goto('/');await page.getByRole('button',{name:'Open a separate sample',exact:true}).click();await page.getByRole('button',{name:'Skip welcome',exact:true}).click();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','memory');const original=await backup(page);
  await page.getByRole('button',{name:'3D view',exact:true}).click();await expect(page.getByTestId('three-view').getByText('3D is unavailable on this device. Continue editing in 2D; your drawing is unchanged.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'2D plan',exact:true}).click();expect(await backup(page)).toEqual(original);await openTool(page,'Draw');await page.getByLabel('Corner X coordinate',{exact:true}).fill('4350');await page.getByRole('button',{name:'Apply coordinates',exact:false}).click();expect(await backup(page)).not.toEqual(original);await expect(page.getByTestId('save-status')).not.toHaveAttribute('data-phase','saved');
});
test('small touch viewport switches synchronized 3D and edits in 2D without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:360,height:800});await begin(page);
  await expect(page.getByTestId('total-area')).toContainText('36.51');
  await page.getByRole('button',{name:'3D view',exact:true}).tap();await expect(page.getByTestId('three-view')).toHaveAttribute('data-rendered-generation','0',{timeout:15000});
  await page.getByRole('button',{name:'2D plan',exact:true}).tap();await openTool(page,'Draw');await page.getByLabel('Corner X coordinate',{exact:true}).fill('4350');await page.getByRole('button',{name:'Apply coordinates',exact:false}).click();await saved(page);
  await page.getByRole('button',{name:'3D view',exact:true}).tap();await expect(page.getByTestId('three-view')).toHaveAttribute('data-rendered-generation','1',{timeout:15000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
