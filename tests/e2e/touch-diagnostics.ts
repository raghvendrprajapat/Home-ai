import type {Page,TestInfo} from '@playwright/test';
/** Failure-only evidence; no changes to gestures, input, expectations or deadlines. */
export async function installTouchDiagnostics(page:Page):Promise<void>{
 await page.addInitScript(()=>{
  const events:Record<string,unknown>[]=[],timers=new Set<number>();Object.assign(window,{touchDiagnostics:events});
  const record=(type:string,extra:Record<string,unknown>={})=>{const canvas=document.querySelector('[data-testid=plan-canvas]') as HTMLElement|null;
   events.push({type,at:performance.now(),scrollY,view:canvas?{x:canvas.dataset.viewX,y:canvas.dataset.viewY,scale:canvas.dataset.viewScale,picked:canvas.dataset.pickedKind,id:canvas.dataset.pickedId}:null,loupe:!!document.querySelector('[data-testid=touch-loupe]'),...extra});if(events.length>80)events.shift();
  };
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','scroll','blur'])window.addEventListener(type,event=>{const pointer=event instanceof PointerEvent?event:null;record(type,{timestamp:event.timeStamp,pointerId:pointer?.pointerId,x:pointer?.clientX,y:pointer?.clientY,target:(event.target as HTMLElement)?.className,inCanvas:event.target instanceof Element&&!!event.target.closest('[data-testid=plan-canvas]')});},true);
  const browser=window as unknown as {setTimeout(handler:TimerHandler,delay?:number,...args:unknown[]):number;clearTimeout(id?:number):void};
  const schedule=browser.setTimeout.bind(window),clear=browser.clearTimeout.bind(window);
  browser.setTimeout=(handler:TimerHandler,delay?:number,...args:unknown[]):number=>{
   if(delay!==151||typeof handler!=='function')return schedule(handler,delay,...args);
   const id=schedule(()=>{timers.delete(id);record('hold-fired',{timerId:id});Reflect.apply(handler,window,args);},delay);timers.add(id);record('hold-scheduled',{timerId:id});return id;
  };
  browser.clearTimeout=(id?:number)=>{if(id!==undefined&&timers.delete(id))record('hold-cleared',{timerId:id});clear(id);};
 });
}
export async function reportTouchFailure(page:Page,info:TestInfo):Promise<void>{
 if(info.status===info.expectedStatus)return;
 const events=await page.evaluate(()=>(window as unknown as {touchDiagnostics?:unknown[]}).touchDiagnostics??[]);
 const tail=(events as Record<string,unknown>[]).slice(-10).map(e=>({t:e.type,ms:Math.round(Number(e.at)),sy:e.scrollY,l:e.loupe,id:e.pointerId,p:e.x===undefined?undefined:[e.x,e.y],v:e.view,canvas:e.inCanvas,timer:e.timerId}));
 const detail='\nTouch event/timer tail10:\n'+JSON.stringify(tail);
 // GitHub annotations include the existing error stack; append evidence while
 // preserving its assertion, stack, expected outcome, timeout and failed status.
 const error=info.errors[0];if(error){error.message=(error.message??'')+detail;if(error.stack)error.stack+=detail;}
 await info.attach('touch-events.json',{body:JSON.stringify(events,null,2),contentType:'application/json'});
}
