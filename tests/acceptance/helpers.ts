import {expect} from '@playwright/test';
import type {Locator,Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// D76 independent acceptance helpers, written from docs/specs/phase1-quality.md only.
// They use the accessible names the contract fixes, plus existing app labels (Skip welcome, Export drawing,
// Undo/Redo, 3D quality) that S4 says must keep working. Where the new shell (M2) may hide an existing control
// inside a tool panel, the helpers first look for the visible control and otherwise open the panel that the
// contract assigns it to (S3: Project = floors, save, cloud, export, settings).

export const TOOLS=['Draw','Openings','Furniture','Materials','Copilot','Project'] as const;
export type Tool=typeof TOOLS[number];
export const DEVANAGARI=/[ऀ-ॿ]/;
export const VIEWPORTS={desktop:{width:1280,height:800},phone360:{width:360,height:800},phone412:{width:412,height:915}} as const;

export type Junction={id:string;x:number;y:number};
export type Wall={id:string;floorId:string;a:string;b:string;thickness:number;height:number;leftMaterial:string;rightMaterial:string;rev:number};
export type Room={id:string;floorId:string;boundary:string[];name:string;type:string;floorMaterial:string;rev:number};
export type Furniture={id:string;floorId:string;assetId:string;assetVersion:number;position:{x:number;y:number};elevation:number;rotationDeg:number;size:{w:number;d:number;h:number}};
export type Material={id:string;name:string;baseColor:string;textureAssetId?:string};
export type Floor={id:string;name:string;level:number;elevation:number};
export type Doc={id:string;name:string;floors:Floor[];junctions:Junction[];walls:Wall[];rooms:Room[];openings:unknown[];furniture:Furniture[];materials:Material[];[key:string]:unknown};

/** Fixed test setup: the bundled sample opened with the existing first-run button "Skip welcome". */
export async function start(page:Page){
  await page.goto('/');
  await page.getByRole('button',{name:'Skip welcome',exact:true}).click();
  await expect(page.getByTestId('editor-views')).toBeVisible();
}

export const toolRail=(page:Page)=>page.getByRole('navigation',{name:'Tools',exact:true});
export function toolButton(page:Page,tool:Tool){
  const name=new RegExp(`^${tool}\\b`),rail=toolRail(page);
  return rail.getByRole('button',{name}).or(rail.getByRole('tab',{name})).or(rail.getByRole('link',{name}));
}
export const panel=(page:Page,tool:Tool)=>page.getByRole('region',{name:tool,exact:true});

/** S3: one tap on the rail opens the tool's panel (region named after the tool). */
export async function openTool(page:Page,tool:Tool){
  const region=panel(page,tool);
  if(!await region.isVisible())await toolButton(page,tool).click();
  await expect(region).toBeVisible();
  return region;
}

/** Make an existing control visible: as-is, else inside the given tool panels, else via the banner Share/Export entry. */
export async function reveal(page:Page,target:Locator,tools:readonly Tool[]=['Project']){
  if(await target.count())return target.first();
  if(await toolRail(page).count()){
    for(const tool of tools){await openTool(page,tool);if(await target.count())return target.first();}
  }
  const entry=page.getByRole('banner').getByRole('button',{name:/^(Share|Export)\b/i});
  if(await entry.count()===1){await entry.click();if(await target.count())return target.first();}
  return target.first();
}

/** Existing "Export drawing" download (the canonical drawing JSON), returned as raw text. */
export async function exportRaw(page:Page){
  const button=await reveal(page,page.getByRole('button',{name:'Export drawing',exact:true}).filter({visible:true}));
  const download=page.waitForEvent('download');
  await button.click();
  return readFile((await(await download).path())!,'utf8');
}
export async function exportDoc(page:Page){return JSON.parse(await exportRaw(page)) as Doc;}

export const undoButton=(page:Page)=>page.getByRole('button',{name:'Undo',exact:true}).filter({visible:true}).first();
export const redoButton=(page:Page)=>page.getByRole('button',{name:'Redo',exact:true}).filter({visible:true}).first();

export const drawingViewGroup=(page:Page)=>page.getByRole('group',{name:'Drawing view',exact:true});
export const threeView=(page:Page)=>page.getByTestId('three-view');

/** Opens 3D through the 2D / 3D / 2D+3D switch (group "Drawing view"). */
export async function open3d(page:Page){
  const group=drawingViewGroup(page).filter({visible:true}).first(),name=/^3D( view)?$/i;
  await group.getByRole('button',{name}).or(group.getByRole('radio',{name})).or(group.getByRole('tab',{name})).click();
  const view=threeView(page);
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute('data-quality-tier',/^(low|mid|high)$/,{timeout:30000});
  return view;
}

/** Chooses a tier through the existing quality control ("3D quality") in the 3D settings. Returns the tier in use. */
export async function chooseQuality(page:Page,tier:'auto'|'low'|'mid'|'high'){
  const visible=page.getByLabel('3D quality',{exact:true}).filter({visible:true});
  if(!await visible.count()){
    const settings=page.getByRole('button',{name:/^(3D settings|3D camera and quality|3D quality)/i}).filter({visible:true});
    if(await settings.count())await settings.first().click();
  }
  const select=await reveal(page,visible,['Project']);
  await select.selectOption(tier);
  const view=threeView(page);
  if(tier==='low'||tier==='mid')await expect(view).toHaveAttribute('data-quality-tier',tier,{timeout:30000});
  return (await view.getAttribute('data-quality-tier'))??'';
}

export async function attr(view:Locator,name:string){return view.getAttribute(name);}
export async function numAttr(view:Locator,name:string){const v=await view.getAttribute(name);return v===null||v.trim()===''?NaN:Number(v);}

export function polygon(doc:Doc,room:Room):[number,number][]{
  return room.boundary.map(id=>{const j=doc.junctions.find(k=>k.id===id);if(!j)throw Error(`room ${room.id} names missing junction ${id}`);return [j.x,j.y] as [number,number];});
}
export function area(poly:[number,number][]){let s=0;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i]!,[x2,y2]=poly[(i+1)%poly.length]!;s+=x1*y2-x2*y1;}return Math.abs(s)/2;}
export function inside(poly:[number,number][],[x,y]:[number,number]){
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i]!,[xj,yj]=poly[j]!;if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}
  return hit;
}
export const roomOf=(doc:Doc,test:(room:Room)=>boolean)=>{const room=doc.rooms.find(test);if(!room)throw Error('room not found in the exported drawing');return room;};
export const isBedroom=(room:Room)=>room.type==='bedroom'||/bed\s*room/i.test(room.name);
export const isLiving=(room:Room)=>room.type==='living'||/living/i.test(room.name);
export const activeFloorId=(doc:Doc)=>[...doc.floors].sort((a,b)=>a.level-b.level)[0]!.id;
