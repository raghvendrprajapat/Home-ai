import {useEffect,useState} from 'react';
import {ProjectStore} from '@gharplan/core-model';
import type {ProjectDoc,RoomType} from '@gharplan/core-model';
import {CatalogApi} from '../catalog/api';
import {areaDisplay,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {createGalleryProject,GALLERY_IDS} from './designs';
import type {GalleryAsset,GalleryId} from './designs';

/** Original top-view preview of the actual command-built drawing; no GLB, WebGL context or storage writes. */
function PlanPreview({document}:{document:ProjectDoc}){
 const snapshot=new ProjectStore(document,'gallery_card').getSnapshot(),js=new Map(document.junctions.map(j=>[j.id,j]));
 const xs=document.junctions.map(j=>j.x),ys=document.junctions.map(j=>j.y),pad=350,x=Math.min(...xs)-pad,y=Math.min(...ys)-pad,width=Math.max(...xs)-x+pad,height=Math.max(...ys)-y+pad;
 return <svg className="gallery-plan" viewBox={`${x} ${y} ${width} ${height}`} aria-hidden="true" focusable="false">
  {snapshot.derived.faces.flatMap(f=>f.clearRects.map((r,i)=><rect key={`${f.roomId}_${i}`} x={r[0]} y={r[1]} width={r[2]-r[0]} height={r[3]-r[1]} fill={document.materials.find(m=>m.id===document.rooms.find(room=>room.id===f.roomId)!.floorMaterial)?.baseColor??'#eee9df'}/>))}
  {document.walls.map(w=>{const a=js.get(w.a)!,b=js.get(w.b)!;return <line key={w.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#41564b" strokeWidth={w.thickness}/>;})}
  {document.openings.map(o=>{const w=document.walls.find(w=>w.id===o.wallId)!,a=js.get(w.a)!,b=js.get(w.b)!,length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length,x=a.x+dx*o.offset,y=a.y+dy*o.offset;return <g key={o.id}><line x1={x-dx*o.width/2} y1={y-dy*o.width/2} x2={x+dx*o.width/2} y2={y+dy*o.width/2} stroke="#fbfcf8" strokeWidth={w.thickness+2}/>{o.kind==='window'&&<line x1={x-dx*o.width/2} y1={y-dy*o.width/2} x2={x+dx*o.width/2} y2={y+dy*o.width/2} stroke="#77a5b2" strokeWidth={50}/>}</g>;})}
  {document.furniture.map(f=><rect key={f.id} x={-f.size.w/2} y={-f.size.d/2} width={f.size.w} height={f.size.d} rx={65} transform={`translate(${f.position.x} ${f.position.y}) rotate(${f.rotationDeg})`} fill={/bed/.test(f.assetId)?'#8299ac':/table/.test(f.assetId)?'#bd9b72':/almirah|kitchen/.test(f.assetId)?'#b7c0af':'#6e8b75'} stroke="#40584d" strokeWidth={25}/>)}
 </svg>;
}
interface Entry {id:GalleryId;document:ProjectDoc;clearAreaMm2:number}
export default function DesignGallery({locale,units,busy,onUse,onClose}:{locale:Locale;units:'metric'|'imperial';busy:boolean;onUse(id:GalleryId,assets:readonly GalleryAsset[]):void;onClose():void}){
 const [entries,setEntries]=useState<readonly Entry[]>([]),[assets,setAssets]=useState<readonly GalleryAsset[]>([]),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setEntries([]);setAssets([]);setFailed(false);
  const api=new CatalogApi(new URL('catalog/',new URL(import.meta.env.BASE_URL,window.location.href)));
  void api.catalog(controller.signal).then(catalog=>{
   if(controller.signal.aborted)return;
   const prepared=GALLERY_IDS.map(id=>{let n=0;const document=createGalleryProject({design:id,name:message(locale,`gallery_${id}`),units,now:'2026-10-21T00:00:00.000Z',nextId:()=>`gp_preview_${id}_${++n}`,roomName:(type:RoomType)=>message(locale,`room_${type}`),floorName:message(locale,'groundFloor'),materialName:message(locale,'baseFinish'),hallName:message(locale,'room_hall')},catalog.assets);
    return {id,document,clearAreaMm2:new ProjectStore(document,'gallery_area').getSnapshot().derived.faces.reduce((sum,f)=>sum+f.clearAreaMm2,0)};});
   if(!controller.signal.aborted){setAssets(catalog.assets);setEntries(prepared);}
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
  return ()=>controller.abort();
 },[locale,units,attempt]);
 return <section aria-label={message(locale,'galleryTitle')}>
  <button disabled={busy} onClick={onClose}>{message(locale,'galleryClose')}</button><p>{message(locale,'galleryHelp')}</p>
  {!failed&&!entries.length&&<p role="status">{message(locale,'galleryLoading')}</p>}
  {failed&&<><p role="alert">{message(locale,'galleryFailed')}</p><button disabled={busy} onClick={()=>setAttempt(n=>n+1)}>{message(locale,'galleryRetry')}</button></>}
  <div className="gallery-cards">{entries.map(({id,document,clearAreaMm2})=>{const area=areaDisplay(clearAreaMm2,units);return <article className="gallery-card" key={id} aria-label={document.name} data-gallery-id={id}>
   <PlanPreview document={document}/><h3>{document.name}</h3><p>{message(locale,`gallery_${id}_help`)}</p><p>{message(locale,'galleryFacts',{rooms:document.rooms.length,items:document.furniture.length,area:area.value,unit:area.unit})}</p>
   <button className="primary-button" disabled={busy} onClick={()=>onUse(id,assets)}>{message(locale,'galleryUse',{name:document.name})}</button>
  </article>;})}</div>
 </section>;
}
