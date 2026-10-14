import {useEffect,useState,useSyncExternalStore} from 'react';
import type {Command,ProjectStore} from '@gharplan/core-model';
import {openingEndGuard} from '@gharplan/core-model';
import type {PrecisionPreview} from './WallPrecision';
import {formatLength,parseLength} from './measurements';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
export function OpeningControls({store,wallId,selected,onSelect,onPreview,cancelToken,locale,onMessage}:{store:ProjectStore;wallId:string;selected:string;onSelect(id:string):void;onPreview(value:PrecisionPreview|null):void;cancelToken:number;locale:Locale;onMessage(text:string):void}) {
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),doc=snapshot.document,opening=doc.openings.find(o=>o.id===selected),wall=doc.walls.find(w=>w.id===(opening?.wallId??wallId));
 const [kind,setKind]=useState<'door'|'window'>('door'),[offset,setOffset]=useState('2000 mm'),[width,setWidth]=useState('900 mm'),[height,setHeight]=useState('2100 mm'),[sill,setSill]=useState('0 mm'),[flipX,setFlipX]=useState(false),[flipY,setFlipY]=useState(false);
 const [pending,setPending]=useState<{command:Command;preview:PrecisionPreview}|null>(null),[invalid,setInvalid]=useState(false);
 const clear=()=>{setPending(null);setInvalid(false);onPreview(null);};
 useEffect(()=>{clear();if(opening){setOffset(formatLength(opening.offset,doc.units));setWidth(formatLength(opening.width,doc.units));setHeight(formatLength(opening.height,doc.units));setSill(formatLength(opening.sill,doc.units));setFlipX(opening.flipX);setFlipY(opening.flipY);}else{setWidth('900 mm');setHeight(kind==='door'?'2100 mm':'1200 mm');setSill(kind==='door'?'0 mm':'900 mm');setFlipX(false);setFlipY(false);if(wall){const a=doc.junctions.find(j=>j.id===wall.a)!,b=doc.junctions.find(j=>j.id===wall.b)!;setOffset(formatLength(Math.floor((Math.abs(b.x-a.x)+Math.abs(b.y-a.y))/2),doc.units));}}},[opening,wall,doc.units,snapshot.localGeneration,kind]);
 useEffect(()=>{clear();},[cancelToken]);
 useEffect(()=>()=>onPreview(null),[onPreview]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')clear();},blur=()=>clear(),hidden=()=>{if(document.hidden)clear();};window.addEventListener('keydown',key);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};},[onPreview]);
 const prepare=(action:'save'|'delete'|'reverse')=>{
  clear();if(!wall)return;
  try{
   const base={id:`opening_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration};let command:Command;
   if(action==='delete'){if(!opening)return;command={...base,type:'DeleteOpening',openingId:opening.id};}
   else if(action==='reverse')command={...base,type:'ReverseWall',wallId:wall.id};
   else {const actualKind=opening?.kind??kind,properties={offset:parseLength(offset),width:parseLength(width),height:parseLength(height),sill:actualKind==='door'?0:parseLength(sill,{coordinate:true,maximum:6000}),flipX,flipY};command=opening?{...base,type:'UpdateOpening',openingId:opening.id,properties}:{...base,type:'AddOpening',opening:{...properties,id:`opening_${crypto.randomUUID().replaceAll('-','')}`,wallId:wall.id,kind,assetId:kind==='door'?'door_asset':'window_asset'}};}
   const preview={projectId:doc.id,sessionId:snapshot.sessionId,generation:snapshot.localGeneration,result:store.preview(command)};setPending({command,preview});onPreview(preview);
  }catch{setInvalid(true);}
 };
 const field=(label:'openingOffset'|'openingWidth'|'openingHeight'|'openingSill',value:string,set:(v:string)=>void)=><label>{message(locale,label)}<input required aria-label={message(locale,label)} value={value} onChange={e=>{clear();set(e.target.value);}}/></label>;
 return <section className="drawing-controls" aria-label={message(locale,'openingsPanel')}><h3>{message(locale,'openingsPanel')}</h3>
  <label>{message(locale,'chooseOpening')}<select aria-label={message(locale,'chooseOpening')} value={selected} onChange={e=>onSelect(e.target.value)}><option value="">{message(locale,'newOpening')}</option>{doc.openings.map((o,i)=><option key={o.id} value={o.id}>{message(locale,'openingOption',{number:i+1,kind:message(locale,o.kind==='door'?'doorKind':o.kind==='window'?'windowKind':'emptyOpeningKind')})}</option>)}</select></label>
  {!opening&&<label>{message(locale,'openingKind')}<select aria-label={message(locale,'openingKind')} value={kind} onChange={e=>{clear();setKind(e.target.value as 'door'|'window');}}><option value="door">{message(locale,'doorKind')}</option><option value="window">{message(locale,'windowKind')}</option></select></label>}
  {!wall?<p role="status">{message(locale,'openingNeedsWall')}</p>:<>
   <p>{message(locale,'openingHost',{id:wall.id})}</p><p>{message(locale,'openingEndMargins',{a:openingEndGuard(doc,wall,'a'),b:openingEndGuard(doc,wall,'b'),height:wall.height})}</p><p>{message(locale,'measuredEntryHint')}</p>
   <form onSubmit={e=>{e.preventDefault();prepare('save');}}>{field('openingOffset',offset,setOffset)}<div className="coordinate-fields">{field('openingWidth',width,setWidth)}{field('openingHeight',height,setHeight)}</div>{(opening?.kind??kind)!=='door'&&field('openingSill',sill,setSill)}
    {(opening?.kind??kind)==='door'&&<><label className="snap-toggle"><input type="checkbox" checked={flipX} onChange={e=>{clear();setFlipX(e.target.checked);}}/>{message(locale,'openingHingeFlip')}</label><label className="snap-toggle"><input type="checkbox" checked={flipY} onChange={e=>{clear();setFlipY(e.target.checked);}}/>{message(locale,'openingSwingFlip')}</label></>}
    <button className="primary-button" type="submit">{message(locale,'previewOpening')}</button>
   </form>
   <button onClick={()=>prepare('reverse')}>{message(locale,'previewReverseHost')}</button>{opening&&<button onClick={()=>prepare('delete')}>{message(locale,'previewDeleteOpening')}</button>}
  </>}
  {invalid&&<p role="alert">{message(locale,'openingInputError')}</p>}
  {pending&&<div data-testid="opening-preview"><p>{message(locale,'previewOnly')}</p><p>{message(locale,pending.command.type==='DeleteOpening'?'openingDeleteNotice':pending.command.type==='ReverseWall'?'openingReverseNotice':'openingPreviewNotice')}</p>
   {pending.preview.result.ok?<button className="primary-button" onClick={()=>{const live=store.getSnapshot();if(live.document.id!==pending.preview.projectId||live.sessionId!==pending.preview.sessionId||live.localGeneration!==pending.preview.generation){clear();onMessage(message(locale,'dragChanged'));return;}const result=store.execute(pending.command);clear();if(result.ok&&pending.command.type==='AddOpening')onSelect(pending.command.opening.id);onMessage(result.ok?message(locale,'openingApplied'):editError(locale,result.errors[0]));}}>{message(locale,'applyOpening')}</button>:<p role="alert">{editError(locale,pending.preview.result.errors[0])}</p>}
   <button onClick={clear}>{message(locale,'cancelOpening')}</button>
  </div>}
 </section>;
}
