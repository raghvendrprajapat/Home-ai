import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import type {ProjectStore} from '@gharplan/core-model';
import {renderPlanImage} from '../editor/plan-image';
import type {PlanImageLayout} from '../editor/plan-image';
import {exportNativePng} from '../storage/native-png';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
export function PlanImageControls({store,locale}:{store:ProjectStore;locale:Locale}) {
 const flight=useRef(false),epoch=useRef(0),source=useRef<{snapshot:Snapshot;locale:Locale}|null>(null),currentUrl=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[image,setImage]=useState<{blob:Blob;layout:PlanImageLayout;url:string}|null>(null),[status,setStatus]=useState<'imageIdle'|'imageRendering'|'imageReady'|'imageFailed'|'imageSaveBusy'|'imageRequested'|'imageVerified'|'imageSaveFailed'|'imageCancelled'>('imageIdle');
 const release=()=>{if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);currentUrl.current=null;};
 useEffect(()=>()=>{epoch.current++;release();},[]);
 const render=async(edge:1000|2000,retry=false)=>{
  if(flight.current)return;flight.current=true;const token=++epoch.current;release();setImage(null);setBusy(true);setStatus('imageRendering');if(!retry||!source.current)source.current={snapshot:store.getSnapshot(),locale};
  const captured=source.current;
  try{await new Promise<void>(r=>requestAnimationFrame(()=>r()));const result=await renderPlanImage(captured.snapshot,captured.locale,edge);if(epoch.current!==token)return;const url=URL.createObjectURL(result.blob);currentUrl.current=url;setImage({...result,url});setStatus('imageReady');}catch{if(epoch.current===token)setStatus('imageFailed');}finally{flight.current=false;if(epoch.current===token)setBusy(false);}
 };
 const save=async()=>{if(!image||flight.current)return;const token=epoch.current;
  if(Capacitor.getPlatform()==='android'){if(!Capacitor.isPluginAvailable('ProjectFiles')){setStatus('imageSaveFailed');return;}flight.current=true;setBusy(true);setStatus('imageSaveBusy');try{await exportNativePng(image.blob);if(epoch.current===token)setStatus('imageVerified');}catch(e){if(epoch.current===token)setStatus(e&&typeof e==='object'&&'code'in e&&e.code==='EXPORT_CANCELLED'?'imageCancelled':'imageSaveFailed');}finally{flight.current=false;if(epoch.current===token)setBusy(false);}return;}
  try{const link=document.createElement('a');link.href=image.url;link.download='gharplan-plan.png';link.click();setStatus('imageRequested');}catch{setStatus('imageSaveFailed');}
 };
 return <section className="local-saving" aria-label={message(locale,'imageExportPanel')}><h3>{message(locale,'imageExportPanel')}</h3><button disabled={busy} onClick={()=>{void render(2000);}}>{message(locale,'exportPlanImage')}</button><p role={status==='imageFailed'||status==='imageSaveFailed'?'alert':'status'} aria-live="polite">{message(locale,status)}</p>
  {(status==='imageFailed'||image)&&<button disabled={busy} onClick={()=>{void render(1000,true);}}>{message(locale,'lowerImageResolution')}</button>}
  {image&&<div className="backup-copy" role="region" aria-label={message(locale,'imagePreview')}><p>{message(locale,'imageSnapshotHelp')}</p><img className="plan-image-preview" src={image.url} alt={message(locale,'imageAlt')} width={image.layout.edge} height={image.layout.edge}/><p>{message(locale,'imageSize',{width:image.layout.edge,height:image.layout.edge})}</p><details><summary>{message(locale,'imageDimensionLabels')}</summary><ul>{image.layout.labels.map(label=><li key={label.id}>{label.id}: {label.text}</li>)}</ul></details><button disabled={busy} onClick={()=>{void save();}}>{message(locale,'savePlanImage')}</button><button disabled={busy} onClick={()=>{epoch.current++;release();setImage(null);source.current=null;setStatus('imageIdle');}}>{message(locale,'closeImagePreview')}</button></div>}
 </section>;
}
