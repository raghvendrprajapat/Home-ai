import {test,expect} from '@playwright/test';
import {backup,FakeCloud,install,signedInWithNewCloudProject} from './cloud-stand-in';
import {openTool} from './helpers/tools';
// FR-033 (D69) view-only links against the Supabase stand-in. Claude-authored browser tests.

test('FR-033 a view-only link shows the newest cloud version, saves a copy on another device, and stops working when stopped',async({page,browser})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 const panel=page.locator('.share-panel');await openTool(page,'Project');await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Create a view-only link',exact:true}).click();
 const link=await panel.getByLabel('View-only link',{exact:true}).inputValue();
 expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4185\/#\/share\/[0-9a-f]{64}$/); // the token sits after '#'
 await expect(panel.locator('.share-list li')).toHaveCount(1);
 // A different person on another device, never signed in.
 const visitor=await browser.newContext({hasTouch:true}),view=await visitor.newPage();await install(view,cloud);
 await view.goto(link);
 await expect(view.locator('.shared-view')).toHaveAttribute('data-shared-state','ready');
 await expect(view.getByRole('heading',{level:2})).toHaveText(cloud.heads.get(id)!.name);
 await expect(view.getByText('View-only',{exact:true})).toBeVisible();
 await expect(view.locator('.shared-rooms li')).toHaveCount(2);
 await expect(view.getByRole('img',{name:/^Floor plan of /})).toBeVisible();
 await view.getByRole('button',{name:'Save a copy on this device',exact:true}).click();
 await expect(view).toHaveURL('http://127.0.0.1:4185/');
 await view.getByRole('button',{name:'Skip welcome',exact:true}).click(); // a first-time visitor still sees the welcome once
 await expect(view.getByTestId('save-status')).toHaveAttribute('data-phase','saved');
 const copy=await backup(view);expect(copy.id).not.toBe(id);expect(copy.revision).toBe(0);
 // The owner stops the link: the next visit finds nothing.
 await panel.getByRole('button',{name:'Stop sharing',exact:true}).click();
 await expect(panel.getByText('The link no longer works.',{exact:true})).toBeVisible();
 const late=await visitor.newPage();await install(late,cloud);await late.goto(link);
 await expect(late.locator('.shared-view')).toHaveAttribute('data-shared-state','missing');
 await expect(late.getByRole('alert')).toHaveText('This link is not available. It may have been stopped.');
 await visitor.close();
});

test('FR-033 a malformed link opens the normal app, not a shared view',async({page})=>{
 await page.goto('/#/share/not-a-token');
 await expect(page.locator('.shared-view')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Skip welcome',exact:true})).toBeVisible();
});
