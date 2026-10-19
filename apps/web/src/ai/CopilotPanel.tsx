import {useEffect,useRef,useState} from 'react';
import {createTemplateProject} from '@gharplan/core-model';
import type {ProjectDoc,ProjectStore,RoomType,SurfaceMaterialTarget} from '@gharplan/core-model';
import type {Catalog} from '../catalog/catalog';
import {message} from '../i18n/messages';
import type {Locale,MessageArgs,MessageKey} from '../i18n/messages';
import {LayoutPreview} from './AiFurniturePanel';
import type {Layout} from './AiFurniturePanel';
import {acceptIntent,allWallSides,findRoom,FLOOR_MATERIAL,floorRooms,libraryMaterial,PAINT_MATERIAL,roomWallSides,surfaceCommand} from './copilot';
import type {CopilotProvider,PlanRoom} from './copilot';
import type {Intent} from './copilot-intents';
import {furnishLayout} from './furnish';
import type {AiProvider} from './furniture-suggest';

type Line=Readonly<{id:number;from:'me'|'copilot';text:string;layout?:Layout|undefined}>;
const nextId=()=>`cp_${crypto.randomUUID().replaceAll('-','')}`;

/**
 * D76 M3 Copilot chat. The provider only names an Intent (acceptIntent checks it); every change is made here through
 * the normal core-model commands, one command per request, so Undo/Redo behave exactly as for manual edits.
 * A new plan from a template opens as a new project; the drawing that was open is not touched.
 */
export function CopilotPanel({store,locale,selectedRoomId,provider,ai,catalog,onOpenDocument}:{store:ProjectStore;locale:Locale;selectedRoomId:string|undefined;provider:CopilotProvider;ai:AiProvider;catalog:(signal:AbortSignal)=>Promise<Catalog>;onOpenDocument?:((document:ProjectDoc)=>void)|undefined}){
 const t=<K extends MessageKey>(key:K,...args:MessageArgs<K>)=>message(locale,key,...args);
 const [lines,setLines]=useState<readonly Line[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false);
 const counter=useRef(0),log=useRef<HTMLOListElement>(null),alive=useRef<AbortController|null>(null);
 useEffect(()=>()=>alive.current?.abort(),[]);
 useEffect(()=>{const el=log.current;if(el)el.scrollTop=el.scrollHeight;},[lines]);
 const say=(from:Line['from'],said:string,layout?:Layout)=>setLines(old=>[...old,{id:++counter.current,from,text:said,layout}]);
 const roomNames=()=>floorRooms(store.getSnapshot()).map(r=>r.room.name).join(', ');
 const typeName=(type:RoomType)=>t(`room_${type}` as const);
 /** The room a request is about: the one it names, else the selected one, else the only one. */
 const roomFor=(intent:Extract<Intent,{room:unknown}>):PlanRoom|string=>{
  const snapshot=store.getSnapshot(),rooms=floorRooms(snapshot);
  if(!rooms.length)return t('copilotNoRooms');
  if(intent.room){return findRoom(snapshot,intent.room,selectedRoomId)??t('copilotNoRoom',{room:typeName(intent.room.type),names:roomNames()});}
  return rooms.find(r=>r.room.id===selectedRoomId)?.room??(rooms.length===1?rooms[0]!.room:t('copilotWhichRoom',{names:roomNames()}));
 };
 const paint=(targets:readonly SurfaceMaterialTarget[],materialId:string,done:(count:number)=>string)=>{
  const snapshot=store.getSnapshot(),command=surfaceCommand(snapshot,targets,libraryMaterial(snapshot.document,materialId),`copilot_${crypto.randomUUID().replaceAll('-','')}`);
  if(!command)return t('copilotAlready');
  return store.execute(command).ok?done(targets.length):t('copilotRejected');
 };
 const act=async(intent:Intent,signal:AbortSignal):Promise<void>=>{
  switch(intent.kind){
   case 'help':say('copilot',t('copilotHelp'));return;
   case 'template':{
    if(!onOpenDocument){say('copilot',t('copilotTemplateUnavailable'));return;}
    const plan=intent.template.toUpperCase(),document=createTemplateProject({template:intent.template,name:t('copilotTemplateName',{plan}),units:store.getSnapshot().document.units,now:new Date().toISOString(),nextId,floorName:t('groundFloor'),materialName:t('baseFinish'),roomName:typeName});
    say('copilot',t('copilotTemplateOpened',{plan,count:document.rooms.length}));onOpenDocument(document);return;
   }
   case 'paintWalls':{
    if(!intent.colour){say('copilot',t('copilotWhichColour'));return;}
    const colour=t(`colour_${intent.colour}` as const);
    if(!intent.room){say('copilot',paint(allWallSides(store.getSnapshot().document),PAINT_MATERIAL[intent.colour],count=>t('copilotPainted',{count,colour})));return;}
    const room=roomFor(intent);if(typeof room==='string'){say('copilot',room);return;}
    say('copilot',paint(roomWallSides(store.getSnapshot(),room.id),PAINT_MATERIAL[intent.colour],count=>t('copilotPainted',{count,colour})));return;
   }
   case 'floor':{
    if(!intent.finish){say('copilot',t('copilotWhichFinish'));return;}
    const finish=t(`finish_${intent.finish}` as const),snapshot=store.getSnapshot();
    const rooms=intent.room?[roomFor(intent)]:floorRooms(snapshot).map(r=>r.room);
    if(!rooms.length){say('copilot',t('copilotNoRooms'));return;}
    if(typeof rooms[0]==='string'){say('copilot',rooms[0]);return;}
    const chosen=rooms as PlanRoom[];
    say('copilot',paint(chosen.map(r=>({kind:'floor' as const,id:r.id})),FLOOR_MATERIAL[intent.finish],()=>t('copilotFloorDone',{rooms:chosen.map(r=>r.name).join(', '),finish})));return;
   }
   case 'furnish':{
    const room=roomFor(intent);if(typeof room==='string'){say('copilot',room);return;}
    const layout=await furnishLayout(store.getSnapshot(),room,ai,await catalog(signal),signal);
    if(signal.aborted)return;
    if(!layout.results[layout.chosen]!.placed.length){say('copilot',t('copilotFurnishEmpty',{room:room.name}));return;}
    say('copilot',t('copilotFurnishReady',{room:room.name}),layout);return;
   }
  }
 };
 const send=async(request:string)=>{
  const said=request.trim();if(!said||busy)return;
  alive.current?.abort();const controller=new AbortController();alive.current=controller;
  say('me',said);setText('');setBusy(true);
  try{await act(acceptIntent(await provider.read(said,controller.signal)),controller.signal);}
  catch{if(!controller.signal.aborted)say('copilot',t('copilotFailed'));}
  finally{if(alive.current===controller)setBusy(false);}
 };
 // Only the newest layout can be applied; older ones become plain messages.
 const open=[...lines].reverse().find(l=>l.layout)?.id;
 const setLayout=(id:number,layout:Layout|undefined)=>setLines(old=>old.map(l=>l.id===id?{...l,layout}:l));
 const apply=(line:Line)=>{
  const layout=line.layout;if(!layout)return;
  const result=layout.results[layout.chosen]!;setLayout(line.id,undefined);
  if(store.getSnapshot().localGeneration!==layout.generation){say('copilot',t('copilotFurnishStale'));return;}
  const furniture=result.placed.map(p=>({id:`fu_${crypto.randomUUID().replaceAll('-','')}`,floorId:layout.floorId,assetId:p.asset.id,assetVersion:p.asset.version,position:{x:p.x,y:p.y},elevation:0,rotationDeg:p.rotationDeg,size:{...p.asset.dims},materialOverrides:{}}));
  const outcome=store.execute({id:`copilot_layout_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:layout.generation,type:'AddFurnitureBatch',furniture});
  say('copilot',outcome.ok?t('copilotFurnishAdded',{count:furniture.length}):t('copilotRejected'));
 };
 const chips=[t('copilotChip2bhk'),t('copilotChipFurnish'),t('copilotChipPaint')];
 return <div className="copilot">
  <p className="copilot-note">{t('copilotNote')}</p>
  <div className="copilot-chips" role="group" aria-label={t('copilotStarters')}>{chips.map(chip=><button key={chip} type="button" disabled={busy} onClick={()=>{void send(chip);}}>{chip}</button>)}</div>
  <ol className="copilot-log" ref={log} role="log" aria-label={t('copilotConversation')} aria-live="polite">
   {lines.map(line=><li key={line.id} className={`copilot-line from-${line.from}`} data-from={line.from}>
    <span className="copilot-who">{line.from==='me'?t('copilotYou'):t('copilotName')}</span>
    <p>{line.text}</p>
    {line.layout&&line.id===open&&<LayoutPreview layout={line.layout} locale={locale} applyLabel={t('copilotApply')} onApply={()=>apply(line)} onCancel={()=>setLayout(line.id,undefined)} onChange={next=>setLayout(line.id,next)}/>}
   </li>)}
   {busy&&<li className="copilot-line from-copilot" role="status">{t('copilotThinking')}</li>}
  </ol>
  <form className="copilot-ask" onSubmit={event=>{event.preventDefault();void send(text);}}>
   <input type="text" aria-label={t('copilotAsk')} placeholder={t('copilotAsk')} value={text} maxLength={300} onChange={event=>setText(event.target.value)} enterKeyHint="send"/>
   <button type="submit" className="primary-button" disabled={busy||!text.trim()}>{t('copilotSend')}</button>
  </form>
 </div>;
}
