import {createBlankProject,createTemplateProject,ProjectStore,serializeProject} from '@gharplan/core-model';
import type {Command,ProjectDoc,RoomType,TemplateOptions} from '@gharplan/core-model';
import {surfaceLibrary,surfaceTextureLibrary} from '../editor/material-library';
import {footprint,frontZone,insideFloor,layoutRoom,overlaps,LOW_ITEM_MM} from '../ai/layout';
import type {Rect,Turn} from '../ai/layout';

export const GALLERY_IDS=['1bhk','2bhk','3bhk'] as const;
export type GalleryId=typeof GALLERY_IDS[number];
export interface GalleryAsset {readonly id:string;readonly version:number;readonly dims:Readonly<{w:number;d:number;h:number}>}
export interface GalleryOptions extends Omit<TemplateOptions,'template'> {design:GalleryId;hallName?:string}
type Piece=readonly [id:string,version:number,x:number,y:number,rotation:Turn];
const at=(r:Rect,x:number,y:number)=>x>r[0]&&x<r[2]&&y>r[1]&&y<r[3];
const owned=(store:ProjectStore)=>JSON.parse(serializeProject(store.getSnapshot().document)) as ProjectDoc;

/** Read-only geometric checks for these authored examples, separate from AI layout acceptance/provider rules. */
export function galleryLayoutErrors(document:ProjectDoc):string[]{
 const snap=new ProjectStore(document,'gallery_validation').getSnapshot(),errors:string[]=[];
 const pieces=document.furniture.map(f=>({f,box:footprint(f.size,f.position.x,f.position.y,f.rotationDeg as Turn)}));
 for(const {f,box} of pieces){
  const face=snap.derived.faces.find(face=>face.clearRects.some(r=>at(r,f.position.x,f.position.y))),room=document.rooms.find(r=>r.id===face?.roomId);
  if(!face||!room||!insideFloor(box,face.clearRects)){errors.push(`outside:${f.id}`);continue;}
  const facts=layoutRoom(document,face,room.type as RoomType,f.floorId);
  if(facts.doors.some(d=>overlaps(box,d)))errors.push(`door:${f.id}`);
  if(f.size.h>LOW_ITEM_MM&&facts.windows.some(w=>f.size.h>w.sill&&overlaps(box,w.zone)))errors.push(`window:${f.id}`);
  const access=/sofa|cane_lounge_chair|_bed$|almirah|kitchen_base|tv_unit/.test(f.assetId);
  if(access){const walk=frontZone(box,f.rotationDeg as Turn);if(!insideFloor(walk,face.clearRects)||pieces.some(p=>p.f.id!==f.id&&p.f.size.h>LOW_ITEM_MM&&overlaps(walk,p.box)))errors.push(`walkway:${f.id}`);}
 }
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++)if(overlaps(pieces[i]!.box,pieces[j]!.box))errors.push(`overlap:${pieces[i]!.f.id}:${pieces[j]!.f.id}`);
 // Dining chairs intentionally face the table. Instead of demanding a front strip through the tabletop,
 // require a clear 600 mm ring around the whole table/chair group, with no other furniture in that room.
 for(const room of document.rooms.filter(r=>r.type==='dining')){
  const face=snap.derived.faces.find(f=>f.roomId===room.id);if(!face)continue;const dining=pieces.filter(p=>face.clearRects.some(r=>at(r,p.f.position.x,p.f.position.y)));
  if(dining.length){const x0=Math.min(...dining.map(p=>p.box[0])),y0=Math.min(...dining.map(p=>p.box[1])),x1=Math.max(...dining.map(p=>p.box[2])),y1=Math.max(...dining.map(p=>p.box[3]));if(!insideFloor([x0-600,y0-600,x1+600,y1+600],face.clearRects))errors.push(`dining-clearance:${room.id}`);}
 }
 return errors;
}

/** Creates a fresh, editable example through real commands only. No storage/renderer/provider is involved. */
export function createGalleryProject(options:GalleryOptions,assets:readonly GalleryAsset[]):ProjectDoc{
 if(!GALLERY_IDS.includes(options.design))throw new Error('gallery-design');
 const base=options.design==='1bhk'?createTemplateProject({...options,template:'1bhk'}):createBlankProject(options);
 const store=new ProjectStore(base,`gallery_${options.design}`,{now:()=>options.now});let step=0;
 const command=(value:Record<string,unknown>)=>({id:`gallery_${options.design}_${step++}`,baseGeneration:store.getSnapshot().localGeneration,...value}) as Command;
 const run=(value:Record<string,unknown>)=>{const result=store.execute(command(value));if(!result.ok)throw new Error(`gallery-command:${value.type}:${result.errors[0]?.code}`);};
 const faceAt=(x:number,y:number)=>store.getSnapshot().derived.faces.find(f=>f.clearRects.some(r=>at(r,x,y)));
 const wall=(from:readonly[number,number],to:readonly[number,number],keep:readonly[number,number])=>{
  const face=faceAt(...keep),value={type:'AddWall',from,to,thickness:115,height:base.floors[0]!.defaultWallHeight};let result=store.execute(command(value));
  if(!result.ok&&result.errors[0]?.code==='ambiguous-room'&&face)result=store.execute(command({...value,roomChoices:[{roomId:face.roomId,point:keep}]}));
  if(!result.ok)throw new Error(`gallery-wall:${result.errors[0]?.code}`);
 };
 const opening=(x:number,y:number,kind:'door'|'window'|'opening',width:number,height=2100,sill=0)=>{
  const d=store.getSnapshot().document,atJ=new Map(d.junctions.map(j=>[j.id,j]));
  const hosts=d.walls.filter(w=>{const a=atJ.get(w.a)!,b=atJ.get(w.b)!;return a.y===b.y?a.y===y&&x>Math.min(a.x,b.x)&&x<Math.max(a.x,b.x):a.x===x&&y>Math.min(a.y,b.y)&&y<Math.max(a.y,b.y);});
  if(hosts.length!==1)throw new Error('gallery-opening-host');const host=hosts[0]!,a=atJ.get(host.a)!;
  run({type:'AddOpening',opening:{id:options.nextId(),wallId:host.id,kind,assetId:kind==='window'?'window_asset':'door_asset',offset:Math.abs(x-a.x)+Math.abs(y-a.y),width,height,sill,flipX:false,flipY:false}});
 };
 if(options.design==='1bhk'){
  // The furnished example gives the bathroom common access from the utility, instead of through the bedroom.
  // The original unfurnished starter and existing saved drawings remain unchanged.
  const d=store.getSnapshot().document,js=new Map(d.junctions.map(j=>[j.id,j]));
  const bathDoor=d.openings.find(o=>{const w=d.walls.find(w=>w.id===o.wallId)!,a=js.get(w.a)!,b=js.get(w.b)!;return o.kind==='door'&&a.y===3000&&b.y===3000;});
  if(!bathDoor)throw new Error('gallery-bath-door');run({type:'DeleteOpening',openingId:bathDoor.id});opening(5700,4500,'door',750);
 }
 if(options.design!=='1bhk'){
  run({type:'AddRectangle',x:0,y:0,width:12000,depth:9400,thickness:230,height:base.floors[0]!.defaultWallHeight});
  wall([7200,0],[7200,9400],[3600,2400]);wall([0,5600],[7200,5600],[3600,2400]);wall([3600,5600],[3600,9400],[1800,7500]);
  wall([7200,4200],[12000,4200],[9600,2100]);wall([7200,5400],[12000,5400],[9600,4800]);wall([9200,5400],[9200,9400],[8200,7500]);
  const rooms:readonly [number,number,RoomType][]=[[3600,2400,'living'],[1800,7500,'kitchen'],[5400,7500,'dining'],[9600,2100,'bedroom'],[9600,4800,'hall'],[8200,7500,'bathroom'],[10600,7500,'bedroom']];const counts=new Map<RoomType,number>();
  for(const [x,y,type] of rooms){const f=faceAt(x,y);if(!f)throw new Error('gallery-room');const n=(counts.get(type)??0)+1;counts.set(type,n);const label=type==='hall'?options.hallName??options.roomName(type):options.roomName(type);run({type:'UpdateRoom',roomId:f.roomId,properties:{type,name:n===1?label:`${label} ${n}`}});}
  opening(1800,0,'door',1000);opening(1800,5600,'door',900);opening(5400,5600,'opening',1500);opening(7200,2100,'door',900);opening(7200,4800,'opening',900);opening(8200,5400,'door',750);opening(9800,5400,'door',750);
  for(const [x,y,w] of [[5000,0,1800],[0,2400,1800],[9600,0,1800],[12000,2100,1500],[0,7600,1500],[1800,9400,1500],[5400,9400,1500],[11000,9400,1200],[12000,7400,1500]])opening(x!,y!,'window',w!,1200,900);
  opening(8200,9400,'window',600,600,1500);
 }
 if(options.design==='3bhk'){
  const before=store.getSnapshot().document,atJ=new Map(before.junctions.map(j=>[j.id,j]));
  const window=before.openings.find(o=>{const w=before.walls.find(w=>w.id===o.wallId)!,a=atJ.get(w.a)!,b=atJ.get(w.b)!;return o.kind==='window'&&a.x===0&&b.x===0&&Math.min(a.y,b.y)<2400&&Math.max(a.y,b.y)>2400;});if(!window)throw new Error('gallery-wing-window');
  run({type:'AddRectangle',x:-3600,y:0,width:3600,depth:3600,thickness:230,height:base.floors[0]!.defaultWallHeight});run({type:'DeleteOpening',openingId:window.id});opening(0,700,'door',900);opening(-3600,1800,'window',1500,1200,900);
  const f=faceAt(-1800,1800);if(!f)throw new Error('gallery-wing-room');run({type:'UpdateRoom',roomId:f.roomId,properties:{name:`${options.roomName('bedroom')} 3`,type:'bedroom'}});
 }
 const family=options.design!=='1bhk';
 const pieces:Piece[]=family?[
  ['a_l0_sofa_3',3,545,2400,90],['a_l0_coffee_table',4,2200,2400,0],['a_l0_cane_lounge_chair',1,3500,3800,270],['a_l0_tv_unit',1,4200,315,180],['a_l0_floor_lamp',1,2000,3500,0],
  ['a_l0_king_bed',3,9600,3065,0],['a_l0_compact_almirah',1,7900,365,180],['a_l0_single_bed',2,11000,6535,180],['a_l0_compact_almirah',1,9800,9035,0],
  ['a_l0_round_dining_table',1,5400,7500,0],['a_l0_dining_chair',2,5400,6660,180],['a_l0_dining_chair',2,5400,8340,0],['a_l0_dining_chair',2,4560,7500,90],['a_l0_dining_chair',2,6240,7500,270],
  ['a_l0_kitchen_base',1,1100,8985,0],['a_l0_kitchen_base',1,1700,8985,0],
 ]:[
  ['a_l0_sofa_3',3,545,2000,90],['a_l0_coffee_table',4,2300,1900,0],['a_l0_cane_lounge_chair',1,3300,2500,0],['a_l0_tv_unit',1,3100,315,180],['a_l0_floor_lamp',1,3500,3300,0],
  ['a_l0_double_bed',3,6000,1865,0],['a_l0_compact_almirah',1,4750,2690,0],['a_l0_kitchen_base',1,1100,5585,0],['a_l0_kitchen_base',1,1700,5585,0],
 ];
 if(options.design==='3bhk')pieces.push(['a_l0_queen_bed',3,-2200,2410,0],['a_l0_compact_almirah',1,-800,3235,0]);
 const furniture=pieces.map(([id,version,x,y,rotationDeg])=>{const asset=assets.find(a=>a.id===id&&a.version===version);if(!asset)throw new Error(`gallery-asset:${id}@${version}`);return {id:options.nextId(),floorId:base.floors[0]!.id,assetId:id,assetVersion:version,position:{x,y},elevation:0,rotationDeg,size:{...asset.dims},materialOverrides:{}};});
 run({type:'AddFurnitureBatch',furniture});
 const materials=[...surfaceLibrary,...surfaceTextureLibrary].map(e=>e.material),white=materials.find(m=>m.id==='m_paint_white')!;
 run({type:'ApplySurfaceMaterials',targets:store.getSnapshot().document.walls.flatMap(w=>[{kind:'wall',id:w.id,side:'left'},{kind:'wall',id:w.id,side:'right'}]),material:white});
 for(const room of store.getSnapshot().document.rooms){const id=room.type==='bedroom'?'m_wood_walnut':room.type==='kitchen'?'m_tile_terracotta':room.type==='dining'?'m_marble_white':'m_tile_vitrified';run({type:'ApplySurfaceMaterial',target:{kind:'floor',id:room.id},material:materials.find(m=>m.id===id)!});}
 const result=owned(store),errors=galleryLayoutErrors(result);if(errors.length)throw new Error(`gallery-layout:${errors.join(',')}`);return result;
}
