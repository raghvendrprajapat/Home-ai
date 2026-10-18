import type {RoomType} from '@gharplan/core-model';
import type {CatalogAsset} from '../catalog/catalog';
import {FLOOR_SHARE,fitsRoom} from './furniture-suggest';
import type {AiProvider,RoomBrief} from './furniture-suggest';
import {footprint,placementProblem} from './layout';
import {readSketch} from './sketch';
import type {SketchPixels} from './sketch';
import type {LayoutPlacement,LayoutRoom,Rect,Turn} from './layout';

/**
 * D73 offline stand-in for the furniture-ideas model, written by Claude Code so the feature can be built and tested
 * without a paid API or sending anything off the device. Each room type lists slots; a slot names alternatives from
 * the biggest to the smallest; the first one that fits with a walkway and within the remaining floor-area budget is
 * proposed. Its answer goes through acceptSuggestions exactly like a real model's would.
 */
export const ROOM_PLANS:Readonly<Partial<Record<RoomType,readonly (readonly string[])[]>>>={
 bedroom:[['a_l0_king_bed','a_l0_queen_bed','a_l0_double_bed','a_l0_single_bed'],['a_l0_wardrobe_sliding','a_l0_wardrobe_3','a_l0_wardrobe_2'],['a_l0_nightstand'],['a_l0_dressing_table'],['a_l0_study_desk']],
 living:[['a_l0_sofa_l','a_l0_sofa_3','a_l0_sofa_2'],['a_l0_tv_unit'],['a_l0_coffee_table'],['a_l0_armchair'],['a_l0_side_table'],['a_l0_rug'],['a_l0_planter']],
 hall:[['a_l0_sofa_3','a_l0_sofa_2'],['a_l0_tv_unit'],['a_l0_coffee_table'],['a_l0_console_table'],['a_l0_planter']],
 dining:[['a_l0_dining_set_6','a_l0_dining_set_4'],['a_l0_low_cabinet'],['a_l0_planter']],
 study:[['a_l0_study_desk'],['a_l0_bookcase'],['a_l0_armchair']],
 balcony:[['a_l0_planter'],['a_l0_stool']],
 kitchen:[['a_l0_island'],['a_l0_kitchen_base']],
 bathroom:[['a_l0_vanity']],
 utility:[['a_l0_shoe_rack'],['a_l0_low_cabinet']],
};

export const standInAi:AiProvider={
 kind:'stand-in',
 async suggestFurniture(brief:RoomBrief,candidates:readonly CatalogAsset[],signal:AbortSignal):Promise<unknown>{
  if(signal.aborted)throw new DOMException('aborted','AbortError');
  const known=new Map(candidates.map(a=>[a.id,a])),answer:{assetId:string;reason:{kind:'largest'|'fits'}}[]=[];
  let budget=brief.widthMm*brief.depthMm*FLOOR_SHARE;
  for(const slot of ROOM_PLANS[brief.roomType]??[]){
   const pick=slot.find(id=>{const a=known.get(id);return a&&!brief.existingAssetIds.includes(id)&&fitsRoom(a.dims,brief.widthMm,brief.depthMm)&&a.dims.w*a.dims.d<=budget;});
   if(!pick)continue;
   budget-=known.get(pick)!.dims.w*known.get(pick)!.dims.d;
   answer.push({assetId:pick,reason:{kind:slot.length>1&&pick!==slot.at(-1)?'largest':'fits'}});
  }
  return answer;
 },
 async suggestLayout(room:LayoutRoom,assets:readonly CatalogAsset[],signal:AbortSignal):Promise<unknown>{
  if(signal.aborted)throw new DOMException('aborted','AbortError');
  return planLayout(room,assets).map(p=>({assetId:p.asset.id,x:p.x,y:p.y,rotationDeg:p.rotationDeg}));
 },
 async planFromImage(image:SketchPixels,realWidthMm:number,signal:AbortSignal):Promise<unknown>{
  if(signal.aborted)throw new DOMException('aborted','AbortError');
  return readSketch(image,realWidthMm);
 },
};

type Role='anchor'|'beside'|'facing'|'front'|'centre'|'corner'|'rug';
/** How the stand-in arranges each catalog item. Anything not listed goes against a wall, near a corner. */
function roleOf(a:CatalogAsset):Role{
 if(a.category==='rugs')return 'rug';
 if(a.category==='beds'||/sofa/.test(a.id))return 'anchor';
 if(/nightstand|side_table/.test(a.id))return 'beside';
 if(/tv_unit/.test(a.id))return 'facing';
 if(/coffee_table/.test(a.id))return 'front';
 if(/dining_set|dining_4|dining_6|island/.test(a.id))return 'centre';
 return 'corner';
}
/** Furthest a bedside or side table may stand from its bed or sofa. */
export const BESIDE_MM=150;
const centreOf=(r:Rect):[number,number]=>[(r[0]+r[2])/2,(r[1]+r[3])/2];
/** Gap between two boxes (0 when they touch or overlap). */
const gap=(a:Rect,b:Rect)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));
const box=(p:LayoutPlacement)=>footprint(p.asset.dims,p.x,p.y,p.rotationDeg);

/** Every position with the item's back flush against one side of the room's bounding box, facing into the room. */
function wallSpots(room:LayoutRoom,a:CatalogAsset):{x:number;y:number;turn:Turn;along:number;length:number}[]{
 const [x0,y0,x1,y1]=room.bounds,out:{x:number;y:number;turn:Turn;along:number;length:number}[]=[];
 const line=(from:number,to:number,half:number,make:(c:number)=>{x:number;y:number;turn:Turn})=>{
  if(to-from<2*half)return;
  const first=Math.ceil(from+half),last=Math.floor(to-half),mid=Math.round((from+to)/2);
  for(const c of new Set([first,last,mid,...Array.from({length:Math.floor((last-first)/50)+1},(_,i)=>first+i*50)]))if(c>=first&&c<=last)out.push({...make(c),along:c-(from+to)/2,length:to-from});
 };
 // North wall: front faces south (180°); south wall: 0°; west wall: 90°; east wall: 270°.
 line(x0,x1,a.dims.w/2,c=>({x:c,y:Math.ceil(y0+a.dims.d/2),turn:180}));
 line(x0,x1,a.dims.w/2,c=>({x:c,y:Math.floor(y1-a.dims.d/2),turn:0}));
 line(y0,y1,a.dims.w/2,c=>({x:Math.ceil(x0+a.dims.d/2),y:c,turn:90}));
 line(y0,y1,a.dims.w/2,c=>({x:Math.floor(x1-a.dims.d/2),y:c,turn:270}));
 return out;
}
/** Free-standing positions on a 50 mm grid, both ways round. */
function gridSpots(room:LayoutRoom):{x:number;y:number;turn:Turn}[]{
 const [x0,y0,x1,y1]=room.bounds,out:{x:number;y:number;turn:Turn}[]=[];
 for(const turn of [0,90] as const)for(let x=Math.ceil(x0/50)*50;x<=x1;x+=50)for(let y=Math.ceil(y0/50)*50;y<=y1;y+=50)out.push({x,y,turn});
 return out;
}

/**
 * The stand-in's greedy arrangement: beds and sofas centred on a wall, bedside and side tables within 150 mm of them, a TV unit
 * facing the sofa, a coffee table 400 mm in front of the sofa, dining sets in the middle, everything else near a
 * corner, then rugs under the seating group. Each spot is checked with the same placementProblem rule that
 * acceptLayout applies, so the stand-in never proposes something the boundary would refuse.
 */
export function planLayout(room:LayoutRoom,assets:readonly CatalogAsset[]):LayoutPlacement[]{
 const placed:LayoutPlacement[]=[];
 const best=<S extends {x:number;y:number;turn:Turn}>(a:CatalogAsset,spots:readonly S[],score:(p:LayoutPlacement,spot:S)=>number)=>{
  let pick:LayoutPlacement|undefined,top=-Infinity;
  for(const spot of spots){const p:LayoutPlacement={asset:a,x:spot.x,y:spot.y,rotationDeg:spot.turn};if(placementProblem(room,placed,p))continue;const s=score(p,spot);if(s>top){top=s;pick=p;}}
  if(pick)placed.push(pick);
 };
 const ordered=[...assets.filter(a=>roleOf(a)!=='rug'),...assets.filter(a=>roleOf(a)==='rug')];
 const roomCentre=centreOf(room.bounds);
 for(const a of ordered){
  const role=roleOf(a),anchor=placed.find(p=>roleOf(p.asset)==='anchor'),seat=placed.find(p=>/sofa/.test(p.asset.id))??anchor;
  if(role==='anchor')best(a,wallSpots(room,a),(_,s)=>-Math.abs(s.along));
  // A bedside or side table is only useful right next to its bed or sofa: no spot within BESIDE_MM means no table.
  else if(role==='beside')best(a,wallSpots(room,a),p=>{if(!anchor)return 0;const g=gap(box(p),box(anchor));return g>BESIDE_MM?-Infinity:-g*10-(p.rotationDeg===anchor.rotationDeg?0:1000);});
  else if(role==='facing')best(a,wallSpots(room,a),p=>{
   if(!seat)return 0;const [sx,sy]=[seat.x,seat.y];
   return (p.rotationDeg===(seat.rotationDeg+180)%360?0:-100000)-(seat.rotationDeg%180===0?Math.abs(p.x-sx):Math.abs(p.y-sy));
  });
  else if(role==='front'&&seat){
   const s=box(seat),turn=seat.rotationDeg,spots:{x:number;y:number;turn:Turn}[]=[];
   for(let g=350;g<=700;g+=50){
    const half=a.dims.d/2; // same turn as the seat, so the table's depth runs the same way
    spots.push(turn===0?{x:seat.x,y:Math.round(s[1]-g-half),turn}:turn===180?{x:seat.x,y:Math.round(s[3]+g+half),turn}:turn===90?{x:Math.round(s[2]+g+half),y:seat.y,turn}:{x:Math.round(s[0]-g-half),y:seat.y,turn});
   }
   best(a,spots,p=>-Math.abs(gap(box(p),s)-400));
  }
  else if(role==='centre'||role==='front'){
   // Near the middle, long side along the room's long side.
   const wideRoom=room.bounds[2]-room.bounds[0]>=room.bounds[3]-room.bounds[1];
   best(a,gridSpots(room),p=>{const box0=footprint(a.dims,0,0,p.rotationDeg),wideItem=box0[2]-box0[0]>=box0[3]-box0[1];return -Math.hypot(p.x-roomCentre[0],p.y-roomCentre[1])+(wideItem===wideRoom?1:0);});
  }
  else if(role==='rug'){
   const under=placed.find(p=>/coffee_table/.test(p.asset.id))??seat,[tx,ty]=under?centreOf(box(under)):roomCentre;
   best(a,gridSpots(room),p=>-Math.hypot(p.x-tx,p.y-ty)+(under&&p.rotationDeg%180===under.rotationDeg%180?1:0));
  }
  // Against a wall as close to a corner as possible: the item's width runs along the wall.
  else best(a,wallSpots(room,a),(_,s)=>-(s.length/2-a.dims.w/2-Math.abs(s.along)));
 }
 return placed;
}
