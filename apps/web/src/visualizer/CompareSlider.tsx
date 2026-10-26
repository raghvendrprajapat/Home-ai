import {useRef,useState} from 'react';
import type {CSSProperties,KeyboardEvent,PointerEvent,ReactNode} from 'react';

/** D85: divider position (0–100 %) from a pointer x over the frame. */
export function sliderFromPointer(clientX:number,rect:{readonly left:number;readonly width:number}):number{
 return Math.round(Math.max(0,Math.min(100,(clientX-rect.left)/Math.max(1e-9,rect.width)*100)));
}
/** Keyboard steps of the divider: arrows 2 %, Page Up/Down 10 %, Home/End to the ends; undefined for other keys. */
export function sliderKey(value:number,key:string):number|undefined{
 const step={ArrowLeft:-2,ArrowDown:-2,ArrowRight:2,ArrowUp:2,PageDown:-10,PageUp:10} as Record<string,number>;
 if(key==='Home')return 0;if(key==='End')return 100;
 return key in step?Math.max(0,Math.min(100,value+step[key]!)):undefined;
}
/**
 * D85 before/after (or option A/B) comparison. Both layers fill the same frame; the right-hand layer shows to the right
 * of the divider. The divider is a keyboard slider (role slider, 0–100) and follows a drag anywhere on the frame.
 */
export function CompareSlider({left,right,leftLabel,rightLabel,label,style,testId}:{left:ReactNode;right:ReactNode;leftLabel:string;rightLabel:string;label:string;style?:CSSProperties;testId?:string}){
 const [value,setValue]=useState(50),frame=useRef<HTMLDivElement>(null),drag=useRef<number|null>(null);
 const move=(event:PointerEvent<HTMLDivElement>)=>{if(drag.current!==event.pointerId)return;setValue(sliderFromPointer(event.clientX,event.currentTarget.getBoundingClientRect()));};
 const key=(event:KeyboardEvent<HTMLDivElement>)=>{const next=sliderKey(value,event.key);if(next===undefined)return;event.preventDefault();setValue(next);};
 return <div ref={frame} className="viz-compare" style={style} data-testid={testId} data-split={value}
  onPointerDown={event=>{drag.current=event.pointerId;event.currentTarget.setPointerCapture?.(event.pointerId);setValue(sliderFromPointer(event.clientX,event.currentTarget.getBoundingClientRect()));}}
  onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
  <div className="viz-layer">{left}</div>
  <div className="viz-layer" style={{clipPath:`inset(0 0 0 ${value}%)`}}>{right}</div>
  <span className="viz-tag viz-tag-left" aria-hidden="true">{leftLabel}</span><span className="viz-tag viz-tag-right" aria-hidden="true">{rightLabel}</span>
  <div className="viz-divider" style={{left:`${value}%`}} role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`${value}%`} onKeyDown={key}><span className="viz-knob" aria-hidden="true"/></div>
 </div>;
}
