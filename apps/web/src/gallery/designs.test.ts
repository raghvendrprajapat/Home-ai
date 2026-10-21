import {expect,it} from 'vitest';
import fc from 'fast-check';
import {parseProject,ProjectStore,serializeProject} from '@gharplan/core-model';
import type {RoomType} from '@gharplan/core-model';
import {createGalleryProject,GALLERY_IDS,galleryLayoutErrors} from './designs';
import type {GalleryAsset,GalleryId,GalleryOptions} from './designs';

// Codex-authored inputs: native dimensions from the specified published designs, not generated geometry outputs.
const assets:readonly GalleryAsset[]=[
 ['sofa_3',3,2100,860,820],['coffee_table',4,1100,600,450],['tv_unit',1,1800,400,440],['cane_lounge_chair',1,760,800,900],['floor_lamp',1,400,400,1600],
 ['king_bed',3,1900,2150,1100],['double_bed',3,1460,2150,1050],['queen_bed',3,1620,2150,1100],['single_bed',2,1000,2150,950],['compact_almirah',1,900,500,1800],['dining_chair',2,450,520,860],['round_dining_table',1,1100,1100,750],['kitchen_base',1,600,600,900],
].map(([id,version,w,d,h])=>({id:`a_l0_${id}`,version:version as number,dims:{w:w as number,d:d as number,h:h as number}}));
function options(design:GalleryId,units:'metric'|'imperial'='metric'):GalleryOptions{let n=0;const names:Partial<Record<RoomType,string>>={living:'Living room',kitchen:'Kitchen',dining:'Dining room',bedroom:'Bedroom',bathroom:'Bathroom',utility:'Utility'};return {design,name:`Furnished ${design}`,units,now:'2026-10-21T00:00:00.000Z',nextId:()=>`gp_${design}_${++n}`,roomName:type=>names[type]??type,hallName:'Hallway'};}

it.each([['1bhk',5,9,1],['2bhk',7,16,2],['3bhk',8,18,3]] as const)('D84 %s creates the specified bedrooms/rooms/furniture with valid geometry and clear access', (design,rooms,furniture,bedrooms)=>{
 const before=JSON.stringify(assets),d=createGalleryProject(options(design),assets),store=new ProjectStore(d,'gallery_test');
 expect(d.rooms).toHaveLength(rooms);expect(d.furniture).toHaveLength(furniture);expect(d.rooms.filter(r=>r.type==='bedroom')).toHaveLength(bedrooms);expect(d.floors).toHaveLength(1);expect(d.revision).toBe(0);
 expect(galleryLayoutErrors(d)).toEqual([]);expect(parseProject(serializeProject(d)).ok).toBe(true);expect(store.getSnapshot().derived.faces.every(f=>f.clearAreaMm2>0)).toBe(true);expect(store.getSnapshot().canUndo).toBe(false);
 for(const p of d.furniture){expect([p.position.x,p.position.y,p.elevation,p.size.w,p.size.d,p.size.h].every(Number.isInteger)).toBe(true);expect(assets.find(a=>a.id===p.assetId&&a.version===p.assetVersion)?.dims).toEqual(p.size);}
 expect(JSON.stringify(assets)).toBe(before);
});
it('D84 the third bedroom adds exactly3370²=11356900mm²; all original family room areas remain exact',()=>{
 const two=new ProjectStore(createGalleryProject(options('2bhk'),assets),'two'),three=new ProjectStore(createGalleryProject(options('3bhk'),assets),'three');
 const roomAreas=(s:ProjectStore)=>new Map(s.getSnapshot().document.rooms.map(r=>[r.name,s.getSnapshot().derived.faces.find(f=>f.roomId===r.id)!.clearAreaMm2]));
 const a=roomAreas(two),b=roomAreas(three);for(const [name,area]of a)expect(b.get(name)).toBe(area);expect(b.get('Bedroom 3')).toBe(11356900);expect([...b.values()].reduce((n,a)=>n+a,0)-[...a.values()].reduce((n,a)=>n+a,0)).toBe(11356900);
});
it('D84 returned documents serialize/load/edit/Undo exactly and imperial is display metadata only',()=>{
 for(const design of GALLERY_IDS){const d=createGalleryProject(options(design),assets),imperial=createGalleryProject(options(design,'imperial'),assets);expect({...imperial,units:'metric'}).toEqual(d);
  const before=serializeProject(d),store=new ProjectStore(d,'edit_gallery');expect(store.execute({type:'MoveFurniture',id:'gallery_edit',baseGeneration:0,furnitureIds:[d.furniture[0]!.id],dx:0,dy:100})).toMatchObject({ok:true,changed:true});expect(store.undo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);
 }
});
it('D84 missing immutable pins and invalid design IDs fail rather than creating placeholder examples',()=>{
 expect(()=>createGalleryProject(options('1bhk'),assets.filter(a=>a.id!=='a_l0_double_bed'))).toThrow('gallery-asset:a_l0_double_bed@3');expect(()=>createGalleryProject({...options('1bhk'),design:'unknown' as GalleryId},assets)).toThrow('gallery-design');
});
it('D84 the curated-layout checker actually rejects out-of-room and overlapping furniture',()=>{
 const a=createGalleryProject(options('1bhk'),assets);a.furniture[0]!.position={x:100000,y:100000};expect(galleryLayoutErrors(a)).toContain(`outside:${a.furniture[0]!.id}`);
 const b=createGalleryProject(options('1bhk'),assets);b.furniture[1]!.position={...b.furniture[0]!.position};expect(galleryLayoutErrors(b).some(e=>e.startsWith('overlap:'))).toBe(true);
});

it('D84 doorway, tall-window, front-access and dining clearances are enforced rather than silently repaired',()=>{
 const door=createGalleryProject(options('1bhk'),assets);door.furniture[1]!.position={x:1500,y:500};expect(galleryLayoutErrors(door)).toContain(`door:${door.furniture[1]!.id}`);
 const window=createGalleryProject(options('2bhk'),assets),wardrobe=window.furniture.find(f=>f.assetId==='a_l0_compact_almirah')!;wardrobe.position={x:10000,y:365};expect(galleryLayoutErrors(window)).toContain(`window:${wardrobe.id}`);
 const walk=createGalleryProject(options('1bhk'),assets),sofa=walk.furniture[0]!;sofa.rotationDeg=0;sofa.position={x:2500,y:600};expect(galleryLayoutErrors(walk)).toContain(`walkway:${sofa.id}`);
 const dining=createGalleryProject(options('2bhk'),assets),chair=dining.furniture.find(f=>f.assetId==='a_l0_dining_chair')!;chair.position.y=6500;expect(galleryLayoutErrors(dining).some(e=>e.startsWith('dining-clearance:'))).toBe(true);
});
it('D84 bathroom access is common, not dependent on passage through a bedroom',()=>{
 for(const design of GALLERY_IDS){const d=createGalleryProject(options(design),assets),bath=d.rooms.find(r=>r.type==='bathroom')!;const door=d.openings.find(o=>o.kind==='door'&&d.walls.some(w=>w.id===o.wallId&&bath.boundary.includes(w.a)&&bath.boundary.includes(w.b)));expect(door).toBeDefined();const host=d.walls.find(w=>w.id===door!.wallId)!,other=d.rooms.find(r=>r.id!==bath.id&&r.boundary.includes(host.a)&&r.boundary.includes(host.b));expect(other?.type).toBe(design==='1bhk'?'utility':'hall');}
});

it('D84 family room areas equal analytic inside-edge rectangles in exact mm²',()=>{
 const d=createGalleryProject(options('2bhk'),assets),s=new ProjectStore(d,'analytic_gallery');
 // Independently calculated clear spans: outer wall half115, partition half57.5 mm.
 const expected:Record<string,number>={'Living room':7027.5*5427.5,'Kitchen':3427.5*3627.5,'Dining room':3485*3627.5,'Bedroom':4627.5*4027.5,'Hallway':4627.5*1085,'Bathroom':1885*3827.5,'Bedroom 2':2627.5*3827.5};
 for(const room of d.rooms)expect(s.getSnapshot().derived.faces.find(f=>f.roomId===room.id)!.clearAreaMm2).toBe(expected[room.name]);
});
it('D84 integer translation preserves exact clear areas, door/window access, furniture clearance and serialization',()=>{
 const originals=new Map(GALLERY_IDS.map(id=>[id,createGalleryProject(options(id),assets)]));
 fc.assert(fc.property(fc.constantFrom(...GALLERY_IDS),fc.integer({min:-10000,max:10000}),fc.integer({min:-10000,max:10000}),(id,dx,dy)=>{
  const original=originals.get(id)!,d=JSON.parse(serializeProject(original));for(const j of d.junctions){j.x+=dx;j.y+=dy;}for(const f of d.furniture){f.position.x+=dx;f.position.y+=dy;}
  expect(galleryLayoutErrors(d)).toEqual([]);expect(parseProject(serializeProject(d)).ok).toBe(true);
  const areas=(doc:typeof original)=>new ProjectStore(doc,'translated_gallery').getSnapshot().derived.faces.map(f=>f.clearAreaMm2).sort((a,b)=>a-b);
  expect(areas(d)).toEqual(areas(original));expect(d.openings).toEqual(original.openings);
 }),{numRuns:20});
});
