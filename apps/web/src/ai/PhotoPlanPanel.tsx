import {useEffect,useRef,useState} from 'react';
import type {MouseEvent} from 'react';
import {createRoomsProject} from '@gharplan/core-model';
import type {ProjectDoc,RoomType} from '@gharplan/core-model';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import type {PlanUnderlay} from '../editor/view2d';
import type {AiProvider} from './furniture-suggest';
import {acceptSketch,scaleFromMarks} from './sketch';
import type {SketchPixels,SketchResult} from './sketch';

interface Picture {readonly url:string;readonly image:HTMLImageElement;readonly pixels:SketchPixels}
type Reading=Readonly<{phase:'reading'}|{phase:'failed'}|{phase:'ready';sketch:SketchResult;document:ProjectDoc|undefined;skipped:number;skippedDoors:number}>;
const MAX_BYTES=15*1024*1024,READ_PX=480;
/**
 * The chosen picture and its settings for this app session only (never saved), so it is still under the plan after
 * "Create a new drawing" opens the new project.
 */
let remembered:Readonly<{picture:Picture;widthMm:number;left:number;top:number;shown:boolean;strength:number}>|null=null;

async function openPicture(file:File):Promise<Picture>{
 if(!file.type.startsWith('image/')||file.size<1||file.size>MAX_BYTES)throw Error('photo-file');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  // Read at most 480 px across: enough for room lines and quick on budget phones.
  const scale=Math.min(1,READ_PX/Math.max(image.naturalWidth,image.naturalHeight)),width=Math.max(16,Math.round(image.naturalWidth*scale)),height=Math.max(16,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('photo-canvas');
  context.drawImage(image,0,0,width,height);
  return {url,image,pixels:{width,height,data:context.getImageData(0,0,width,height).data}};
 }catch(error){URL.revokeObjectURL(url);throw error;}
}

/**
 * D73 AI-3. Stage 1 (no AI): show a photo or sketch under the plan, at a real width, to trace over it.
 * Stage 2: the provider reads room rectangles, acceptSketch makes them buildable, the rooms are built into a new
 * drawing with the real commands and previewed; the person then opens it as a new project.
 */
export function PhotoPlanPanel({locale,provider,units,onUnderlay,onOpen}:{locale:Locale;provider:AiProvider;units:ProjectDoc['units'];onUnderlay(underlay:PlanUnderlay|null):void;onOpen(document:ProjectDoc):void}){
 const [picture,setPicture]=useState<Picture|null>(()=>remembered?.picture??null),[failed,setFailed]=useState(false),[widthMm,setWidthMm]=useState(()=>remembered?.widthMm??10000),[shown,setShown]=useState(()=>remembered?.shown??false),[strength,setStrength]=useState(()=>remembered?.strength??50),[left,setLeft]=useState(()=>remembered?.left??0),[top,setTop]=useState(()=>remembered?.top??0);
 const [reading,setReading]=useState<Reading|null>(null),input=useRef<HTMLInputElement>(null);
 const [marks,setMarks]=useState<readonly (readonly [number,number])[]|null>(null),[markMm,setMarkMm]=useState(''),[scaleNote,setScaleNote]=useState<'set'|'bad'|null>(null);
 const validWidth=Number.isInteger(widthMm)&&widthMm>=2000&&widthMm<=60000,validPlace=[left,top].every(v=>Number.isInteger(v)&&Math.abs(v)<=40000);
 useEffect(()=>{remembered=picture?{picture,widthMm,left,top,shown,strength}:null;},[picture,widthMm,left,top,shown,strength]);
 useEffect(()=>{
  onUnderlay(picture&&shown&&validWidth&&validPlace?{image:picture.image,x:left,y:top,widthMm,heightMm:Math.round(widthMm*picture.pixels.height/picture.pixels.width),opacity:strength/100}:null);
 },[picture,shown,widthMm,strength,left,top,validWidth,validPlace,onUnderlay]);
 useEffect(()=>()=>onUnderlay(null),[onUnderlay]);
 const forget=()=>{if(picture)URL.revokeObjectURL(picture.url);setMarks(null);setScaleNote(null);};
 // The last picture chosen wins: one that finishes opening after a newer choice is released and ignored.
 const choosing=useRef(0);
 const choose=async(file:File|undefined)=>{
  const ticket=++choosing.current;
  setReading(null);setFailed(false);forget();setPicture(null);if(!file)return;
  try{const opened=await openPicture(file);if(ticket===choosing.current)setPicture(opened);else URL.revokeObjectURL(opened.url);}
  catch{if(ticket===choosing.current)setFailed(true);}
 };
 // Marking: a tap on the picture adds a point in the picture's own pixels (border excluded).
 const mark=(event:MouseEvent<HTMLImageElement>)=>{
  if(!marks||marks.length>=2||!picture)return;
  const img=event.currentTarget,x=event.nativeEvent.offsetX/img.clientWidth*picture.image.naturalWidth,y=event.nativeEvent.offsetY/img.clientHeight*picture.image.naturalHeight;
  setMarks([...marks,[x,y]]);
 };
 const applyScale=()=>{
  const width=marks?.length===2&&picture?scaleFromMarks(marks[0]!,marks[1]!,Number(markMm),picture.image.naturalWidth):undefined;
  if(width===undefined){setScaleNote('bad');return;}
  setWidthMm(width);setReading(null);setMarks(null);setMarkMm('');setScaleNote('set');
 };
 const read=async()=>{
  if(!picture||!validWidth||!validPlace)return;
  setReading({phase:'reading'});
  try{
   // Rooms are read relative to the picture's top-left corner, then placed where the picture is shown.
   const read=acceptSketch(await provider.planFromImage(picture.pixels,widthMm,new AbortController().signal)),sketch={...read,rooms:read.rooms.map(r=>({...r,x:r.x+left,y:r.y+top})),doors:read.doors.map(d=>({...d,x:d.x+left,y:d.y+top}))};
   let n=0;const nextId=()=>`ph_${crypto.randomUUID().replaceAll('-','')}${n++}`;
   const built=sketch.rooms.length?createRoomsProject({rooms:sketch.rooms,doors:sketch.doors,name:message(locale,'aiPhotoProjectName'),units,now:new Date().toISOString(),nextId,floorName:message(locale,'groundFloor'),materialName:message(locale,'baseFinish'),roomName:(type:RoomType)=>message(locale,`room_${type}` as const)}):undefined;
   setReading({phase:'ready',sketch,document:built&&built.skipped.length<sketch.rooms.length?built.document:undefined,skipped:built?.skipped.length??0,skippedDoors:built?.skippedDoors.length??0});
  }catch{setReading({phase:'failed'});}
 };
 const remove=()=>{forget();setPicture(null);setShown(false);setReading(null);if(input.current)input.current.value='';};
 // The new drawing's rooms sit where the picture is, so keep showing it there.
 const open=(document:ProjectDoc)=>{if(picture)remembered={picture,widthMm,left,top,shown:true,strength};onOpen(document);};
 return <section className="drawing-controls ai-panel" aria-label={message(locale,'aiPhotoTitle')}>
  <h3>{message(locale,'aiPhotoTitle')}</h3>
  <p className="structure-note">{message(locale,'aiPhotoPrivacy')}</p>
  <label>{message(locale,'aiPhotoChoose')}<input ref={input} type="file" accept="image/*" aria-label={message(locale,'aiPhotoChoose')} onChange={event=>{void choose(event.target.files?.[0]);}}/></label>
  {failed&&<p role="alert">{message(locale,'aiPhotoFailed')}</p>}
  {picture&&<>
   <div className="ai-photo-frame">
    <img className={marks?'ai-photo-thumb ai-photo-marking':'ai-photo-thumb'} src={picture.url} alt={marks?message(locale,'aiScalePicture'):''} onClick={mark}/>
    {marks?.map(([x,y],i)=><span key={i} className="ai-mark" data-mark={`${Math.round(x)},${Math.round(y)}`} style={{left:`${x/picture.image.naturalWidth*100}%`,top:`${y/picture.image.naturalHeight*100}%`}}/>)}
   </div>
   {marks?<div className="ai-scale" role="group" aria-label={message(locale,'aiScaleStart')}>
    <p role="status">{message(locale,marks.length===0?'aiScaleFirst':marks.length===1?'aiScaleSecond':'aiScaleLength')}</p>
    {marks.length===2&&<label>{message(locale,'aiScaleMm')}<input type="number" inputMode="numeric" min={500} max={30000} step={10} aria-label={message(locale,'aiScaleMm')} value={markMm} onChange={event=>{setMarkMm(event.target.value);setScaleNote(null);}}/></label>}
    <div className="ai-layout-actions">
     {marks.length===2&&<button className="primary-button" onClick={applyScale}>{message(locale,'aiScaleApply')}</button>}
     <button onClick={()=>{setMarks([]);setScaleNote(null);}}>{message(locale,'aiScaleAgain')}</button>
     <button onClick={()=>{setMarks(null);setScaleNote(null);}}>{message(locale,'aiScaleCancel')}</button>
    </div>
   </div>:<button onClick={()=>{setMarks([]);setMarkMm('');setScaleNote(null);}}>{message(locale,'aiScaleStart')}</button>}
   {scaleNote==='bad'&&<p role="alert">{message(locale,'aiScaleBad')}</p>}
   {scaleNote==='set'&&<p role="status">{message(locale,'aiScaleSet',{w:widthMm})}</p>}
   <label>{message(locale,'aiPhotoWidth')}<input type="number" inputMode="numeric" min={2000} max={60000} step={100} aria-label={message(locale,'aiPhotoWidth')} value={widthMm} onChange={event=>{setWidthMm(Number(event.target.value));setReading(null);}}/></label>
   <label>{message(locale,'aiPhotoLeft')}<input type="number" inputMode="numeric" min={-40000} max={40000} step={50} aria-label={message(locale,'aiPhotoLeft')} value={left} onChange={event=>{setLeft(Number(event.target.value));setReading(null);}}/></label>
   <label>{message(locale,'aiPhotoTop')}<input type="number" inputMode="numeric" min={-40000} max={40000} step={50} aria-label={message(locale,'aiPhotoTop')} value={top} onChange={event=>{setTop(Number(event.target.value));setReading(null);}}/></label>
   <label className="ai-check"><input type="checkbox" checked={shown} onChange={event=>setShown(event.target.checked)}/>{message(locale,'aiPhotoShow')}</label>
   <label>{message(locale,'aiPhotoStrength')}<input type="range" min={20} max={80} step={10} aria-label={message(locale,'aiPhotoStrength')} value={strength} onChange={event=>setStrength(Number(event.target.value))}/></label>
   <p className="structure-note">{message(locale,provider.kind==='stand-in'?'aiPhotoTestNote':'aiPhotoServerMode')}</p>
   <div className="ai-layout-actions">
    <button className="primary-button" disabled={!validWidth||!validPlace||reading?.phase==='reading'} onClick={()=>{void read();}}>{message(locale,'aiPhotoRead')}</button>
    <button onClick={remove}>{message(locale,'aiPhotoRemove')}</button>
   </div>
  </>}
  {reading?.phase==='reading'&&<p role="status">{message(locale,'aiPhotoReading')}</p>}
  {reading?.phase==='failed'&&<p role="alert">{message(locale,'aiPhotoReadFailed')}</p>}
  {reading?.phase==='ready'&&<SketchPreview reading={reading} locale={locale} onOpen={open}/>}
 </section>;
}

function SketchPreview({reading,locale,onOpen}:{reading:Extract<Reading,{phase:'ready'}>;locale:Locale;onOpen(document:ProjectDoc):void}){
 const {sketch,document,skipped,skippedDoors}=reading;
 if(!sketch.rooms.length||!document)return <p role="status">{message(locale,'aiPhotoNone')}</p>;
 const x0=Math.min(...sketch.rooms.map(r=>r.x)),y0=Math.min(...sketch.rooms.map(r=>r.y)),x1=Math.max(...sketch.rooms.map(r=>r.x+r.width)),y1=Math.max(...sketch.rooms.map(r=>r.y+r.depth)),pad=200;
 return <div className="ai-layout" data-testid="ai-sketch">
  <p role="status">{message(locale,'aiPhotoFound',{count:sketch.rooms.length,doors:sketch.doors.length})}</p>
  <svg role="img" aria-label={message(locale,'aiPhotoPreview')} viewBox={`${x0-pad} ${y0-pad} ${x1-x0+2*pad} ${y1-y0+2*pad}`}>
   {sketch.doors.map((d,i)=><circle key={`d${i}`} className="ai-door-mark" data-door={`${d.x},${d.y},${d.width}`} cx={d.x} cy={d.y} r={d.width/2}/>)}
   {sketch.rooms.map((r,i)=><rect key={i} className="ai-piece" data-room={`${r.x},${r.y},${r.width},${r.depth},${r.type}`} x={r.x} y={r.y} width={r.width} height={r.depth}><title>{message(locale,`room_${r.type}` as const)}</title></rect>)}
  </svg>
  {sketch.dropped>0&&<p className="structure-note">{message(locale,'aiPhotoDropped',{count:sketch.dropped})}</p>}
  {skipped>0&&<p className="structure-note">{message(locale,'aiPhotoSkipped',{count:skipped})}</p>}
  {skippedDoors>0&&<p className="structure-note">{message(locale,'aiPhotoSkippedDoors',{count:skippedDoors})}</p>}
  <p className="structure-note">{message(locale,'aiPhotoCreateNote')}</p>
  <button className="primary-button" onClick={()=>onOpen(document)}>{message(locale,'aiPhotoCreate')}</button>
 </div>;
}
