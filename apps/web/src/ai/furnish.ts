import type {ProjectStore,RoomType} from '@gharplan/core-model';
import type {PlanRoom} from './copilot';
import {latestAssets} from '../catalog/catalog';
import type {Catalog} from '../catalog/catalog';
import {acceptSuggestions,largestRect,roomBrief} from './furniture-suggest';
import type {AiProvider} from './furniture-suggest';
import {acceptLayouts,layoutRoom} from './layout';
import type {Layout} from './AiFurniturePanel';

type Snapshot=ReturnType<ProjectStore['getSnapshot']>;

/**
 * D76 M3 "furnish this room": the same two checked steps as the AI furniture panel (ideas through acceptSuggestions,
 * then places through acceptLayouts) in one call, at the balanced size. The answer is tied to the drawing generation
 * it was checked against; applying it later than that is refused by the caller.
 */
export async function furnishLayout(snapshot:Snapshot,room:PlanRoom,provider:AiProvider,catalog:Catalog,signal:AbortSignal):Promise<Layout>{
 const face=snapshot.derived.faces.find(f=>f.roomId===room.id),floor=face&&largestRect(face.clearRects);
 if(!face||!floor)throw new Error('furnish-room');
 const generation=snapshot.localGeneration,floorId=snapshot.document.floors[0]!.id,type=room.type as RoomType,candidates=latestAssets(catalog);
 const existing=snapshot.document.furniture.filter(f=>face.clearRects.some(([x0,y0,x1,y1])=>f.position.x>=x0&&f.position.x<=x1&&f.position.y>=y0&&f.position.y<=y1)).map(f=>f.assetId);
 const brief={...roomBrief(type,floor,existing),size:'balanced' as const},items=acceptSuggestions(await provider.suggestFurniture(brief,candidates,signal),brief,candidates);
 const facts=layoutRoom(snapshot.document,face,type,floorId),assets=items.map(s=>s.asset),options=new Map(items.map(s=>[s.asset.id,s.options]));
 const found=assets.length?acceptLayouts(await provider.suggestLayout(facts,assets,signal,options),facts,assets,options):[];
 return {generation,floorId,room:facts,results:found.length?found:[{placed:[],skipped:assets}],chosen:0,piece:0};
}
