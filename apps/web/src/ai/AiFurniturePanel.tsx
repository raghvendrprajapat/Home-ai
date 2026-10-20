import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {ProjectStore,RoomType} from '@gharplan/core-model';
import {assetName,latestAssets} from '../catalog/catalog';
import type {Catalog,CatalogAsset} from '../catalog/catalog';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import type {Point2} from '../editor/view2d';
import {acceptSuggestions,largestRect,roomBrief,SIZE_PREFERENCES,swapSuggestion,WALKWAY_MM} from './furniture-suggest';
import type {AiProvider,FurnitureSuggestion,RoomBrief,SizePreference} from './furniture-suggest';
import {acceptLayouts,adjustPlacement,footprint,layoutRoom,NUDGE_MM} from './layout';
import type {LayoutResult,LayoutRoom,PlacementProblem} from './layout';

export type Layout=Readonly<{generation:number;floorId:string;room:LayoutRoom;results:readonly LayoutResult[];chosen:number;piece:number;problem?:PlacementProblem|undefined}>;
type State=Readonly<{phase:'idle'}|{phase:'loading'}|{phase:'failed'}|{phase:'ready';roomId:string;brief:RoomBrief;items:readonly FurnitureSuggestion[];layout?:Layout|'loading'|'failed'|undefined;note?:'added'|'stale'|'rejected'|undefined;added?:number}>;

/**
 * D73 "AI furniture ideas" for one room. The provider proposes, acceptSuggestions filters, and Place opens the normal
 * placement form centred in the room. AI-2 "Arrange" asks the provider where the ideas should stand, keeps only what
 * acceptLayout allows, shows a small plan preview, and adds the layout as one AddFurnitureBatch command (one Undo).
 */
export function AiFurniturePanel({store,locale,selectedRoomId,provider,catalog,onPlace}:{store:ProjectStore;locale:Locale;selectedRoomId:string|undefined;provider:AiProvider;catalog:(signal:AbortSignal)=>Promise<Catalog>;onPlace(asset:CatalogAsset,centre:Point2):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),rooms=snapshot.document.rooms.filter(r=>snapshot.derived.faces.some(f=>f.roomId===r.id));
 const [chosen,setChosen]=useState(''),[state,setState]=useState<State>({phase:'idle'}),[size,setSize]=useState<SizePreference>('balanced');
 const roomId=rooms.some(r=>r.id===chosen)?chosen:selectedRoomId&&rooms.some(r=>r.id===selectedRoomId)?selectedRoomId:rooms[0]?.id??'';
 useEffect(()=>{if(selectedRoomId)setChosen(selectedRoomId);},[selectedRoomId]);
 // Every new request, room or size makes older answers stale; they are dropped when they arrive.
 const request=useRef(0);
 useEffect(()=>{request.current++;setState({phase:'idle'});},[roomId]);
 const room=rooms.find(r=>r.id===roomId),face=snapshot.derived.faces.find(f=>f.roomId===roomId),floor=face&&largestRect(face.clearRects);
 const suggest=async()=>{
  if(!room||!face||!floor)return;
  const ticket=++request.current;
  setState({phase:'loading'});const controller=new AbortController();
  try{
   const candidates=latestAssets(await catalog(controller.signal)),existing=snapshot.document.furniture.filter(f=>face.clearRects.some(([x0,y0,x1,y1])=>f.position.x>=x0&&f.position.x<=x1&&f.position.y>=y0&&f.position.y<=y1)).map(f=>f.assetId);
   // The model validator only admits known room types.
   const brief={...roomBrief(room.type as RoomType,floor,existing),size},answer=await provider.suggestFurniture(brief,candidates,controller.signal);
   if(ticket===request.current)setState({phase:'ready',roomId:room.id,brief,items:acceptSuggestions(answer,brief,candidates)});
  }catch{if(ticket===request.current)setState({phase:'failed'});}
 };
 const arrange=async()=>{
  if(state.phase!=='ready'||!room||!face)return;
  const items=state.items.map(s=>s.asset),floorId=snapshot.document.floors[0]!.id,generation=snapshot.localGeneration;
  const facts=layoutRoom(snapshot.document,face,room.type as RoomType,floorId);
  const ideas=state.items;
  setState({...state,layout:'loading',note:undefined});
  try{
   // Each idea may be replaced by one of its smaller options when it has no safe spot.
   const options=new Map(state.items.map(s=>[s.asset.id,s.options])),found=acceptLayouts(await provider.suggestLayout(facts,items,new AbortController().signal,options),facts,items,options);
   const results=found.length?found:[{placed:[],skipped:items}];
   // Only for the same ideas: a swap or a new request while waiting makes this answer stale.
   setState(s=>s.phase==='ready'&&s.items===ideas?{...s,layout:{generation,floorId,room:facts,results,chosen:0,piece:0}}:s);
  }catch{setState(s=>s.phase==='ready'&&s.items===ideas?{...s,layout:'failed'}:s);}
 };
 const apply=()=>{
  if(state.phase!=='ready'||!state.layout||typeof state.layout==='string')return;
  const {generation,floorId,results,chosen}=state.layout,result=results[chosen]!;
  // The preview was checked against the drawing as it was; any edit since then means arranging again.
  if(store.getSnapshot().localGeneration!==generation){setState({...state,layout:undefined,note:'stale'});return;}
  const furniture=result.placed.map(p=>({id:`fu_${crypto.randomUUID().replaceAll('-','')}`,floorId,assetId:p.asset.id,assetVersion:p.asset.version,position:{x:p.x,y:p.y},elevation:0,rotationDeg:p.rotationDeg,size:{...p.asset.dims},materialOverrides:{}}));
  const outcome=store.execute({id:`ai_layout_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:generation,type:'AddFurnitureBatch',furniture});
  setState({...state,layout:undefined,note:outcome.ok?'added':'rejected',added:furniture.length});
 };
 const reason=(s:FurnitureSuggestion)=>s.reason.kind==='text'?s.reason[locale]:message(locale,s.reason.kind==='largest'?'aiReasonLargest':'aiReasonFits',{walk:WALKWAY_MM});
 const centre=():Point2=>{const [x0,y0,x1,y1]=floor!;return [Math.round((x0+x1)/2),Math.round((y0+y1)/2)];};
 const layout=state.phase==='ready'?state.layout:undefined;
 return <section className="drawing-controls ai-panel" aria-label={message(locale,'aiTitle')}>
  <h3>{message(locale,'aiTitle')}</h3>
  <p className="structure-note">{message(locale,provider.kind==='stand-in'?'aiTestMode':'aiServerMode')}</p>
  {!rooms.length?<p>{message(locale,'aiNoRooms')}</p>:<>
   <label>{message(locale,'aiRoom')}<select aria-label={message(locale,'aiRoom')} value={roomId} onChange={event=>setChosen(event.target.value)}>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <label>{message(locale,'aiSizeChoice')}<select aria-label={message(locale,'aiSizeChoice')} value={size} onChange={event=>{setSize(event.target.value as SizePreference);request.current++;setState({phase:'idle'});}}>{SIZE_PREFERENCES.map(p=><option key={p} value={p}>{message(locale,`aiSize_${p}` as const)}</option>)}</select></label>
   <p className="structure-note">{message(locale,'aiTip')}</p>
   <button className="primary-button" disabled={state.phase==='loading'} onClick={()=>{void suggest();}}>{message(locale,'aiSuggest')}</button>
  </>}
  {state.phase==='loading'&&<p role="status">{message(locale,'aiThinking')}</p>}
  {state.phase==='failed'&&<p role="alert">{message(locale,'aiFailed')}</p>}
  {state.phase==='ready'&&(state.items.length?<>
   <ul className="ai-ideas">{state.items.map((s,i)=>{const swapped=swapSuggestion(state.items,i,state.brief);return <li key={s.asset.id} data-asset-id={s.asset.id}>
    <strong>{assetName(s.asset,locale)}</strong> <span>{message(locale,'aiSize',{w:s.asset.dims.w,d:s.asset.dims.d})}</span>
    <p className="structure-note">{reason(s)}</p>
    <div className="ai-layout-actions"><button onClick={()=>onPlace(s.asset,centre())}>{message(locale,'aiPlace')}</button>
    {s.options.length>1&&<button disabled={!swapped} onClick={()=>{if(swapped)setState({...state,items:swapped,layout:undefined,note:undefined});}}>{message(locale,'aiOther')}</button>}</div>
   </li>;})}</ul>
   <button disabled={layout==='loading'} onClick={()=>{void arrange();}}>{message(locale,'aiArrange')}</button>
  </>:<p role="status">{message(locale,'aiNone')}</p>)}
  {layout==='loading'&&<p role="status">{message(locale,'aiArranging')}</p>}
  {layout==='failed'&&<p role="alert">{message(locale,'aiLayoutFailed')}</p>}
  {layout&&typeof layout==='object'&&<LayoutPreview layout={layout} locale={locale} onApply={apply} onCancel={()=>{if(state.phase==='ready')setState({...state,layout:undefined});}} onChange={next=>{if(state.phase==='ready')setState({...state,layout:next});}}/>}
  {state.phase==='ready'&&state.note&&<p role={state.note==='added'?'status':'alert'}>{state.note==='added'?message(locale,'aiLayoutAdded',{count:state.added??0}):message(locale,state.note==='stale'?'aiLayoutStale':'aiLayoutRejected')}</p>}
 </section>;
}

/** A small top view: the clear floor, door swings, windows, existing furniture and the suggested pieces with their fronts. */
export function LayoutPreview({layout,locale,onApply,onCancel,onChange,applyLabel}:{layout:Layout;locale:Locale;onApply():void;onCancel():void;onChange(next:Layout):void;applyLabel?:string}){
 const {room,results,chosen,piece,problem}=layout,result=results[chosen]!,[x0,y0,x1,y1]=room.bounds,pad=150;
 const rect=(r:readonly number[],key:string,className:string,label?:string)=><rect key={key} className={className} x={r[0]} y={r[1]} width={r[2]!-r[0]!} height={r[3]!-r[1]!}>{label&&<title>{label}</title>}</rect>;
 const adjust=(change:Readonly<{dx?:number;dy?:number;turn?:boolean}>)=>{
  const out=adjustPlacement(room,result.placed,piece,change);
  onChange(out.ok?{...layout,results:results.map((r,i)=>i===chosen?{...r,placed:out.placed}:r),problem:undefined}:{...layout,problem:out.problem});
 };
 const swaps=result.placed.filter(p=>p.ideaId&&p.ideaId!==p.asset.id);
 return <div className="ai-layout" data-testid="ai-layout">
  {results.length>1&&<div className="ai-layout-actions" role="group" aria-label={message(locale,'aiLayoutChoices')}>{results.map((_,i)=><button key={i} aria-pressed={i===chosen} onClick={()=>onChange({...layout,chosen:i,piece:0,problem:undefined})}>{message(locale,'aiLayoutChoice',{n:i+1})}</button>)}</div>}
  <svg role="img" aria-label={message(locale,'aiLayoutPreview')} viewBox={`${x0-pad} ${y0-pad} ${x1-x0+2*pad} ${y1-y0+2*pad}`} preserveAspectRatio="xMidYMid meet">
   {room.clearRects.map((r,i)=>rect(r,`f${i}`,'ai-floor'))}
   {room.doors.map((r,i)=>rect(r,`d${i}`,'ai-door'))}
   {room.windows.map((w,i)=>rect(w.zone,`w${i}`,'ai-window'))}
   {room.obstacles.map((o,i)=>rect(o.rect,`o${i}`,'ai-existing'))}
   {result.placed.map((p,i)=>{
    // The front edge is drawn thicker so the facing direction is visible; the piece being adjusted is outlined.
    const b=footprint(p.asset.dims,p.x,p.y,p.rotationDeg),f=p.rotationDeg===0?[b[0],b[1],b[2],b[1]]:p.rotationDeg===180?[b[0],b[3],b[2],b[3]]:p.rotationDeg===90?[b[2],b[1],b[2],b[3]]:[b[0],b[1],b[0],b[3]];
    return <g key={p.asset.id} data-asset-id={p.asset.id} data-x={p.x} data-y={p.y} data-rotation={p.rotationDeg} onClick={()=>onChange({...layout,piece:i,problem:undefined})}>{rect(b,'b',i===piece?'ai-piece ai-piece-active':'ai-piece',assetName(p.asset,locale))}<line className="ai-front" x1={f[0]} y1={f[1]} x2={f[2]} y2={f[3]}/></g>;
   })}
  </svg>
  <p className="structure-note">{message(locale,'aiLayoutLegend')}</p>
  {result.placed.length>0&&<div className="ai-adjust">
   <label>{message(locale,'aiAdjustPiece')}<select aria-label={message(locale,'aiAdjustPiece')} value={piece} onChange={event=>onChange({...layout,piece:Number(event.target.value),problem:undefined})}>{result.placed.map((p,i)=><option key={p.asset.id} value={i}>{assetName(p.asset,locale)}</option>)}</select></label>
   <div className="ai-layout-actions">
    <button onClick={()=>adjust({turn:true})}>{message(locale,'aiTurn')}</button>
    <button aria-label={message(locale,'aiMoveLeft',{mm:NUDGE_MM})} onClick={()=>adjust({dx:-NUDGE_MM})}>←</button>
    <button aria-label={message(locale,'aiMoveRight',{mm:NUDGE_MM})} onClick={()=>adjust({dx:NUDGE_MM})}>→</button>
    <button aria-label={message(locale,'aiMoveUp',{mm:NUDGE_MM})} onClick={()=>adjust({dy:-NUDGE_MM})}>↑</button>
    <button aria-label={message(locale,'aiMoveDown',{mm:NUDGE_MM})} onClick={()=>adjust({dy:NUDGE_MM})}>↓</button>
   </div>
   {problem&&<p role="alert">{message(locale,`aiProblem_${problem}` as const)}</p>}
  </div>}
  {swaps.length>0&&<p className="structure-note">{message(locale,'aiLayoutSmaller',{names:swaps.map(p=>assetName(p.asset,locale)).join(', ')})}</p>}
  {result.skipped.length>0&&<p className="structure-note">{message(locale,'aiLayoutSkipped',{names:result.skipped.map(a=>assetName(a,locale)).join(', ')})}</p>}
  {result.placed.length?<div className="ai-layout-actions"><button className="primary-button" onClick={onApply}>{applyLabel??message(locale,'aiLayoutApply',{count:result.placed.length})}</button><button onClick={onCancel}>{message(locale,'aiLayoutCancel')}</button></div>:<p role="status">{message(locale,'aiLayoutEmpty')}</p>}
 </div>;
}
