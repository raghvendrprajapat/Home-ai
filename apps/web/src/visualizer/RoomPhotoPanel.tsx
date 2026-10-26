import {lazy,Suspense,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {checkPhotoFile} from './photo-prep';
import type {PhotoProblem} from './photo-prep';

function LoadFailed({locale}:{locale:Locale;file:File;onClose(problem?:PhotoProblem):void}):ReactNode{return <p role="alert">{message(locale,'vizLoadFailed')}</p>;}
// The visualizer (engine, mask, full-screen view) loads only when a photo is chosen, so the editor bundle stays small.
const VisualizerView=lazy(()=>import('./VisualizerView').catch(()=>({default:LoadFailed})));

/**
 * D85 Room photo tool panel: what it does, the "preview only" note and the photo chooser. The chosen photo opens the
 * full-screen visualizer; closing it returns here with the drawing untouched (the visualizer never sees the store).
 */
export function RoomPhotoPanel({locale}:{locale:Locale}){
 const [file,setFile]=useState<File|null>(null),[problem,setProblem]=useState<PhotoProblem|null>(null),input=useRef<HTMLInputElement>(null),button=useRef<HTMLButtonElement>(null);
 const choose=(chosen:File|undefined)=>{
  if(input.current)input.current.value='';if(!chosen)return;
  const bad=checkPhotoFile(chosen);setProblem(bad);setFile(bad?null:chosen);
 };
 const close=(failed?:PhotoProblem)=>{setFile(null);setProblem(failed??null);queueMicrotask(()=>button.current?.focus({preventScroll:true}));};
 return <div className="room-photo-panel">
  <p>{message(locale,'vizIntro')}</p>
  <p className="viz-note">{message(locale,'vizPreviewNote')}</p>
  <button ref={button} className="primary-button" onClick={()=>input.current?.click()}>{message(locale,'vizChoose')}</button>
  <input ref={input} className="viz-file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={event=>choose(event.target.files?.[0])}/>
  {problem&&<p role="alert">{message(locale,`vizPhoto_${problem}`)}</p>}
  {file&&<Suspense fallback={<p role="status">{message(locale,'vizLoading')}</p>}><VisualizerView key={`${file.name}:${file.size}:${file.lastModified}`} file={file} locale={locale} onClose={close}/></Suspense>}
 </div>;
}
