import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {clearFurnitureSymbolCache,DEFAULT_FURNITURE_FILL,furnitureSymbol} from '../editor/furniture-symbol';
import type {SymbolKind} from '../editor/furniture-symbol';

// D78: every latest shipped catalog asset gets its own top-view symbol inside its footprint. Claude-authored;
// the containment check is the hand-written rotation (x cos - y sin, x sin + y cos) projected back on the
// item's right (cos, sin) and back (-sin, cos) axes.
const catalog=JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8')) as {assets:{id:string;version:number;dims:{w:number;d:number;h:number}}[]};
const latest=[...catalog.assets.reduce((m,a)=>(m.get(a.id)?.version??0)<a.version?m.set(a.id,a):m,new Map<string,typeof catalog.assets[number]>()).values()];
const expectedKind:Record<string,SymbolKind>={a_demo_table:'table',a_l0_armchair:'armchair',a_l0_bench:'bench',a_l0_bookcase:'bookcase',a_l0_bunk_bed:'bunk',a_l0_coffee_table:'table',a_l0_console_table:'table',a_l0_dining_4:'dining_table',a_l0_dining_6:'dining_table',a_l0_dining_chair:'chair',a_l0_dining_set_4:'dining_set',a_l0_dining_set_6:'dining_set',a_l0_double_bed:'bed',a_l0_drawers:'drawers',a_l0_dressing_table:'dressing',a_l0_island:'island',a_l0_king_bed:'bed',a_l0_kitchen_base:'kitchen',a_l0_low_cabinet:'cabinet',a_l0_nightstand:'drawers',a_l0_planter:'plant',a_l0_queen_bed:'bed',a_l0_rug:'rug',a_l0_shoe_rack:'shoe',a_l0_side_table:'round_table',a_l0_single_bed:'bed',a_l0_sofa_2:'sofa',a_l0_sofa_3:'sofa',a_l0_sofa_l:'sofa_l',a_l0_stool:'stool',a_l0_study_desk:'desk',a_l0_tv_unit:'tv',a_l0_vanity:'vanity',a_l0_wall_cabinet:'wall_cabinet',a_l0_wardrobe_2:'wardrobe',a_l0_wardrobe_3:'wardrobe',a_l0_wardrobe_sliding:'sliding_wardrobe',a_l0_curtains:'curtain',a_l0_curtains_short:'curtain',a_l0_floor_lamp:'lamp',a_l0_table_lamp:'lamp',a_l0_wall_art:'picture'};

describe('D78 catalog symbols',()=>{
 it('every latest asset has a named (non-fallback) symbol',()=>{
  expect(latest.length).toBeGreaterThanOrEqual(37);
  for(const a of latest){const kind=furnitureSymbol(a.id,a.dims,null).kind;expect([a.id,kind]).toEqual([a.id,expectedKind[a.id]??kind]);expect([a.id,kind==='generic']).toEqual([a.id,false]);}
 });
 for(const deg of [0,90,180,270,33.5])it(`every drawn point lies inside the footprint at ${deg} degrees`,()=>{
  const cx=1234,cy=-567,r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  for(const a of latest)for(const finish of [null,'#3a3d40']){
   const symbol=furnitureSymbol(a.id,a.dims,finish);expect(symbol.paths.length).toBeGreaterThan(1);expect([a.id,symbol.clipped]).toEqual([a.id,false]);
   for(const path of symbol.paths)for(let i=0;i<path.points.length;i+=2){
    const x=path.points[i]!,y=path.points[i+1]!,wx=cx+x*c-y*s,wy=cy+x*s+y*c,along=(wx-cx)*c+(wy-cy)*s,across=-(wx-cx)*s+(wy-cy)*c;
    expect(Math.abs(along)).toBeLessThanOrEqual(a.dims.w/2+1e-6);expect(Math.abs(across)).toBeLessThanOrEqual(a.dims.d/2+1e-6);
   }
  }
 });
 it('is deterministic and uses the finish colour for the main part when one is set',()=>{
  for(const a of latest){
   const first=furnitureSymbol(a.id,a.dims,'#b5603f');clearFurnitureSymbolCache();const again=furnitureSymbol(a.id,a.dims,'#b5603f');
   expect(again).toEqual(first);expect(again).not.toBe(first);
   expect([a.id,first.main,first.paths.some(p=>p.fill==='#b5603f')]).toEqual([a.id,'#b5603f',true]);
   const plain=furnitureSymbol(a.id,a.dims,null);expect(plain.main).toBe(DEFAULT_FURNITURE_FILL);expect(plain.paths.some(p=>p.fill==='#b5603f')).toBe(false);
  }
 });
});
