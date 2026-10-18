import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

// D73 AI-3 photo or sketch to plan with the offline stand-in reader. The picture is the same 200 x 150 px two-room
// drawing as apps/web/src/ai/sketch.test.ts; expected sizes are worked out by hand there and in
// docs/verification/d73-ai-furniture.md.
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
/** A minimal 8-bit grayscale PNG: white, with black pixel rectangles [x0, y0, x1, y1] (inclusive). */
function png(w:number,h:number,ink:readonly (readonly [number,number,number,number])[]):Buffer{
 const rows=Buffer.alloc((w+1)*h,255);for(let y=0;y<h;y++)rows[y*(w+1)]=0;
 for(const [x0,y0,x1,y1] of ink)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)rows[y*(w+1)+1+x]=0;
 const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=(b:Buffer)=>{let c=0xffffffff;for(const v of b)c=table[(c^v)&255]!^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(type:string,data:Buffer)=>{const head=Buffer.alloc(8);head.writeUInt32BE(data.length,0);head.write(type,4,'latin1');const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(Buffer.concat([head.subarray(4),data])),0);return Buffer.concat([head,data,sum]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const twoRooms=png(200,150,[[20,20,181,21],[20,130,181,131],[20,20,21,131],[180,20,181,131],[100,20,101,39],[100,56,101,131]]);

test('D73 AI-3 a two-room sketch shows under the plan, reads as two rooms and opens as a new drawing',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 const before=await backup(page),photo=page.getByRole('region',{name:'Photo or sketch to plan',exact:true});
 await expect(photo.getByText('The photo stays on this device.',{exact:false})).toBeVisible();
 await photo.getByLabel('Choose a photo or sketch',{exact:true}).setInputFiles({name:'sketch.png',mimeType:'image/png',buffer:twoRooms});
 await expect(photo.getByLabel('Real width of the whole picture (mm)',{exact:true})).toHaveValue('10000');
 // Trace-over: 10 m wide and 150/200 of that tall, at the plan origin, half strength. Nothing is saved.
 await photo.getByRole('checkbox',{name:'Show under the plan',exact:true}).check();
 await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-underlay','0,0,10000,7500,0.5');
 await photo.getByLabel('Picture strength (%)',{exact:true}).fill('30');
 await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-underlay','0,0,10000,7500,0.3');
 await page.getByTestId('plan-canvas').screenshot({path:test.info().outputPath('ai-photo-underlay.png')});
 expect(await backup(page)).toEqual(before);

 await photo.getByRole('button',{name:'Read rooms from the picture',exact:true}).click();
 const sketch=photo.getByTestId('ai-sketch');
 await expect(sketch.getByRole('status')).toHaveText('Found 2 rooms.');
 // Partition ink centre x 101 px = 5050 mm; rooms 1000..5050 and 5050..9100 by 1000..6600.
 expect(await sketch.locator('rect[data-room]').evaluateAll(rs=>rs.map(r=>r.getAttribute('data-room')))).toEqual(['1000,1000,4050,5600,living','5050,1000,4050,5600,bedroom']);
 await sketch.screenshot({path:test.info().outputPath('ai-photo-rooms.png')});
 expect(await backup(page)).toEqual(before);

 await sketch.getByRole('button',{name:'Create a new drawing from these rooms',exact:true}).click();
 await expect(page.getByRole('heading',{level:2})).toContainText('Plan from photo');await saved(page);
 const made=await backup(page);
 expect(made.id).not.toBe(before.id);
 expect(made.junctions).toHaveLength(6);expect(made.walls).toHaveLength(7);
 expect(made.rooms.map((r:{name:string;type:string})=>[r.name,r.type])).toEqual([['Living room','living'],['Bedroom','bedroom']]);
 // Each clear area: (4050 - 200) x (5600 - 200) = 3850 x 5400 = 20.79 m².
 const areas=page.getByRole('region',{name:'Room areas',exact:true});
 await expect(areas).toContainText('Living room');await expect(areas).toContainText('20.79 m²');
});

test('D73 AI-3 a picture with no closed room says so and changes nothing',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 const before=await backup(page),photo=page.getByRole('region',{name:'Photo or sketch to plan',exact:true});
 await photo.getByLabel('Choose a photo or sketch',{exact:true}).setInputFiles({name:'open.png',mimeType:'image/png',buffer:png(200,150,[[20,20,181,21],[20,20,21,131]])});
 await photo.getByRole('button',{name:'Read rooms from the picture',exact:true}).click();
 await expect(photo.getByRole('status')).toHaveText('No closed rooms were found. Try a clearer picture, check the width, or trace over the picture.');
 expect(await backup(page)).toEqual(before);
 await photo.getByLabel('Choose a photo or sketch',{exact:true}).setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('not a picture')});
 await expect(photo.getByRole('alert')).toHaveText('This picture could not be opened. Choose a JPG or PNG under 15 MB.');
});
