import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {parseProject} from '@gharplan/core-model';
import fixture from '../../../../docs/examples/sample-project.json';
import {showcaseSample} from './showcase';

// D76 R3 furnished first-run sample. Claude-authored; room interiors and door spans are hand-derived from the
// fixture: walls 230 mm on the 0/4500/8000 x 0/5000 grid, main door x 2500–3500 (south), bedroom door y 550–1450.
const catalog=JSON.parse(await readFile(new URL('../../public/catalog/catalog.json',import.meta.url),'utf8')) as {assets:{id:string;version:number;dims:{w:number;d:number;h:number}}[]};
const latest=(id:string)=>Math.max(...catalog.assets.filter(a=>a.id===id).map(a=>a.version));
const parsed=parseProject(JSON.stringify(showcaseSample()));if(!parsed.ok)throw new Error('showcase invalid');
const doc=parsed.document;
const box=(f:typeof doc.furniture[number])=>{const quarter=f.rotationDeg%180!==0,w=quarter?f.size.d:f.size.w,d=quarter?f.size.w:f.size.d;return [f.position.x-w/2,f.position.y-d/2,f.position.x+w/2,f.position.y+d/2] as const;};
const living=[115,115,4385,4885],bedroom=[4615,115,7885,4885];
const inside=(b:readonly number[],r:readonly number[])=>b[0]!>=r[0]!&&b[1]!>=r[1]!&&b[2]!<=r[2]!&&b[3]!<=r[3]!;
const overlap=(a:readonly number[],b:readonly number[])=>a[0]!<b[2]!&&b[0]!<a[2]!&&a[1]!<b[3]!&&b[1]!<a[3]!;

describe('D76 furnished first-run sample',()=>{
 it('keeps the fixture walls, rooms, openings and materials exactly, adding only the two finish definitions it uses',()=>{
  const f=fixture as unknown as typeof doc;
  expect(doc.walls).toEqual(f.walls);expect(doc.rooms).toEqual(f.rooms);expect(doc.openings).toEqual(f.openings);
  // Fixture materials unchanged, then walnut (#5b3a29) and white (#f2f0eb) from the FR-022 finish library.
  expect(doc.materials.slice(0,f.materials.length)).toEqual(f.materials);
  expect(doc.materials.slice(f.materials.length).map(m=>[m.id,m.baseColor])).toEqual([['m_fin_walnut','#5b3a29'],['m_fin_white','#f2f0eb']]);
  expect(Object.fromEntries(doc.furniture.filter(x=>Object.keys(x.materialOverrides).length).map(x=>[x.id,x.materialOverrides.main]))).toEqual({fu_tv:'m_fin_walnut',fu_coffee:'m_fin_walnut',fu_nightstand:'m_fin_walnut',fu_armchair:'m_fin_white',fu_wardrobe:'m_fin_white'});
 });
 it('uses the newest catalog version of real models at their catalog sizes, including the five R3 pieces',()=>{
  for(const f of doc.furniture){expect(f.assetVersion,f.id).toBe(latest(f.assetId));expect(f.size,f.id).toEqual(catalog.assets.find(a=>a.id===f.assetId&&a.version===f.assetVersion)!.dims);}
  expect(doc.furniture.map(f=>f.assetId)).toEqual(expect.arrayContaining(['a_l0_sofa_3','a_l0_coffee_table','a_l0_tv_unit','a_l0_king_bed','a_l0_wardrobe_sliding']));
 });
 it('every piece is on its room floor, nothing overlaps, and both door spans stay clear',()=>{
  const inLiving=['fu_tv','fu_sofa','fu_coffee','fu_armchair','fu_plant','fu_rug'];
  for(const f of doc.furniture)expect(inside(box(f),inLiving.includes(f.id)?living:bedroom),f.id).toBe(true);
  // The 10 mm rug lies under the coffee table on purpose (rug x 500–2100, y 2800–3800); every other pair is apart.
  for(const a of doc.furniture)for(const b of doc.furniture)if(a.id<b.id)expect(overlap(box(a),box(b)),`${a.id}/${b.id}`).toBe(a.id==='fu_coffee'&&b.id==='fu_rug');
  // Swing zones (one door width into each side): main door x 2500–3500, y 3885–4885 inside; bedroom door y 550–1450, x 4615–5515.
  for(const f of doc.furniture){expect(overlap(box(f),[2500,3885,3500,4885]),f.id).toBe(false);expect(overlap(box(f),[4615,550,5515,1450]),f.id).toBe(false);expect(overlap(box(f),[3485,550,4385,1450]),f.id).toBe(false);}
 });
 it('backs go to the walls: TV unit and bed face south (180), sofa and wardrobe face north (0), armchair faces west (270)',()=>{
  const rot=Object.fromEntries(doc.furniture.map(f=>[f.id,f.rotationDeg]));
  expect([rot.fu_tv,rot.fu_bed,rot.fu_sofa,rot.fu_wardrobe,rot.fu_armchair]).toEqual([180,180,0,0,270]);
 });
});
