import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-035 stairs and roofs in the real editor. Claude-authored (D52/D63 continuation); not an independent fixture.
// H.6 sample: outer 230 mm walls on the centreline rectangle 0..8000 x 0..5000, 3000 mm high, ground floor f0.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
type Doc={stairs?:{id:string;floorId:string;position:{x:number;y:number};rotationDeg:number;width:number;length:number;height:number;steps:number;material:string}[];roofs?:{floorId:string;kind:string;pitchDeg:number;overhang:number;ridgeAxis:string;material:string}[]};
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);const panel=page.locator('.structure-controls');await panel.locator('summary').click();return {panel,original:await backup(page) as Doc};}

test('FR-035 add stairs centred on the floor with about 175 mm risers, turn them, reject bad sizes, Undo restores',async({page})=>{
 const {panel,original}=await start(page);
 await expect(panel).toContainText('Planning tool only, not construction, structural or building-code advice.');
 await panel.getByRole('button',{name:'+ Add stairs',exact:true}).click();await saved(page);
 const one=await backup(page) as Doc;
 // Centre of the outer rectangle (-115..8115, -115..5115); 3000 mm in round(3000/175) = 17 steps over 17 x 250 = 4250 mm.
 expect(one.stairs).toEqual([expect.objectContaining({floorId:'f0',position:{x:4000,y:2500},rotationDeg:0,width:900,length:4250,height:3000,steps:17,material:'m_stair_stone'})]);
 await expect(panel.getByTestId('stair-step-size')).toHaveText('Each step: 176.5 mm high, 250 mm deep');
 await expect(panel).toHaveAttribute('data-stair-count','1');
 const form=panel.locator('.stair-form');
 await form.getByRole('combobox',{name:'Goes up toward',exact:true}).selectOption({label:'Right of plan'});
 await form.getByLabel('Width (mm)',{exact:true}).fill('1000');
 await form.getByRole('button',{name:'Apply stairs',exact:true}).click();await saved(page);
 expect((await backup(page) as Doc).stairs![0]).toMatchObject({rotationDeg:90,width:1000,length:4250});
 const before=await backup(page) as Doc;
 await form.getByLabel('Width (mm)',{exact:true}).fill('500');
 await form.getByRole('button',{name:'Apply stairs',exact:true}).click();
 await expect(page.getByText('Check the values: whole millimetres within the allowed sizes.')).toBeVisible();
 expect(await backup(page)).toEqual(before);
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);}
 expect(await backup(page)).toEqual(original);
});

test('FR-035 a sloped roof sits on the walls in 3D next to the stairs; flat replaces it; removing it restores the plan',async({page})=>{
 const {panel,original}=await start(page);
 await panel.getByRole('button',{name:'+ Add stairs',exact:true}).click();await saved(page);
 const roof=panel.locator('.roof-form');
 await roof.getByRole('combobox',{name:'Roof on this floor',exact:true}).selectOption({label:'Sloped roof (two sides)'});
 await roof.getByLabel('Slope (degrees)',{exact:true}).fill('30');
 await roof.getByRole('button',{name:'Apply roof',exact:true}).click();await saved(page);
 expect((await backup(page) as Doc).roofs).toEqual([expect.objectContaining({floorId:'f0',kind:'gable',pitchDeg:30,overhang:300,ridgeAxis:'x',material:'m_roof_tiles'})]);
 await expect(panel).toHaveAttribute('data-roof-kind','gable');
 await page.getByRole('button',{name:'3D view',exact:true}).click();const view=page.getByTestId('three-view');
 await expect(view).toHaveAttribute('data-scene-state','current');
 const meshes=JSON.parse((await view.getAttribute('data-structure-meshes'))!) as string[];
 expect(meshes).toHaveLength(2);expect(meshes.some(id=>id.startsWith('roof:'))&&meshes.some(id=>id.startsWith('stair:'))).toBe(true);
 await page.getByRole('button',{name:'2D plan',exact:true}).click();
 await roof.getByRole('combobox',{name:'Roof on this floor',exact:true}).selectOption({label:'Flat roof'});
 await roof.getByRole('button',{name:'Apply roof',exact:true}).click();await saved(page);
 expect((await backup(page) as Doc).roofs).toEqual([expect.objectContaining({kind:'flat',material:'m_roof_concrete'})]);
 await roof.getByRole('combobox',{name:'Roof on this floor',exact:true}).selectOption({label:'No roof'});
 await roof.getByRole('button',{name:'Apply roof',exact:true}).click();await saved(page);
 expect((await backup(page) as Doc).roofs).toBeUndefined();
 for(let i=0;i<4;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);}
 expect(await backup(page)).toEqual(original);
});

test('FR-035 stairs and roof belong to their floor: a roof set upstairs is not shown on the ground floor',async({page})=>{
 const {panel}=await start(page);
 await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();await saved(page);
 await expect(panel).toHaveAttribute('data-stair-count','0');
 await panel.locator('.roof-form').getByRole('combobox',{name:'Roof on this floor',exact:true}).selectOption({label:'Flat roof'});
 await panel.locator('.roof-form').getByRole('button',{name:'Apply roof',exact:true}).click();await saved(page);
 const doc=await backup(page) as Doc&{floors:{id:string;level:number}[]},upper=doc.floors.find(f=>f.level===1)!.id;
 expect(doc.roofs).toEqual([expect.objectContaining({floorId:upper,kind:'flat'})]);
 await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'Ground floor',exact:true}).click();
 await expect(panel).toHaveAttribute('data-roof-kind','none');
});

// D76 M1 (setup only, no assertion changed): these tests were written for the plain fixture, "auto" quality resolving
// to low on a budget phone, and full-height walls in 3D. M1 made the furnished sample, mid on capable devices and
// low walls the defaults, so this file starts like a budget phone with the fixture and full walls.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});try{localStorage.setItem('gharplan-e2e-sample','fixture');localStorage.setItem('gharplan-low-walls','0');}catch{/* opaque origins have no storage */}});});
