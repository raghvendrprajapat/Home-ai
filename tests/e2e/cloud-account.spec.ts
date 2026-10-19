import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {FakeCloud,install,saved,session,signedInWithNewCloudProject,status} from './cloud-stand-in';
import {openTool} from './helpers/tools';
// FR-043 (D70) cloud export and account deletion against the Supabase stand-in. Claude-authored browser tests.

test('FR-043 download all cloud drawings, then delete the account: cloud data goes, this device keeps its drawing',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 const account=page.locator('.account-panel');await openTool(page,'Project');await account.locator('summary').click();
 const download=page.waitForEvent('download');await account.getByRole('button',{name:'Download all my cloud drawings',exact:true}).click();
 const file=JSON.parse(await readFile((await(await download).path())!,'utf8')) as {format:string;projects:{id:string;serverRevision:number}[];missing:string[]};
 expect(file.format).toBe('gharplan-cloud-export');expect(file.projects.map(p=>[p.id,p.serverRevision])).toEqual([[id,1]]);expect(file.missing).toEqual([]);
 await expect(account.getByText('Downloaded 1 cloud drawings.',{exact:true})).toBeVisible();
 await account.getByRole('button',{name:'Delete my account…',exact:true}).click();
 await expect(account.getByRole('alert')).toContainText('cannot be undone');
 const forever=account.getByRole('button',{name:'Delete my account forever',exact:true});
 await expect(forever).toBeDisabled();
 await account.getByLabel('Type DELETE to confirm',{exact:true}).fill('delete');await expect(forever).toBeDisabled(); // exact word only
 await account.getByLabel('Type DELETE to confirm',{exact:true}).fill('DELETE');await forever.click();
 await expect(page.getByText('Your account and cloud data were deleted. Drawings on this device are still here.',{exact:true})).toBeVisible();
 expect(cloud.deleted).toBe(true);expect(cloud.heads.size).toBe(0);
 await expect(page.getByRole('button',{name:'Sign in with Google',exact:true})).toBeVisible();
 await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved'); // the device copy is untouched
 expect(await page.evaluate(()=>localStorage.getItem('gharplan.cloud.linked'))).toBeNull();
});

test('FR-043 an old sign-in must sign in again before deleting',async({page})=>{
 const cloud=new FakeCloud();await install(page,cloud);
 await page.addInitScript(value=>{localStorage.setItem('sb-gharplan-e2e-auth-token',value);},JSON.stringify(session(new Date(Date.now()-60*60*1000).toISOString())));
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 await openTool(page,'Project');await expect(page.getByText('Signed in as Raghvendr Test',{exact:true})).toBeVisible();
 const account=page.locator('.account-panel');await account.locator('summary').click();
 await account.getByRole('button',{name:'Delete my account…',exact:true}).click();
 await expect(account.getByText('For your safety, sign in again before deleting.',{exact:true})).toBeVisible();
 await expect(account.getByRole('button',{name:'Delete my account forever',exact:true})).toHaveCount(0);
 expect(cloud.deleted).toBe(false);await expect(status(page)).toHaveAttribute('data-phase','unlinked');
});

test('FR-043 audit: when the database refuses an old sign-in (§D.8), nothing is deleted and the person is asked to sign in again',async({page})=>{
 const cloud=new FakeCloud();cloud.reauthRequired=true;await signedInWithNewCloudProject(page,cloud);
 const account=page.locator('.account-panel');await openTool(page,'Project');await account.locator('summary').click();
 await account.getByRole('button',{name:'Delete my account…',exact:true}).click();
 await account.getByLabel('Type DELETE to confirm',{exact:true}).fill('DELETE');await account.getByRole('button',{name:'Delete my account forever',exact:true}).click();
 await expect(account.getByRole('status')).toHaveText('For your safety, sign in again before deleting.');
 expect(cloud.deleted).toBe(false);expect(cloud.heads.size).toBe(1);await expect(page.getByText('Signed in as Raghvendr Test',{exact:true})).toBeVisible();
});

test('FR-043 the public account-deletion page explains the steps in English and Hindi',async({page})=>{
 await page.goto('/delete-account.html');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Delete your GharPlan account');
 await expect(page.getByText('Delete my account forever',{exact:false}).first()).toBeVisible();
 await expect(page.getByRole('heading',{name:'अपना GharPlan अकाउंट हटाएँ'})).toBeVisible();
});
