import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import sample from '../../../../docs/examples/sample-project.json';
import {ProjectStore} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import type {CatalogAsset} from '../catalog/catalog';
import {acceptLayout,acceptLayouts,adjustPlacement,footprint,frontZone,insideFloor,layoutRoom,overlaps,placementProblem} from './layout';
import type {LayoutPlacement,LayoutRoom,Rect} from './layout';
import {planLayout,planLayouts,standInAi} from './stand-in';

// D73 AI-2 Claude-authored checks. Expected positions are worked out by hand from the stated rules; see
// docs/verification/d73-ai-furniture.md for the arithmetic.
const asset=(id:string,w:number,d:number,h:number,category='test'):CatalogAsset=>({id,version:1,name_en:id,name_hi:id,category,tags:[],dims:{w,d,h},lods:[],thumb:{path:'',sha256:'',bytes:0,width:256,height:256}});
const room=(w:number,d:number,extra:Partial<LayoutRoom>={}):LayoutRoom=>({roomType:'bedroom',clearRects:[[0,0,w,d]],bounds:[0,0,w,d],doors:[],windows:[],obstacles:[],...extra});
const plain=(list:readonly LayoutPlacement[])=>list.map(p=>[p.asset.id,p.x,p.y,p.rotationDeg]);
const king=asset('a_l0_king_bed',1900,2150,1100,'beds'),nightstand=asset('a_l0_nightstand',450,400,520,'tables'),wardrobe=asset('a_l0_wardrobe_sliding',1800,650,2100,'storage');
const sofa=asset('a_l0_sofa_3',2100,860,820,'seating'),tv=asset('a_l0_tv_unit',1800,400,440,'storage'),coffee=asset('a_l0_coffee_table',1100,600,450,'tables'),rug=asset('a_l0_rug',1600,1000,10,'rugs');

describe('D73 layout geometry',()=>{
 it('footprints turn with the item and the walkway is on the front side (0° faces north, 90° east)',()=>{
  expect(footprint({w:2000,d:900},1000,1000,0)).toEqual([0,550,2000,1450]);
  expect(footprint({w:2000,d:900},1000,1000,90)).toEqual([550,0,1450,2000]);
  expect(frontZone([0,550,2000,1450],0)).toEqual([0,-50,2000,550]);
  expect(frontZone([0,550,2000,1450],180)).toEqual([0,1450,2000,2050]);
  expect(frontZone([550,0,1450,2000],90)).toEqual([1450,0,2050,2000]);
  expect(frontZone([550,0,1450,2000],270)).toEqual([-50,0,550,2000]);
 });
 it('touching boxes do not overlap; a box is on the floor only when fully covered by the clear rectangles',()=>{
  expect(overlaps([0,0,10,10],[10,0,20,10])).toBe(false);expect(overlaps([0,0,10,10],[9,9,20,20])).toBe(true);
  const L:Rect[]=[[0,0,4000,2000],[0,2000,2000,4000]];
  expect(insideFloor([100,100,3900,1900],L)).toBe(true);expect(insideFloor([100,1500,1900,3900],L)).toBe(true);
  expect(insideFloor([1500,1500,2500,2500],L)).toBe(false); // the missing corner of the L
 });
});

describe('D73 placementProblem and acceptLayout (the trust boundary)',()=>{
 const r=room(3000,4000,{doors:[[0,1000,900,1900]],windows:[{zone:[1000,0,2000,100],sill:900}],obstacles:[{rect:[2500,3500,3000,4000],h:700},{rect:[0,3000,2000,4000],h:10}]});
 const at=(a:CatalogAsset,x:number,y:number,rotationDeg:0|90|180|270=0):LayoutPlacement=>({asset:a,x,y,rotationDeg});
 it('names each refusal',()=>{
  expect(placementProblem(r,[],at(nightstand,2900,200,180))).toBe('outside'); // box reaches x 3125
  expect(placementProblem(r,[],at(nightstand,2650,3500))).toBe('overlap'); // existing 700 mm item
  expect(placementProblem(r,[],at(nightstand,500,1400,90))).toBe('door');
  expect(placementProblem(r,[],at(wardrobe,1500,325,180))).toBe('window'); // 2100 mm tall over a 900 mm sill
  expect(placementProblem(r,[],at(asset('a_low',1000,400,800),1500,200,180))).toBeUndefined(); // 800 mm is under the sill
  expect(placementProblem(r,[],at(wardrobe,1500,3675,180))).toBe('walkway'); // on the south wall facing the wall: walkway y 4000–4600 is outside
  expect(placementProblem(r,[],at(rug,1000,3500))).toBeUndefined(); // flat existing rug is not an obstacle
  expect(placementProblem(r,[],at(nightstand,2725,2900,180))).toBe('walkway'); // walkway y 3100–3700 meets the 700 mm item
 });
 it('keeps a low table in a walkway but refuses a tall item there, and checks items against those accepted before',()=>{
  const bed=at(king,1500,1075,180); // walkway y 2150–2750
  expect(placementProblem(r,[bed],at(coffee,1500,2450,180))).toBeUndefined();
  expect(placementProblem(r,[bed],at(nightstand,1500,2400,180))).toBe('walkway');
  expect(placementProblem(r,[bed],at(nightstand,1500,1000,180))).toBe('overlap');
 });
 it('an entry may stand for an idea with one of its options, once per idea',()=>{
  const queen=asset('a_l0_queen_bed',1620,2150,1100,'beds'),other=asset('a_other',800,400,700);
  const options=new Map([[king.id,[king,queen]]]);
  const out=acceptLayout([
   {assetId:queen.id,for:king.id,x:1500,y:1075,rotationDeg:180}, // the queen stands for the king idea
   {assetId:king.id,x:1500,y:2925,rotationDeg:0}, // the king idea is already placed
   {assetId:other.id,for:nightstand.id,x:225,y:200,rotationDeg:180}, // not an option of the bedside table
   {assetId:queen.id,x:1500,y:2925,rotationDeg:0}, // the queen alone is not an idea
  ],room(3000,4000),[king,nightstand],options);
  expect(out.placed.map(p=>[p.asset.id,p.ideaId])).toEqual([[queen.id,king.id]]);
  expect(out.skipped.map(a=>a.id)).toEqual([nightstand.id]);
 });
 it('acceptLayouts takes up to three layouts and drops empty and repeated ones',()=>{
  const a={assetId:king.id,x:1500,y:1075,rotationDeg:180},b={assetId:king.id,x:1500,y:2925,rotationDeg:0},c={assetId:king.id,x:1075,y:2000,rotationDeg:90};
  expect(acceptLayouts({layouts:[[a],[a],[{assetId:'a_x',x:0,y:0,rotationDeg:0}],[b]]},room(3000,4000),[king]).map(l=>plain(l.placed))).toEqual([[[king.id,1500,1075,180]]]);
  expect(acceptLayouts({layouts:[[a],[b],[c]]},room(3000,4000),[king])).toHaveLength(3);
  expect(acceptLayouts([b],room(3000,4000),[king]).map(l=>plain(l.placed))).toEqual([[[king.id,1500,2925,0]]]);
  expect(acceptLayouts({layouts:'x'},room(3000,4000),[king])).toEqual([]);
 });
 it('adjustPlacement turns or moves one piece only to a safe spot and never changes the list on a refusal',()=>{
  const r=room(3000,4000),placed:LayoutPlacement[]=[{asset:king,x:1500,y:1075,rotationDeg:180},{asset:nightstand,x:325,y:200,rotationDeg:180}];
  const right=adjustPlacement(r,placed,0,{dx:100});
  expect(right.ok&&plain(right.placed)).toEqual([[king.id,1600,1075,180],[nightstand.id,325,200,180]]);
  expect(adjustPlacement(r,placed,0,{dy:-100})).toEqual({ok:false,problem:'outside'}); // the headboard would leave the room
  expect(adjustPlacement(r,placed,1,{dx:300})).toEqual({ok:false,problem:'overlap'}); // x 400-850 meets the bed at 550
  // Turned about its centre, the bed is 2150 across x (425..2575) and 1900 along y (125..2025), facing west. It then
  // meets the bedside table (x 100..550, y 0..400); alone, its walkway x -175..425 leaves the room.
  expect(adjustPlacement(r,placed,0,{turn:true})).toEqual({ok:false,problem:'overlap'});
  expect(adjustPlacement(r,[placed[0]!],0,{turn:true})).toEqual({ok:false,problem:'walkway'});
  const turned=adjustPlacement(r,[{asset:nightstand,x:1500,y:2000,rotationDeg:0}],0,{turn:true});
  expect(turned.ok&&plain(turned.placed)).toEqual([[nightstand.id,1500,2000,90]]);
  expect(placed.map(p=>p.x)).toEqual([1500,325]);
 });
 it('drops unknown, repeated, malformed and refused answers; keeps the order of the rest',()=>{
  const out=acceptLayout([
   {assetId:'a_unknown',x:100,y:100,rotationDeg:0},
   {assetId:king.id,x:1500,y:1075,rotationDeg:180},
   {assetId:king.id,x:1500,y:2925,rotationDeg:0},
   {assetId:nightstand.id,x:325.5,y:200,rotationDeg:180},
   {assetId:nightstand.id,x:325,y:200,rotationDeg:45},
   {assetId:nightstand.id,x:'325',y:200,rotationDeg:180},
   {assetId:nightstand.id,x:1500,y:1000,rotationDeg:180},
   {assetId:nightstand.id,x:2675,y:200,rotationDeg:180},
   {assetId:nightstand.id,x:225,y:200,rotationDeg:180}, // a free spot, but the item is already placed
   null,
  ],room(3000,4000),[king,nightstand,wardrobe]);
  expect(plain(out.placed)).toEqual([[king.id,1500,1075,180],[nightstand.id,2675,200,180]]);
  expect(out.skipped.map(a=>a.id)).toEqual([wardrobe.id]);
  expect(acceptLayout({assetId:king.id},room(3000,4000),[king]).placed).toEqual([]);
  // Only quarter turns: 360 and '0' would otherwise land on free floor.
  expect(acceptLayout([{assetId:nightstand.id,x:1500,y:2000,rotationDeg:360},{assetId:nightstand.id,x:1500,y:2000,rotationDeg:'0'}],room(3000,4000),[nightstand]).placed).toEqual([]);
  expect(plain(acceptLayout([{assetId:nightstand.id,x:1500,y:2000,rotationDeg:270}],room(3000,4000),[nightstand]).placed)).toEqual([[nightstand.id,1500,2000,270]]);
 });
});

describe('D73 offline layout stand-in',()=>{
 it('3000×4000 bedroom: bed centred on the north wall, bedside table touching its west side, wardrobe in the south-west corner',()=>{
  expect(plain(planLayout(room(3000,4000),[king,nightstand,wardrobe]))).toEqual([[king.id,1500,1075,180],[nightstand.id,325,200,180],[wardrobe.id,900,3675,0]]);
 });
 it('4000×5000 living room with a door on the west wall: sofa north, TV unit facing it, coffee table 400 mm out, rug under the table',()=>{
  const living=room(4000,5000,{roomType:'living',doors:[[0,3600,900,4500]]});
  expect(plain(planLayout(living,[sofa,tv,coffee,rug]))).toEqual([[sofa.id,2000,430,180],[tv.id,2000,4800,0],[coffee.id,2000,1560,180],[rug.id,2000,1550,0]]);
 });
 it('dining set goes in the middle with its long side along the long side of the room',()=>{
  const set=asset('a_l0_dining_set_6',2540,1640,860,'tables');
  expect(plain(planLayout(room(4000,3500,{roomType:'dining'}),[set]))).toEqual([[set.id,2000,1750,0]]);
  expect(plain(planLayout(room(3500,4000,{roomType:'dining'}),[set]))).toEqual([[set.id,1750,2000,90]]);
 });
 it('leaves out what cannot fit safely instead of squeezing it in',()=>{
  // 2000×4000: the king bed (x 50–1950) leaves no spot for a bedside table within 150 mm outside its walkway.
  expect(plain(planLayout(room(2000,4000),[king,nightstand]))).toEqual([[king.id,1000,1075,180]]);
  // 2400×2000: the 2150 mm deep king bed plus a 600 mm walkway fits neither way round.
  expect(plain(planLayout(room(2400,2000),[king,nightstand]))).toEqual([[nightstand.id,225,200,180]]);
 });
 it('property: whatever the room, every stand-in layout passes acceptLayouts unchanged, smaller options included',async()=>{
  const queen=asset('a_l0_queen_bed',1620,2150,1100,'beds'),single=asset('a_l0_single_bed',1000,2150,950,'beds'),sofa2=asset('a_l0_sofa_2',1500,860,820,'seating');
  const options=new Map([[king.id,[king,queen,single]],[sofa.id,[sofa,sofa2]]]);
  const pool=[king,nightstand,wardrobe,sofa,tv,coffee,rug,asset('a_l0_dining_set_4',1200,1540,860,'tables'),asset('a_l0_bookcase',800,300,1800,'storage')];
  await fc.assert(fc.asyncProperty(fc.integer({min:1500,max:6000}),fc.integer({min:1500,max:6000}),fc.subarray(pool,{minLength:1}),fc.integer({min:0,max:2}),async(w,d,items,doors)=>{
   const r=room(w,d,{doors:([[0,0,900,900],[w-900,d-900,w,d]] as Rect[]).slice(0,doors)});
   const raw=await standInAi.suggestLayout(r,items,new AbortController().signal,options) as {layouts:unknown[][]},out=acceptLayouts(raw,r,items,options);
   expect(raw.layouts.length).toBeLessThanOrEqual(3);
   expect(out.map(l=>l.placed.length)).toEqual(raw.layouts.map(l=>l.length));
  }),{seed:20261018,numRuns:40});
 });
 it('a smaller option stands in when the idea itself has no safe spot',()=>{
  // 1800 x 3000: the king bed (1900 wide) fits on no wall; turned, 2150 + 600 > 1800. The queen (1620) fits on the
  // north wall, centred: x 900, y 2150/2 = 1075.
  const queen=asset('a_l0_queen_bed',1620,2150,1100,'beds'),double=asset('a_l0_double_bed',1460,2150,1050,'beds');
  const out=planLayout(room(1800,3000),[king],{options:new Map([[king.id,[king,queen,double]]])});
  expect(out.map(p=>[p.asset.id,p.ideaId,p.x,p.y,p.rotationDeg])).toEqual([[queen.id,king.id,900,1075,180]]);
  expect(planLayout(room(1800,3000),[king])).toEqual([]); // without options nothing fits
 });
 it('up to three layouts: the bed on the first wall, then a wall across, then the opposite wall',()=>{
  // 3000 x 4000. Second: the west wall, x 2150/2 = 1075, centred on y 2000. Third: the south wall, y 4000 - 1075 = 2925.
  expect(planLayouts(room(3000,4000),[king]).map(plain)).toEqual([[[king.id,1500,1075,180]],[[king.id,1075,2000,90]],[[king.id,1500,2925,0]]]);
  // No bed or sofa: one layout.
  expect(planLayouts(room(4000,3500,{roomType:'dining'}),[asset('a_l0_dining_set_6',2540,1640,860,'tables')])).toHaveLength(1);
 });

});

describe('D73 layoutRoom reads the saved drawing',()=>{
 const store=new ProjectStore(structuredClone(sample) as ProjectDoc,'layout_room'),snap=store.getSnapshot();
 const facts=(roomId:string)=>{const face=snap.derived.faces.find(f=>f.roomId===roomId)!;return layoutRoom(snap.document,face,'bedroom','f0');};
 it('sample bedroom: the 900 mm door swing from the partition, the east window, and both existing pieces',()=>{
  const bed=facts('r_bed');
  expect(bed.bounds).toEqual([4557.5,115,7885,4885]);
  expect(bed.doors).toEqual([[4557.5,550,5457.5,1450]]);
  expect(bed.windows).toEqual([{zone:[7785,1900,7885,3100],sill:900}]);
  expect(bed.obstacles).toHaveLength(2);
  bed.obstacles[0]!.rect.forEach((v,i)=>expect(v).toBeCloseTo([5550,200,7350,2200][i]!,6));
  bed.obstacles[1]!.rect.forEach((v,i)=>expect(v).toBeCloseTo([5350,4200,7150,4800][i]!,6));
 });
 it('sample living room: the main door and the bedroom door both keep a swing clear, and the north window',()=>{
  const living=facts('r_living');
  expect(living.doors).toEqual([[2500,3885,3500,4885],[3542.5,550,4442.5,1450]]);
  expect(living.windows).toEqual([{zone:[1500,115,3000,215],sill:900}]);
 });
});
