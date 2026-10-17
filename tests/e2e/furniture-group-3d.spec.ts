import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-019 moving and turning a furniture group in 3D. Claude-authored (D52 continuation); not an independent fixture.
// Camera framing and the independent projection follow furniture-3d-gestures.spec.ts.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
const view=(p:Page)=>p.getByTestId('three-view'),panel=(p:Page)=>p.getByRole('region',{name:'Furniture adjustments',exact:true});
type Item={id:string;position:{x:number;y:number};rotationDeg:number;groupId?:string};
/** Two 1200 x 600 boxes at (0,0) and (2200,0), grouped. Combined box x -600..2800, y -300..300 -> turn pivot (1100, 0). */
async function start(page:Page){
 const d=JSON.parse(await readFile('docs/examples/sample-project.json','utf8'));d.id='prj_group_3d';d.junctions=[];d.walls=[];d.openings=[];d.rooms=[];d.lights=[];
 d.furniture=[0,1].map(i=>({...d.furniture[0],id:`fu_drag_${i}`,assetId:'a_legacy_box',assetVersion:1,position:{x:i*2200,y:0},elevation:300,rotationDeg:0,size:{w:1200,d:600,h:750},materialOverrides:{},groupId:'group_1'}));
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByLabel('Choose project backup JSON',{exact:true}).setInputFiles({name:'group-3d.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await page.getByRole('button',{name:'Open backup with original IDs',exact:true}).click();await saved(page);
 await panel(page).getByLabel('Choose furniture',{exact:true}).selectOption('fu_drag_0');await page.getByRole('button',{name:'3D view',exact:true}).click();await expect(view(page)).toHaveAttribute('data-rendered-generation','0');
 const canvas=view(page).locator('canvas');await canvas.scrollIntoViewIfNeeded();await canvas.focus();for(let i=0;i<16;i++)await canvas.press('ArrowUp');for(let i=0;i<6;i++)await canvas.press('-');
 await expect.poll(async()=>{const p=await pose(page);return Math.hypot(p.position[0]!-p.target[0]!,p.position[2]!-p.target[2]!)/(p.position[1]!-p.target[1]!);}).toBeLessThan(.06);
 return backup(page);
}
async function pose(page:Page){return JSON.parse((await view(page).getAttribute('data-camera-pose'))!) as {position:number[];target:number[]};}
/** Independent camera basis/FOV calculation, not the production ray helper. */
async function project(page:Page,point:[number,number,number]){
 const b=(await view(page).locator('canvas').boundingBox())!,p=await pose(page),f=p.target.map((v,i)=>v-p.position[i]!),n=Math.hypot(...f);for(let i=0;i<3;i++)f[i]=f[i]!/n;const r=[-f[2]!,0,f[0]!],rn=Math.hypot(...r);for(let i=0;i<3;i++)r[i]=r[i]!/rn;const u=[r[1]!*f[2]!-r[2]!*f[1]!,r[2]!*f[0]!-r[0]!*f[2]!,r[0]!*f[1]!-r[1]!*f[0]!],d=point.map((v,i)=>v-p.position[i]!),dot=(v:number[])=>v.reduce((s,a,i)=>s+a*d[i]!,0),z=dot(f),t=Math.tan(Math.PI/8);return {x:b.x+b.width*(1+dot(r)/(z*t*b.width/b.height))/2,y:b.y+b.height*(1-dot(u)/(z*t))/2};
}
const at=(doc:{furniture:Item[]},id:string)=>doc.furniture.find(f=>f.id===id)!;

test('FR-019 3D Move on a grouped item moves the whole group by the same snapped delta with one Undo',async({page})=>{
 const before=await start(page);await expect(view(page).getByTestId('group-3d-together')).toBeVisible();
 await view(page).getByRole('button',{name:'Move selected furniture',exact:true}).click();
 const a=await project(page,[.2,1.05,-.1]);await page.mouse.move(a.x,a.y);await page.mouse.down();await expect(view(page)).toHaveAttribute('data-furniture-gesture','preview');
 const b=await project(page,[1.2,1.05,.4]);await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();await saved(page);
 // Pointer +1000/+500 mm on the 50 mm grid: fu_drag_0 (0,0) -> (1000,500); fu_drag_1 keeps its 2200 mm offset.
 const after=await backup(page);expect(at(after,'fu_drag_0').position).toEqual({x:1000,y:500});expect(at(after,'fu_drag_1').position).toEqual({x:3200,y:500});
 expect(after.furniture.every((f:Item)=>f.rotationDeg===0&&f.groupId==='group_1')).toBe(true);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});
test('FR-019 3D Rotate on a grouped item turns the group about its shared pivot by a 15-degree-step delta',async({page})=>{
 const before=await start(page);await view(page).getByRole('button',{name:'Rotate selected furniture',exact:true}).click();
 // Grab fu_drag_0 at plan (200,-100): offset from pivot (1100,0) is (-900,-100). +90 degrees maps it to (100,-900): plan (1200,-900).
 const a=await project(page,[.2,1.05,-.1]);await page.mouse.move(a.x,a.y);await page.mouse.down();await expect(view(page)).toHaveAttribute('data-furniture-gesture','preview');
 const b=await project(page,[1.2,1.05,-.9]);await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await saved(page);
 // +90 about (1100,0): fu_drag_0 offset (-1100,0) -> (0,-1100) = (1100,-1100); fu_drag_1 (1100,0) -> (0,1100) = (1100,1100); both 90 degrees.
 const after=await backup(page);expect(at(after,'fu_drag_0')).toMatchObject({position:{x:1100,y:-1100},rotationDeg:90});expect(at(after,'fu_drag_1')).toMatchObject({position:{x:1100,y:1100},rotationDeg:90});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);expect(await backup(page)).toEqual(before);
});
