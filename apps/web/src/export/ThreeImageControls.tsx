import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import type {ProjectStore} from '@gharplan/core-model';
import type {ThreeControlsApi} from '../render3d/types';
import type {CapturedPixels} from '../render3d/capture';
import type {PicturePreset} from '../render3d/picture';
import {copyFramebuffer,encodeThreeImage} from './three-image';
import {encodeHdPicture,pictureFileName} from './hd-picture';
import type {PictureFormat} from './hd-picture';
import {exportNativePng} from '../storage/native-png';
import {MAX_PNG_BYTES} from '../editor/png';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
type Size='screen'|PicturePreset;
type Status='threeImageIdle'|'imageRendering'|'imageReady'|'imageFailed'|'imageRequested'|'imageSaveBusy'|'imageVerified'|'imageSaveFailed'|'imageCancelled'|'pictureMaking'|'pictureChecking'|'pictureReady'|'pictureCancelled'|'pictureChanged'|'pictureTooBig'|'pictureFailed'|'pictureRequested';
const failure=(e:unknown):Status=>{const code=e instanceof Error?e.message:'';return code==='capture-cancelled'?'pictureCancelled':code==='capture-changed'||code==='capture-context'||code==='capture-unavailable'?'pictureChanged':code==='picture-budget'||code==='capture-size'?'pictureTooBig':'pictureFailed';};
export function ThreeImageControls({api,store,locale}:{api:ThreeControlsApi|null;store:ProjectStore;locale:Locale}){
 const source=useRef<{raw:CapturedPixels;name:string}|null>(null),flight=useRef(false),epoch=useRef(0),url=useRef<string|null>(null),abort=useRef<AbortController|null>(null);const [edge,setEdge]=useState<1000|2000>(1000),[busy,setBusy]=useState(false),[image,setImage]=useState<{blob:Blob;url:string;width:number;height:number;generation:number;file:string;format:PictureFormat;hd:boolean;capped:boolean}|null>(null),[status,setStatus]=useState<Status>('threeImageIdle');
 // D89: picture size (Screen keeps the earlier behaviour), an optional small mark, and PNG/JPEG for web downloads.
 const [size,setSize]=useState<Size>('screen'),[watermark,setWatermark]=useState(true),[format,setFormat]=useState<PictureFormat>('png'),[progress,setProgress]=useState(0);const android=Capacitor.getPlatform()==='android';
 const release=()=>{if(url.current)URL.revokeObjectURL(url.current);url.current=null;};useEffect(()=>()=>{epoch.current++;abort.current?.abort();release();source.current=null;},[]);
 const create=async(lower=false)=>{if(flight.current||!lower&&!api)return;flight.current=true;const token=++epoch.current;release();setImage(null);setBusy(true);setStatus('imageRendering');
  try{if(!lower){source.current=null;const name=store.getSnapshot().document.name,raw=api!.capture(edge,copyFramebuffer);source.current={raw,name};}if(!source.current)throw new Error('capture-unavailable');const result=await encodeThreeImage(source.current.raw,lower?1000:edge,source.current.name,watermark);if(epoch.current!==token)return;const u=URL.createObjectURL(result.blob);url.current=u;setImage({...result,url:u,generation:source.current.raw.generation,file:pictureFileName(source.current.name,new Date(),result.width,result.height,'png'),format:'png',hd:false,capped:false});setStatus('imageReady');}catch{if(epoch.current===token)setStatus('imageFailed');}finally{flight.current=false;if(epoch.current===token)setBusy(false);}
 };
 const createPicture=async(preset:PicturePreset)=>{if(flight.current||!api)return;flight.current=true;const token=++epoch.current,controller=new AbortController();abort.current=controller;release();setImage(null);source.current=null;setBusy(true);setProgress(0);setStatus('pictureMaking');
  let canvas:HTMLCanvasElement|undefined;
  try{const name=store.getSnapshot().document.name,kind:PictureFormat=android?'png':format;
   // Let the progress message paint before the first slice of tiles.
   await new Promise<void>(r=>requestAnimationFrame(()=>r()));if(controller.signal.aborted)throw new Error('capture-cancelled');
   const shot=await api.picture({preset,nativeSave:android},{signal:controller.signal,onProgress:f=>{if(epoch.current===token)setProgress(f);}});canvas=shot.canvas;if(epoch.current!==token)return;setStatus('pictureChecking');
   const result=await encodeHdPicture(shot.canvas,{format:kind,watermark,generation:shot.generation,signal:controller.signal,...(android?{maxBytes:MAX_PNG_BYTES}:{})});if(epoch.current!==token)return;
   const u=URL.createObjectURL(result.blob);url.current=u;setImage({...result,url:u,generation:shot.generation,file:pictureFileName(name,new Date(),result.width,result.height,kind),format:kind,hd:true,capped:shot.capped});setStatus('pictureReady');
  }catch(e){if(epoch.current===token)setStatus(failure(e));}
  finally{if(canvas)canvas.width=canvas.height=0;if(abort.current===controller)abort.current=null;flight.current=false;if(epoch.current===token)setBusy(false);}
 };
 const save=async()=>{if(!image||flight.current)return;const token=epoch.current;if(android){if(!Capacitor.isPluginAvailable('ProjectFiles')){setStatus('imageSaveFailed');return;}flight.current=true;setBusy(true);setStatus('imageSaveBusy');try{await exportNativePng(image.blob);if(epoch.current===token)setStatus('imageVerified');}catch(e){if(epoch.current===token)setStatus(e&&typeof e==='object'&&'code'in e&&e.code==='EXPORT_CANCELLED'?'imageCancelled':'imageSaveFailed');}finally{flight.current=false;if(epoch.current===token)setBusy(false);}return;}try{const a=document.createElement('a');a.href=image.url;a.download=image.file;a.click();setStatus(image.hd?'pictureRequested':'imageRequested');}catch{setStatus('imageSaveFailed');}};
 const making=status==='pictureMaking'||status==='pictureChecking',alert=status==='imageFailed'||status==='imageSaveFailed'||status==='pictureFailed'||status==='pictureTooBig'||status==='pictureChanged';
 return <section className="local-saving" aria-label={message(locale,'threeImagePanel')}><h3>{message(locale,'threeImagePanel')}</h3>
  <label>{message(locale,'pictureSize')}<select aria-label={message(locale,'pictureSize')} value={size} disabled={busy} onChange={e=>setSize(e.target.value as Size)}><option value="screen">{message(locale,'pictureScreen')}</option><option value="hd">{message(locale,'pictureHd')}</option><option value="qhd">{message(locale,'pictureQhd')}</option><option value="square">{message(locale,'pictureSquare')}</option></select></label>
  {size==='screen'&&<label>{message(locale,'threeImageResolution')}<select aria-label={message(locale,'threeImageResolution')} value={edge} onChange={e=>setEdge(Number(e.target.value) as 1000|2000)}><option value={1000}>{message(locale,'imagePixelEdge',{edge:1000})}</option><option value={2000}>{message(locale,'imagePixelEdge',{edge:2000})}</option></select></label>}
  {size!=='screen'&&!android&&<label>{message(locale,'pictureFormat')}<select aria-label={message(locale,'pictureFormat')} value={format} disabled={busy} onChange={e=>setFormat(e.target.value as PictureFormat)}><option value="png">{message(locale,'picturePng')}</option><option value="jpeg">{message(locale,'pictureJpeg')}</option></select></label>}
  <label><input type="checkbox" checked={watermark} disabled={busy} onChange={e=>setWatermark(e.target.checked)}/>{message(locale,'pictureWatermark')}</label>
  {size==='screen'?<button disabled={busy||!api} onClick={()=>{void create();}}>{message(locale,'createThreeImage')}</button>:<button className="primary-button" disabled={busy||!api} onClick={()=>{void createPicture(size);}}>{message(locale,'makePicture')}</button>}
  {making&&<button onClick={()=>{abort.current?.abort();}}>{message(locale,'cancelPicture')}</button>}
  {making&&<progress max={100} value={Math.round(progress*100)} aria-label={message(locale,'pictureProgress')}/>}
  <p role={alert?'alert':'status'}>{status==='pictureMaking'?message(locale,'pictureMaking',{percent:Math.round(progress*100)}):message(locale,status==='threeImageIdle'&&size!=='screen'?'pictureIdle':status)}</p>
  {source.current&&(image||status==='imageFailed')&&<button disabled={busy} onClick={()=>{void create(true);}}>{message(locale,'lowerImageResolution')}</button>}
  {image&&<div role="region" aria-label={message(locale,image.hd?'picturePreview':'threeImagePreview')}><p>{message(locale,image.hd?'pictureSnapshotHelp':'threeImageSnapshotHelp')}</p><img className="plan-image-preview" src={image.url} width={image.width} height={image.height} alt={message(locale,image.hd?'pictureAlt':'threeImageAlt')}/>
   {image.hd?<p>{message(locale,'pictureInfo',{format:image.format==='jpeg'?'JPEG':'PNG',width:image.width,height:image.height,file:image.file})}</p>:<p>{message(locale,'imageSize',{width:image.width,height:image.height})} · {message(locale,'imageGeneration',{generation:image.generation})}</p>}
   {image.capped&&<p role="status">{message(locale,'pictureCapped',{width:image.width,height:image.height})}</p>}
   <button disabled={busy} onClick={()=>{void save();}}>{message(locale,image.hd?'savePicture':'saveThreeImage')}</button><button disabled={busy} onClick={()=>{epoch.current++;release();source.current=null;setImage(null);setStatus('threeImageIdle');}}>{message(locale,'closeImagePreview')}</button></div>}</section>;
}
