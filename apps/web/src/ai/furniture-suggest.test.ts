import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import type {CatalogAsset} from '../catalog/catalog';
import {acceptSuggestions,fitsRoom,MAX_SUGGESTIONS,roomBrief} from './furniture-suggest';
import type {RoomBrief} from './furniture-suggest';
import {standInAi} from './stand-in';

// D73 Claude-authored checks. Every expected list and number below is worked out by hand from the rules
// (600 mm walkway, 50% floor budget, 6 items), not read back from the code.
const asset=(id:string,w:number,d:number):CatalogAsset=>({id,version:1,name_en:id,name_hi:id,category:'test',tags:[],dims:{w,d,h:500},lods:[],thumb:{path:'',sha256:'',bytes:0,width:256,height:256}});
const brief=(widthMm:number,depthMm:number,roomType:RoomBrief['roomType']='living',existingAssetIds:string[]=[]):RoomBrief=>({roomType,widthMm,depthMm,existingAssetIds});
const ids=(list:readonly {asset:CatalogAsset}[])=>list.map(s=>s.asset.id);

describe('D73 fitsRoom',()=>{
 it('needs the width along one wall and the depth plus a 600 mm walkway across the room, either way round',()=>{
  expect(fitsRoom({w:2000,d:900},3000,2000)).toBe(true); // 2000≤3000, 900+600=1500≤2000
  expect(fitsRoom({w:2000,d:900},1900,3000)).toBe(true); // turned: 2000≤3000, 1500≤1900
  expect(fitsRoom({w:2000,d:900},1900,1400)).toBe(false); // 2000>1900 and 2000>1400
  expect(fitsRoom({w:1000,d:400},1000,1000)).toBe(true); // exactly 1000 and 400+600=1000
  expect(fitsRoom({w:1000,d:400},1000,999)).toBe(false); // 1000>999 one way, 1000>999 the other
 });
 it('property: an item that fits also fits in any larger room, and never fits when wider and deeper than the room',()=>{
  fc.assert(fc.property(fc.integer({min:1,max:5000}),fc.integer({min:1,max:5000}),fc.integer({min:1,max:8000}),fc.integer({min:1,max:8000}),fc.integer({min:0,max:2000}),fc.integer({min:0,max:2000}),(w,d,W,D,gw,gd)=>{
   if(fitsRoom({w,d},W,D))expect(fitsRoom({w,d},W+gw,D+gd)).toBe(true);
   if(Math.min(w,d+600)>Math.max(W,D))expect(fitsRoom({w,d},W,D)).toBe(false);
  }));
 });
});

describe('D73 acceptSuggestions (the trust boundary for any provider)',()=>{
 const A=asset('a_a',2000,900),B=asset('a_b',1200,600),C=asset('a_c',800,800),D=asset('a_d',600,400),Big=asset('a_big',3100,500);
 it('keeps order and drops items past the 50% floor budget: 3000×2000 room, budget 3,000,000 mm²',()=>{
  // A 1,800,000 → 1,200,000 left; B 720,000 → 480,000; C 640,000 > 480,000 dropped; D 240,000 → 240,000.
  const out=acceptSuggestions([{assetId:'a_a'},{assetId:'a_b'},{assetId:'a_c'},{assetId:'a_d'}],brief(3000,2000),[A,B,C,D]);
  expect(ids(out)).toEqual(['a_a','a_b','a_d']);
 });
 it('drops unknown IDs, repeats, items already in the room, items that do not fit and malformed entries',()=>{
  const out=acceptSuggestions([null,7,'a_b',{assetId:'a_x'},{assetId:3},{assetId:'a_big'},{assetId:'a_b'},{assetId:'a_b'},{assetId:'a_d'}],brief(3000,2000,'living',['a_d']),[A,B,C,D,Big]);
  expect(ids(out)).toEqual(['a_b']); // a_big: 3100 wider than 3000 and 3100 deeper-way than 2000
 });
 it('returns nothing for an answer that is not a list',()=>{
  for(const raw of [undefined,null,'a_a',{assetId:'a_a'},42])expect(acceptSuggestions(raw,brief(3000,2000),[A])).toEqual([]);
 });
 it('caps the answer at 6 and only reads the first 50 entries',()=>{
  const many=Array.from({length:10},(_,i)=>asset(`a_s${i}`,100,100));
  expect(MAX_SUGGESTIONS).toBe(6);
  expect(ids(acceptSuggestions(many.map(a=>({assetId:a.id})),brief(4000,4000),many))).toEqual(['a_s0','a_s1','a_s2','a_s3','a_s4','a_s5']);
  const late=[...Array.from({length:50},()=>({assetId:'a_x'})),{assetId:'a_s0'}];
  expect(acceptSuggestions(late,brief(4000,4000),many)).toEqual([]);
 });
 it('keeps a reason only when it is a known kind or a short text in both languages',()=>{
  const out=acceptSuggestions([{assetId:'a_s0',reason:{kind:'largest'}},{assetId:'a_s1',reason:{kind:'text',en:'Good light',hi:'अच्छी रोशनी'}},{assetId:'a_s2',reason:{kind:'text',en:'Only English'}},{assetId:'a_s3',reason:'<b>html</b>'},{assetId:'a_s4',reason:{kind:'text',en:'x'.repeat(301),hi:'y'}}],brief(4000,4000),Array.from({length:5},(_,i)=>asset(`a_s${i}`,100,100)));
  expect(out.map(s=>s.reason)).toEqual([{kind:'largest'},{kind:'text',en:'Good light',hi:'अच्छी रोशनी'},{kind:'fits'},{kind:'fits'},{kind:'fits'}]);
 });
 it('property: accepted items are known, unique, new, fit with a walkway and together cover at most half the floor',()=>{
  const pool=Array.from({length:12},(_,i)=>asset(`a_p${i}`,300+i*250,200+(i%5)*300));
  fc.assert(fc.property(fc.array(fc.oneof(fc.constantFrom(...pool.map(a=>a.id)),fc.constant('a_unknown')),{maxLength:30}),fc.integer({min:1000,max:7000}),fc.integer({min:1000,max:7000}),fc.subarray(pool.map(a=>a.id)),(answer,W,D,existing)=>{
   const out=acceptSuggestions(answer.map(assetId=>({assetId})),brief(W,D,'living',existing),pool),seen=new Set<string>();
   expect(out.length).toBeLessThanOrEqual(6);
   let area=0;
   for(const s of out){expect(pool).toContain(s.asset);expect(seen.has(s.asset.id)).toBe(false);expect(existing).not.toContain(s.asset.id);expect(fitsRoom(s.asset.dims,W,D)).toBe(true);seen.add(s.asset.id);area+=s.asset.dims.w*s.asset.dims.d;}
   expect(area).toBeLessThanOrEqual(W*D/2);
  }));
 });
});

describe('D73 roomBrief',()=>{
 it('uses the clear rectangle rounded down to whole millimetres',()=>{
  // Sample living room clear 4327.5×4770 → 4327×4770.
  expect(roomBrief('living',[115.5,100,4443,4870],['a_l0_rug'])).toEqual({roomType:'living',widthMm:4327,depthMm:4770,existingAssetIds:['a_l0_rug']});
 });
});

describe('D73 offline stand-in',()=>{
 // Sizes copied by hand from the published catalog's newest versions.
 const catalog=[asset('a_l0_sofa_l',2500,1600),asset('a_l0_sofa_3',2100,860),asset('a_l0_sofa_2',1500,860),asset('a_l0_tv_unit',1800,400),asset('a_l0_coffee_table',1100,600),asset('a_l0_armchair',800,820),asset('a_l0_side_table',450,450),asset('a_l0_rug',1600,1000),asset('a_l0_planter',450,420),
  asset('a_l0_king_bed',1900,2150),asset('a_l0_queen_bed',1620,2150),asset('a_l0_double_bed',1460,2150),asset('a_l0_single_bed',1000,2150),asset('a_l0_wardrobe_sliding',1800,650),asset('a_l0_wardrobe_3',1500,600),asset('a_l0_wardrobe_2',1000,600),asset('a_l0_nightstand',450,400),asset('a_l0_dressing_table',1000,450),asset('a_l0_study_desk',1200,600)];
 const ask=async(b:RoomBrief)=>acceptSuggestions(await standInAi.suggestFurniture(b,catalog,new AbortController().signal),b,catalog);
 it('sample living room 4327×4770 (budget 10,319,895 mm²): L-sofa first, then six items, the planter cut by the cap',async()=>{
  // L-sofa 4,000,000; TV unit 720,000; coffee table 660,000; armchair 656,000; side table 202,500; rug 1,600,000 = 7,838,500.
  const out=await ask(brief(4327,4770,'living'));
  expect(ids(out)).toEqual(['a_l0_sofa_l','a_l0_tv_unit','a_l0_coffee_table','a_l0_armchair','a_l0_side_table','a_l0_rug']);
  expect(out[0]!.reason).toEqual({kind:'largest'});expect(out[1]!.reason).toEqual({kind:'fits'});
 });
 it('sample bedroom 3327×4770 (budget 7,934,895 mm²): king bed, sliding wardrobe, bedside, dressing and study tables',async()=>{
  const out=await ask(brief(3327,4770,'bedroom'));
  expect(ids(out)).toEqual(['a_l0_king_bed','a_l0_wardrobe_sliding','a_l0_nightstand','a_l0_dressing_table','a_l0_study_desk']);
  expect(out.map(s=>s.reason.kind)).toEqual(['largest','largest','fits','fits','fits']);
 });
 it('small bedroom 2400×3000 (budget 3,600,000 mm²): the king bed (4,085,000) is too big, the queen bed (3,483,000) leaves 117,000, nothing else fits',async()=>{
  expect(ids(await ask(brief(2400,3000,'bedroom')))).toEqual(['a_l0_queen_bed']);
 });
 it('skips what the room already has and proposes nothing for a room type without a plan',async()=>{
  expect(ids(await ask(brief(3327,4770,'bedroom',['a_l0_king_bed','a_l0_nightstand'])))).toEqual(['a_l0_queen_bed','a_l0_wardrobe_sliding','a_l0_dressing_table','a_l0_study_desk']);
  expect(await ask(brief(3000,3000,'pooja'))).toEqual([]);
 });
 it('kitchen, bathroom and utility rooms get catalog furniture only: no appliances or sanitaryware',async()=>{
  const more=[...catalog,asset('a_l0_island',1200,800),asset('a_l0_kitchen_base',600,600),asset('a_l0_vanity',600,450),asset('a_l0_shoe_rack',800,350),asset('a_l0_low_cabinet',1500,420)];
  const askMore=async(b:RoomBrief)=>ids(acceptSuggestions(await standInAi.suggestFurniture(b,more,new AbortController().signal),b,more));
  // Kitchen 2800 x 2200, budget 3,080,000: island 960,000 (1200 <= 2800, 800+600 <= 2200), base cabinet 360,000.
  expect(await askMore(brief(2800,2200,'kitchen'))).toEqual(['a_l0_island','a_l0_kitchen_base']);
  // Kitchen 2000 x 1300, budget 1,300,000: the island only fits turned (1200 <= 1300, 800+600 <= 2000) and uses 960,000;
  // the base cabinet's 360,000 is more than the 340,000 left.
  expect(await askMore(brief(2000,1300,'kitchen'))).toEqual(['a_l0_island']);
  // Kitchen 1300 x 1300: the island fits neither way (1400 > 1300); the base cabinet does (600, 1200 <= 1300).
  expect(await askMore(brief(1300,1300,'kitchen'))).toEqual(['a_l0_kitchen_base']);
  // Bathroom 1600 x 2000, budget 1,600,000: vanity 270,000.
  expect(await askMore(brief(1600,2000,'bathroom'))).toEqual(['a_l0_vanity']);
  // Utility 1800 x 1500, budget 1,350,000: shoe cabinet 280,000, then the 1500 x 420 sideboard 630,000 (1500 <= 1800, 1020 <= 1500).
  expect(await askMore(brief(1800,1500,'utility'))).toEqual(['a_l0_shoe_rack','a_l0_low_cabinet']);
 });
 it('rejects a request that was already cancelled',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(standInAi.suggestFurniture(brief(3000,3000),catalog,controller.signal)).rejects.toMatchObject({name:'AbortError'});
 });
});
