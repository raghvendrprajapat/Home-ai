import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {backup,FakeCloud,signedInWithNewCloudProject,status} from './cloud-stand-in';
// FR-032 (D68) conflict choices and version history against the Supabase stand-in. Claude-authored browser tests.
const addFloor=(page:Page)=>page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
const choices=(page:Page)=>page.getByRole('group',{name:'What to do with the newer cloud version',exact:true});
async function conflicted(page:Page,cloud:FakeCloud){
 const id=await signedInWithNewCloudProject(page,cloud);cloud.otherDevice(id,2);
 await addFloor(page);await expect(status(page)).toHaveAttribute('data-phase','conflict');
 return id;
}

test('FR-032 conflict: inspect the cloud version as a separate copy without touching either drawing',async({page})=>{
 const cloud=new FakeCloud(),id=await conflicted(page,cloud);
 await choices(page).getByRole('button',{name:'Open the cloud version as a separate copy',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','unlinked'); // the copy is a new device drawing
 const copy=await backup(page);
 expect(copy.id).not.toBe(id);expect(copy.revision).toBe(0);expect(copy.floors).toHaveLength(1); // the cloud head (1 floor)
 expect(cloud.heads.get(id)!.revision).toBe(3);
});

test('FR-032 conflict: save mine as a new cloud project; the other device\'s version stays',async({page})=>{
 const cloud=new FakeCloud(),id=await conflicted(page,cloud);
 await choices(page).getByRole('button',{name:'Save my version as a new cloud project',exact:true}).click();
 await expect(status(page)).toHaveText('Saved in cloud (version 1)');
 const mine=await backup(page);expect(mine.id).not.toBe(id);expect(mine.floors).toHaveLength(2);
 expect(cloud.heads.get(mine.id)!.document.floors).toHaveLength(2);
 expect(cloud.heads.get(id)!.revision).toBe(3);
});

test('FR-032 conflict: replace the cloud version only after confirming; it lands on top as version 4',async({page})=>{
 const cloud=new FakeCloud(),id=await conflicted(page,cloud);
 await choices(page).getByRole('button',{name:'Replace the cloud version with mine…',exact:true}).click();
 await expect(choices(page).getByRole('alert')).toContainText('replaces cloud version 3 on every device');
 await choices(page).getByRole('button',{name:'Yes, replace the cloud version',exact:true}).click();
 await expect(status(page)).toHaveText('Saved in cloud (version 4)');
 expect(cloud.saves.at(-1)).toMatchObject({p_project_id:id,p_expected_revision:3});
 expect(cloud.heads.get(id)!.document.floors).toHaveLength(2);
 expect((await backup(page)).revision).toBe(4);
 expect([...cloud.versions.get(id)!.keys()].sort()).toEqual([1,2,3,4]); // nothing deleted
});

test('FR-032 version history: restore an old version as the newest one, and open another as a copy',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 await addFloor(page);await expect(status(page)).toHaveText('Saved in cloud (version 2)');
 await addFloor(page);await expect(status(page)).toHaveText('Saved in cloud (version 3)');
 const history=page.locator('.version-history');await history.locator('summary').click();
 await expect(history.locator('li')).toHaveCount(3);
 await expect(history.locator('li[data-revision="3"]')).toContainText('(current)');
 await history.locator('li[data-revision="1"]').getByRole('button',{name:'Restore',exact:true}).click();
 await expect(history.getByRole('alert')).toContainText('It becomes the newest version (4)');
 await history.getByRole('button',{name:'Yes, restore',exact:true}).click();
 await expect(page.getByText('Version 1 restored as version 4.',{exact:true})).toBeVisible();
 await expect(status(page)).toHaveText('Saved in cloud (version 4)');
 const restored=await backup(page);expect(restored).toMatchObject({id,revision:4});expect(restored.floors).toHaveLength(1);
 expect(cloud.heads.get(id)!.document.floors).toHaveLength(1);
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled(); // history belonged to the replaced drawing
 await expect(history.locator('li')).toHaveCount(4);
 await history.locator('li[data-revision="2"]').getByRole('button',{name:'Open as a copy',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','unlinked');
 const copy=await backup(page);expect(copy.id).not.toBe(id);expect(copy.floors).toHaveLength(2);
});
