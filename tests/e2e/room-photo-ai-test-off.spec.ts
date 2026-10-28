import {test,expect} from '@playwright/test';
import {openTool} from './helpers/tools';

// D92: in the normal build (VITE_ROOM_AI_TEST_MODE not set) there is no AI test mode at all: no section, no code
// prompt, and the app never calls /api/room-ai. Claude-authored builder test.
test('D92 AI test mode is absent when the build flag is off',async({page})=>{
 const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/room-ai'))calls.push(r.url());});
 await page.addInitScript(()=>{try{localStorage.setItem('gharplan-e2e-sample','fixture');}catch{/* opaque origins have no storage */}});
 await page.setViewportSize({width:412,height:915});
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();
 await openTool(page,'Room photo');
 const room=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=200;const g=c.getContext('2d')!;g.fillStyle='#888';g.fillRect(0,0,300,200);return c.toDataURL('image/png').split(',')[1]!;});
 const chooser=page.waitForEvent('filechooser');await page.getByRole('region',{name:'Room photo',exact:true}).getByRole('button',{name:'Choose room photo',exact:true}).click();
 await (await chooser).setFiles({name:'room.png',mimeType:'image/png',buffer:Buffer.from(room,'base64')});
 const view=page.getByRole('dialog',{name:'Room photo'});await expect(view.getByTestId('viz-mask')).toBeVisible();
 await expect(view.getByTestId('viz-ai')).toBeVisible();// the D86 account AI section (signed out) is unchanged
 await expect(view.getByTestId('viz-ai-test')).toHaveCount(0);
 await expect(view.getByText('AI test mode')).toHaveCount(0);
 await expect(view.getByRole('button',{name:'Make AI preview',exact:true})).toHaveCount(0);
 expect(calls).toEqual([]);
});
