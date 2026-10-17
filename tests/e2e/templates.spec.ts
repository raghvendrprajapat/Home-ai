import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-003 project templates in the real New project dialog. Claude-authored (D52 continuation); not an independent fixture.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page,label='Export drawing'){const download=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,'utf8'));}
async function openDialog(page:Page){await page.goto('/');await page.getByRole('button',{name:'Get started',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByRole('button',{name:'New project',exact:true}).click();}
type Doc={name:string;units:string;rooms:{name:string;type:string}[];openings:{kind:string}[];walls:{thickness:number}[]};

test('FR-003 a 2BHK template opens as a new editable project with six named rooms, doors and windows; Undo history starts empty',async({page})=>{
  await openDialog(page);
  await expect(page.getByLabel('Start from',{exact:true})).toHaveValue('blank');
  await page.getByLabel('Project name',{exact:true}).fill('Verma flat');
  await page.getByLabel('Start from',{exact:true}).selectOption('2bhk');
  await page.getByRole('button',{name:'Create drawing',exact:true}).click();await saved(page);
  const doc=await backup(page) as Doc;
  expect(doc.name).toBe('Verma flat');
  expect(doc.rooms.map(r=>r.name).sort()).toEqual(['Bathroom','Bedroom','Bedroom 2','Dining room','Kitchen','Living room']);
  expect(doc.openings.filter(o=>o.kind==='door')).toHaveLength(5);expect(doc.openings.filter(o=>o.kind==='window')).toHaveLength(8);expect(doc.openings.filter(o=>o.kind==='opening')).toHaveLength(1);
  expect(new Set(doc.walls.map(w=>w.thickness))).toEqual(new Set([230,115]));
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await expect(page.getByTestId('plan-canvas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('FR-003 a single-room preset works and the default choice stays a blank drawing',async({page})=>{
  await openDialog(page);
  await page.getByLabel('Start from',{exact:true}).selectOption('kitchen');
  await page.getByRole('button',{name:'Create drawing',exact:true}).click();await saved(page);
  const kitchen=await backup(page) as Doc;expect(kitchen.rooms.map(r=>r.name)).toEqual(['Kitchen']);expect(kitchen.openings).toHaveLength(2);
  await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByRole('button',{name:'New project',exact:true}).click();
  await expect(page.getByLabel('Start from',{exact:true})).toHaveValue('blank');
  await page.getByRole('button',{name:'Create drawing',exact:true}).click();await saved(page);
  const blank=await backup(page) as Doc;expect(blank.rooms).toHaveLength(0);expect(blank.openings).toHaveLength(0);
});
test('FR-003 Hindi labels, imperial units and the chosen name are honoured',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Get started',exact:true}).click();await saved(page);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Language',{exact:true}).selectOption('hi');
  await page.getByRole('button',{name:'प्रोजेक्ट',exact:true}).click();
  await page.getByRole('button',{name:'नया प्रोजेक्ट',exact:true}).click();
  await page.getByLabel('शुरुआत किससे करें',{exact:true}).selectOption('1bhk');
  await page.getByLabel('प्रोजेक्ट का नाम',{exact:true}).fill('मेरा 1BHK');
  await page.getByLabel('इकाई',{exact:true}).selectOption('imperial');
  await page.getByRole('button',{name:'ड्रॉइंग बनाएँ',exact:true}).click();await saved(page);
  const doc=await backup(page,'ड्रॉइंग एक्सपोर्ट करें') as Doc;
  expect(doc.name).toBe('मेरा 1BHK');expect(doc.units).toBe('imperial');
  expect(doc.rooms.map(r=>r.name).sort()).toEqual(['उपयोग की जगह','बैठक','रसोई','सोने का कमरा','स्नानघर'].sort());
});
