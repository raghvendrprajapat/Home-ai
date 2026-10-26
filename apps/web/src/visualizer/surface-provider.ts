import {prepareSurface} from './surface-engine';
import type {SurfaceEditRequest} from './surface-engine';
import type {Pixels} from './photo-prep';

/**
 * D85 Room photo provider boundary. Phase 1 ships only the offline 'stand-in' engine below. Phase 2 (gated on the
 * owner's AI budget, provider, free credits and privacy-policy permission) may add a 'server' provider that sends the
 * request to the app's own server, which holds the AI key; its answer would still be composited locally inside the
 * same mask, so pixels outside the chosen area stay the person's own.
 */
export interface SurfaceEditResult extends Pixels {
 /** Pixels whose colour changed. */
 readonly changed:number;
 /** Wall-clock render time in ms (yielding to the UI included). */
 readonly ms:number;
}
export interface SurfaceEditProvider {
 /** 'stand-in' runs offline on the device; 'server' is reserved for the Phase 2 server provider (not built). */
 readonly kind:'stand-in'|'server';
 render(request:SurfaceEditRequest,signal:AbortSignal):Promise<SurfaceEditResult>;
}
/** Rows are rendered in slices of about this many ms, then the UI gets a turn, so a phone never freezes. */
export const SLICE_MS=12;
const yieldToUi=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const aborted=()=>new DOMException('Room photo preview cancelled.','AbortError');

export const standInSurface:SurfaceEditProvider={kind:'stand-in',async render(request,signal){
 const started=performance.now(),job=prepareSurface(request),out=new Uint8ClampedArray(request.photo.data);
 let changed=0;
 if(job.box){
  let y=job.box.y0,rows=8;
  while(y<job.box.y1){
   if(signal.aborted)throw aborted();
   const t0=performance.now();changed+=job.renderRows(out,y,y+rows);y+=rows;
   // Adapt the slice to the device: aim for SLICE_MS of work between UI turns.
   const spent=performance.now()-t0;rows=Math.max(1,Math.min(256,Math.round(rows*SLICE_MS/Math.max(.5,spent))));
   if(y<job.box.y1)await yieldToUi();
  }
 }
 if(signal.aborted)throw aborted();
 return {width:request.photo.width,height:request.photo.height,data:out,changed,ms:performance.now()-started};
}};
