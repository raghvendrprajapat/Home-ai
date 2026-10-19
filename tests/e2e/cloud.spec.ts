import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {backup,FakeCloud,install,saved,session,signedInWithNewCloudProject,status} from './cloud-stand-in';
import type {Doc} from './cloud-stand-in';
import {openTool,openToolIfShown} from './helpers/tools';
// FR-031 (D67) cloud sign-in and saving against an in-test stand-in for Supabase (Auth + the D65 functions).
// Claude-authored; a real Supabase project and Google sign-in are still owner/release checks.
test('FR-031 Google sign-in (PKCE) and saving: a new cloud project gets version 1, an edit becomes version 2',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 expect(id).not.toBe('prj_sample_2room');
 expect(cloud.saves.at(-1)).toMatchObject({p_project_id:id,p_expected_revision:0});
 expect(cloud.heads.get(id)!.document.revision).toBe(1);
 expect((await backup(page)).revision).toBe(1); // only document.revision moved
 await openTool(page,'Draw');await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
 await expect(status(page)).toHaveText('Saved in cloud (version 2)');
 expect(cloud.saves.at(-1)).toMatchObject({p_project_id:id,p_expected_revision:1});
 expect(cloud.heads.get(id)!.document.floors).toHaveLength(2);
});

test('FR-031 no connection: the work stays on the device and the retry resends the same request',async({page})=>{
 const cloud=new FakeCloud();await signedInWithNewCloudProject(page,cloud);
 cloud.failNext=1;
 await openTool(page,'Draw');await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','offline');
 await expect(status(page)).toHaveText('Saved in cloud (version 2)',{timeout:10000});
 const [failed,retried]=cloud.saves.slice(-2);
 expect(retried).toEqual(failed); // same key, same base, same content
});

test('FR-031 a newer cloud version from another device pauses cloud saving and keeps local work',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 cloud.otherDevice(id,2); // another phone saved twice
 await openTool(page,'Draw');await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','conflict');
 await expect(status(page)).toContainText('newer version (3)');
 const local=await backup(page);expect(local.floors).toHaveLength(2);expect(local.revision).toBe(1);
 expect(cloud.heads.get(id)!.revision).toBe(3); // nothing overwritten
});

test('FR-031 a cloud project opens from the Projects screen without uploading itself again',async({page})=>{
 const cloud=new FakeCloud(),sample=JSON.parse(await readFile(new URL('../../docs/examples/sample-project.json',import.meta.url),'utf8')) as Doc;
 cloud.heads.set('prj_cloud_e2e',{revision:3,name:'Cloud house',document:{...sample,id:'prj_cloud_e2e',name:'Cloud house',revision:3}});
 await install(page,cloud);
 await page.addInitScript(value=>{localStorage.setItem('sb-gharplan-e2e-auth-token',value);},JSON.stringify(session()));
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 await page.getByRole('button',{name:'Open Cloud house from the cloud',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Cloud house/})).toBeVisible();
 await expect(status(page)).toHaveText('Saved in cloud (version 3)');
 await page.waitForTimeout(2500);expect(cloud.saves).toEqual([]);
 const opened=await backup(page);expect(opened).toMatchObject({id:'prj_cloud_e2e',revision:3,name:'Cloud house'});
});
test('FR-031 audit: reopening an unchanged cloud drawing uploads nothing, so its version history is kept',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud),before=cloud.saves.length;
 for(let i=0;i<3;i++){
  // A reload can land on the recovery screen (unflushed session journal); restoring keeps the same drawing.
  await page.reload();const restore=page.getByRole('button',{name:'Restore saved changes',exact:true});
  await openToolIfShown(page,'Project',restore);await expect(restore.or(status(page))).toBeVisible();if(await restore.isVisible())await restore.click();await saved(page);
  await expect(status(page)).toHaveText('Saved in cloud (version 1)');
  expect((await backup(page)).id).toBe(id);
 }
 expect(cloud.saves.length).toBe(before);expect(cloud.heads.get(id)!.revision).toBe(1);expect(cloud.versions.get(id)!.size).toBe(1);
});
