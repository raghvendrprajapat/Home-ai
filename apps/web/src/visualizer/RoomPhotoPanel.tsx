import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {Icon} from '../ui/Icon';
import {checkPhotoFile} from './photo-prep';
import {cloud as defaultCloud} from '../cloud/session';
import type {CloudSession} from '../cloud/session';
import type {PhotoProblem} from './photo-prep';
import type {RoomSession,RoomSessions,RoomSessionSummary} from './room-sessions';

function LoadFailed({locale}:{locale:Locale;file:File;onClose(problem?:PhotoProblem):void;cloud?:CloudSession|null}):ReactNode{return <p role="alert">{message(locale,'vizLoadFailed')}</p>;}
// The visualizer (engine, mask, full-screen view) loads only when a photo is chosen, so the editor bundle stays small.
const VisualizerView=lazy(()=>import('./VisualizerView').catch(()=>({default:LoadFailed})));
/** D87: the device store loads on its own small chunk; null when this browser cannot keep data (the list hides). */
const openDeviceSessions=()=>import('./room-sessions').then(m=>m.openRoomSessions()).catch(()=>null);
type Recent=RoomSessionSummary&{readonly url:string};

/**
 * D85 Room photo tool panel: what it does, the "preview only" note and the photo chooser. The chosen photo opens the
 * full-screen visualizer; closing it returns here with the drawing untouched (the visualizer never sees the store).
 * D87: "Recent room photos" lists sessions kept on this device (saved when an option is kept) to reopen or delete.
 */
export function RoomPhotoPanel({locale,cloud=defaultCloud,openSessions=openDeviceSessions}:{locale:Locale;cloud?:CloudSession|null;openSessions?:()=>Promise<RoomSessions|null>}){
 const [file,setFile]=useState<File|null>(null),[problem,setProblem]=useState<PhotoProblem|null>(null),input=useRef<HTMLInputElement>(null),button=useRef<HTMLButtonElement>(null);
 const [store,setStore]=useState<RoomSessions|null>(null),[recent,setRecent]=useState<readonly Recent[]>([]),[session,setSession]=useState<RoomSession|null>(null);
 const [recentNote,setRecentNote]=useState<'open'|'delete'|null>(null),[confirmAll,setConfirmAll]=useState(false),urls=useRef<readonly Recent[]>([]);
 const choose=(chosen:File|undefined)=>{
  if(input.current)input.current.value='';if(!chosen)return;
  const bad=checkPhotoFile(chosen);setProblem(bad);setSession(null);setFile(bad?null:chosen);
 };
 const show=useCallback((list:readonly Recent[])=>{for(const r of urls.current)URL.revokeObjectURL(r.url);urls.current=list;setRecent(list);},[]);
 const refresh=useCallback(async(from:RoomSessions|null)=>{
  if(!from)return;
  try{const list=await from.list();show(list.map(s=>({...s,url:URL.createObjectURL(new Blob([s.thumb as Uint8Array<ArrayBuffer>],{type:'image/jpeg'}))})));}catch{show([]);}
 },[show]);
 useEffect(()=>{let live=true;void openSessions().then(s=>{if(!live)return;setStore(s);void refresh(s);});return()=>{live=false;};},[openSessions,refresh]);
 useEffect(()=>()=>{for(const r of urls.current)URL.revokeObjectURL(r.url);},[]);
 const close=(failed?:PhotoProblem)=>{setFile(null);setSession(null);setProblem(failed??null);void refresh(store);queueMicrotask(()=>button.current?.focus({preventScroll:true}));};
 const reopen=async(id:string)=>{
  if(!store)return;setRecentNote(null);setProblem(null);
  try{const s=await store.open(id);setSession(s);setFile(new File([s.photo as Uint8Array<ArrayBuffer>],'room-photo.jpg',{type:'image/jpeg',lastModified:s.savedAt}));}
  catch{setRecentNote('open');}
 };
 const remove=async(id:string|null)=>{
  if(!store)return;setRecentNote(null);setConfirmAll(false);
  try{if(id)await store.remove(id);else await store.removeAll();}catch{setRecentNote('delete');}
  await refresh(store);
 };
 const when=(savedAt:number)=>new Date(savedAt).toLocaleString(locale==='hi'?'hi-IN':'en-IN',{dateStyle:'medium',timeStyle:'short'});
 return <div className="room-photo-panel">
  <p>{message(locale,'vizIntro')}</p>
  <p className="viz-note">{message(locale,'vizPreviewNote')}</p>
  <button ref={button} className="primary-button" onClick={()=>input.current?.click()}>{message(locale,'vizChoose')}</button>
  <input ref={input} className="viz-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={event=>choose(event.target.files?.[0])}/>
  {problem&&<p role="alert">{message(locale,`vizPhoto_${problem}`)}</p>}
  {store&&recent.length>0&&<section className="room-recent" aria-label={message(locale,'vizRecentTitle')}>
   <h3>{message(locale,'vizRecentTitle')}</h3>
   <p>{message(locale,'vizRecentHelp')}</p>
   <ul>{recent.map(r=>{const date=when(r.savedAt);return <li key={r.id}>
    <button className="room-recent-open" onClick={()=>{void reopen(r.id);}}><img src={r.url} alt="" width={72} height={48}/><span>{date}<small>{r.options===1?message(locale,'vizRecentOneOption'):message(locale,'vizRecentOptions',{count:r.options})}</small></span></button>
    <button className="icon-button" aria-label={message(locale,'vizRecentDelete',{date})} onClick={()=>{void remove(r.id);}}><Icon name="close"/></button>
   </li>;})}</ul>
   {confirmAll?<div role="alertdialog" aria-label={message(locale,'vizRecentDeleteAll')}>
    <p>{message(locale,'vizRecentConfirm',{count:recent.length})}</p>
    <div className="viz-row"><button onClick={()=>{void remove(null);}}>{message(locale,'vizRecentConfirmYes')}</button><button onClick={()=>setConfirmAll(false)}>{message(locale,'vizRecentCancel')}</button></div>
   </div>:<div className="viz-row"><button onClick={()=>setConfirmAll(true)}>{message(locale,'vizRecentDeleteAll')}</button></div>}
  </section>}
  {recentNote&&<p role="alert">{message(locale,recentNote==='open'?'vizRecentOpenFailed':'vizRecentDeleteFailed')}</p>}
  {file&&<Suspense fallback={<p role="status">{message(locale,'vizLoading')}</p>}><VisualizerView key={session?`session:${session.id}`:`${file.name}:${file.size}:${file.lastModified}`} file={file} locale={locale} onClose={close} cloud={cloud} session={session} sessions={store} onSessionSaved={()=>{void refresh(store);}}/></Suspense>}
 </div>;
}
