import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {clearFurnitureSymbolCache,DEFAULT_FURNITURE_FILL,furnitureSymbol,mixColor,orderedFurniture,paintFurnitureSymbol,symbolKind,SYMBOL_DETAIL_PX} from './furniture-symbol';
import type {FurnitureSymbol,SymbolCanvas} from './furniture-symbol';

// D78 2D furniture symbols. Claude-authored; expectations are hand-derived from the documented local frame
// (+x right, +y back, origin = centre) and the screen rotation used by Konva and the plan PNG.
const pointsOf=(symbol:FurnitureSymbol)=>symbol.paths.flatMap(p=>{const out:[number,number][]=[];for(let i=0;i<p.points.length;i+=2)out.push([p.points[i]!,p.points[i+1]!]);return out;});
/** Screen rotation by `deg` (clockwise on a y-down screen) then translation, written out by hand. */
const toWorld=([x,y]:[number,number],cx:number,cy:number,deg:number):[number,number]=>{const r=deg*Math.PI/180;return [cx+x*Math.cos(r)-y*Math.sin(r),cy+x*Math.sin(r)+y*Math.cos(r)];};
const inside=(p:[number,number],cx:number,cy:number,deg:number,w:number,d:number,eps=1e-6)=>{const r=deg*Math.PI/180,dx=p[0]-cx,dy=p[1]-cy;return Math.abs(dx*Math.cos(r)+dy*Math.sin(r))<=w/2+eps&&Math.abs(-dx*Math.sin(r)+dy*Math.cos(r))<=d/2+eps;};
const pointInPolygon=(x:number,y:number,poly:readonly number[])=>{let hit=false;for(let i=0,j=poly.length-2;i<poly.length;j=i,i+=2){const xi=poly[i]!,yi=poly[i+1]!,xj=poly[j]!,yj=poly[j+1]!;if(yi>y!==yj>y&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;};

describe('D78 symbol choice by asset id words',()=>{
 it('maps the older fixture ids, new decor words and unknown ids',()=>{
  const expected:Record<string,string>={a_sofa_3seat:'sofa',a_tv_unit:'tv',a_bed_queen:'bed',a_wardrobe_3door:'wardrobe',a_l0_floor_lamp:'lamp',a_l0_pendant_light:'lamp',a_l0_curtain_pair:'curtain',a_l0_wall_picture:'picture',a_l0_wall_art:'picture',a_l0_photo_frame:'picture',a_l0_bed_frame:'bed',a_l0_wall_mirror:'picture',a_l0_mirror_cabinet:'cabinet',a_l0_storage_bench:'bench',a_l0_mattress:'bed',a_l0_lounge_chair:'armchair',a_l0_corner_sofa:'sofa_l',a_l0_bedside_table:'drawers',a_l0_end_table:'round_table',a_l0_floor_mat:'rug',a_l0_kitchen_tall:'kitchen',a_l0_overhead_unit:'wall_cabinet',a_l0_xyz:'generic',a_l0_mystery_thing:'generic'};
  for(const [id,kind] of Object.entries(expected))expect([id,symbolKind(id)]).toEqual([id,kind]);
 });
 it('draw order puts rugs first and wall-hung pieces last, keeping document order within a layer',()=>{
  const items=[{id:1,assetId:'a_l0_wall_picture'},{id:2,assetId:'a_l0_sofa_3'},{id:3,assetId:'a_l0_rug'},{id:4,assetId:'a_l0_coffee_table'},{id:5,assetId:'a_l0_carpet_runner'}];
  expect(orderedFurniture(items).map(i=>i.id)).toEqual([3,5,2,4,1]);
 });
});

describe('D78 hand-derived symbol geometry',()=>{
 it('a king bed headboard is a band at the back (+y); rotated 90 degrees it faces -x',()=>{
  // w 1900, d 2150: headboard depth = clamp(2150 * 0.045, 30, 120) = 96.75 mm, so it spans y 978.25..1075.
  const bed=furnitureSymbol('a_l0_king_bed',{w:1900,d:2150},null),head=bed.paths[1]!;
  expect(bed.kind).toBe('bed');
  for(let i=0;i<head.points.length;i+=2){expect(head.points[i+1]!).toBeGreaterThanOrEqual(978.25-1e-9);expect(head.points[i+1]!).toBeLessThanOrEqual(1075+1e-9);expect(Math.abs(head.points[i]!)).toBeLessThanOrEqual(950+1e-9);}
  // Rotation 90: back = (-sin, cos) = (-1, 0), so world x = cx - y lies in [cx - 1075, cx - 978.25].
  for(let i=0;i<head.points.length;i+=2){const [x]=toWorld([head.points[i]!,head.points[i+1]!],5000,3000,90);expect(x).toBeGreaterThanOrEqual(5000-1075-1e-6);expect(x).toBeLessThanOrEqual(5000-978.25+1e-6);}
 });
 it('the sofa centre is plain seat cushion in the main colour (no detail line), with or without a finish',()=>{
  // Fixture sofa 2000 x 900: back 180 + back cushions 153 leave seats from y -427.5 to 117; 3 seats of 540 mm.
  for(const finish of [null,'#2f3e5c']){
   const sofa=furnitureSymbol('a_sofa_3seat',{w:2000,d:900},finish),main=finish??DEFAULT_FURNITURE_FILL;
   const top=[...sofa.paths].reverse().find(p=>p.closed&&p.fill&&pointInPolygon(0,0,p.points))!;
   expect(top.fill).toBe(main);
   const lines=sofa.paths.filter(p=>!p.closed);expect(lines).toEqual([]);
  }
 });
 it('dining sets place one chair per seat around the table: 4 = 2 + 2, 6 = 2 + 2 + 2 ends',()=>{
  const seats=(id:string,w:number,d:number)=>furnitureSymbol(id,{w,d},null).paths.filter(p=>p.fill===mixColor(DEFAULT_FURNITURE_FILL,'#ffffff',.4)).length;
  expect(seats('a_l0_dining_set_4',1200,1540)).toBe(4);expect(seats('a_l0_dining_set_6',2540,1640)).toBe(6);
 });
 it('mixColor is plain per-channel interpolation',()=>{
  expect(mixColor('#000000','#ffffff',.5)).toBe('#808080');expect(mixColor('#c8af90','#000000',0)).toBe('#c8af90');expect(mixColor('#fff','#000',1)).toBe('#000000');expect(mixColor('rgb(1,2,3)','#000',.5)).toBe('rgb(1,2,3)');
 });
});

describe('D78 painter',()=>{
 const recorder=()=>{const calls:{op:string;x?:number;y?:number}[]=[];const ctx:SymbolCanvas={beginPath:()=>calls.push({op:'begin'}),moveTo:(x,y)=>calls.push({op:'move',x,y}),lineTo:(x,y)=>calls.push({op:'line',x,y}),closePath:()=>calls.push({op:'close'}),fill:()=>calls.push({op:'fill'}),stroke:()=>calls.push({op:'stroke'}),fillStyle:'',strokeStyle:'',lineWidth:1};return {ctx,calls};};
 it('scales millimetres to pixels inside the footprint and strokes the exact footprint for the selection outline',()=>{
  const symbol=furnitureSymbol('a_l0_sofa_l',{w:2500,d:1600},null),{ctx,calls}=recorder();paintFurnitureSymbol(ctx,symbol,.1,{color:'#b6723f',width:3});
  for(const c of calls)if(c.x!==undefined){expect(Math.abs(c.x)).toBeLessThanOrEqual(125+1e-9);expect(Math.abs(c.y!)).toBeLessThanOrEqual(80+1e-9);}
  const outline=calls.slice(-7);expect(outline.map(c=>[c.op,c.x,c.y])).toEqual([['begin',undefined,undefined],['move',-125,-80],['line',125,-80],['line',125,80],['line',-125,80],['close',undefined,undefined],['stroke',undefined,undefined]]);
  expect(ctx.strokeStyle).toBe('#b6723f');expect(ctx.lineWidth).toBe(3);
 });
 it('skips fine details when the item is small on screen and works without setLineDash (wall cabinet dashes)',()=>{
  const symbol=furnitureSymbol('a_l0_wall_cabinet',{w:800,d:350},null),big=recorder(),small=recorder();
  paintFurnitureSymbol(big.ctx,symbol,.2,null);paintFurnitureSymbol(small.ctx,symbol,(SYMBOL_DETAIL_PX-1)/350,null);
  const begins=(calls:{op:string}[])=>calls.filter(c=>c.op==='begin').length;
  expect(begins(big.calls)).toBe(symbol.paths.length);expect(begins(small.calls)).toBe(symbol.paths.filter(p=>!p.detail).length);expect(begins(small.calls)).toBeLessThan(begins(big.calls));
 });
});

describe('D78 property: every symbol stays inside its rotated footprint',()=>{
 const ids=['a_l0_king_bed','a_l0_bunk_bed','a_l0_sofa_2','a_l0_sofa_l','a_l0_armchair','a_l0_dining_set_6','a_l0_dining_chair','a_l0_tv_unit','a_l0_wardrobe_sliding','a_l0_bookcase','a_l0_island','a_l0_rug','a_l0_planter','a_l0_floor_lamp','a_l0_curtain','a_l0_wall_picture','a_l0_study_desk','a_l0_stool','a_unknown'];
 it('for random ids, sizes, finishes, positions and free angles (deterministic too)',()=>{
  fc.assert(fc.property(fc.oneof(fc.constantFrom(...ids),fc.stringMatching(/^a_[a-z0-9_]{1,20}$/)),fc.integer({min:20,max:6000}),fc.integer({min:10,max:6000}),fc.option(fc.constantFrom('#2f3e5c','#f2f0eb','#9a6b43')),fc.integer({min:-20000,max:20000}),fc.integer({min:-20000,max:20000}),fc.double({min:-720,max:720,noNaN:true}),(id,w,d,finish,cx,cy,deg)=>{
   const symbol=furnitureSymbol(id,{w,d},finish);clearFurnitureSymbolCache();expect(furnitureSymbol(id,{w,d},finish)).toEqual(symbol);
   // The edge guard is only for degenerate tiny items; from 150 mm per side the geometry fits on its own.
   if(Math.min(w,d)>=150)expect(symbol.clipped).toBe(false);
   for(const p of pointsOf(symbol)){expect(Number.isFinite(p[0])&&Number.isFinite(p[1])).toBe(true);expect(inside(toWorld(p,cx,cy,deg),cx,cy,deg,w,d,1e-6*Math.max(w,d,Math.abs(cx),Math.abs(cy)))).toBe(true);}
  }),{seed:20261020,numRuns:300});
 });
});
