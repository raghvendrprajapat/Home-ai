import type {RoomType} from '@gharplan/core-model';
import type {CatalogAsset} from '../catalog/catalog';
import {FLOOR_SHARE,fitsRoom} from './furniture-suggest';
import type {AiProvider,RoomBrief} from './furniture-suggest';

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
};
