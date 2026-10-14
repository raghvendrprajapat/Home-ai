import { ProjectStore } from '@gharplan/core-model';
import type { AsyncTag, ProjectDoc } from '@gharplan/core-model';
import type { BuildReply, BuildRequest, SceneBundle } from './types';

export interface MeshWorker {
  onmessage: ((event: MessageEvent<BuildReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: BuildRequest): void;
  terminate(): void;
}
function sameTag(a:AsyncTag,b:AsyncTag):boolean{return a.projectId===b.projectId&&a.sessionId===b.sessionId&&a.localGeneration===b.localGeneration&&a.dependencyHash===b.dependencyHash;}
/** One owned request/deadline at a time; intermediate snapshots are coalesced. */
export class ScenePipeline {
  #active: {requestId:number;tag:AsyncTag}|null=null; #nextId=0; #disposed=false;
  #unsubscribe:()=>void=()=>{}; #timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private store:ProjectStore,private worker:MeshWorker,private callbacks:{
    pending:()=>void;ready:(bundle:SceneBundle)=>void;failed:(message:string)=>void;
  }){
    worker.onmessage=event=>{
      if(this.#disposed||!this.#active||event.data.requestId!==this.#active.requestId)return;
      const captured=this.#active.tag;clearTimeout(this.#timer);this.#active=null;
      if(!sameTag(event.data.tag,captured)||!this.store.acceptsAsync(event.data.tag)){this.#request();return;}
      if(event.data.ok)callbacks.ready(event.data.bundle);else this.#fail(event.data.message);
    };
    worker.onerror=event=>{if(!this.#disposed)this.#fail(`3D preview failed: ${event.message}`);};
    this.#unsubscribe=store.subscribe(()=>{callbacks.pending();this.#request();});
    callbacks.pending();this.#request();
  }
  #fail(message:string):void{this.dispose();this.callbacks.failed(message);}
  #request():void{
    if(this.#active||this.#disposed)return;
    const requestId=++this.#nextId,tag=this.store.asyncTag();this.#active={requestId,tag};
    this.#timer=setTimeout(()=>{if(!this.#disposed)this.#fail('3D preview timed out. Your drawing is safe in this session. Switch to 2D, then retry 3D.');},10_000);
    try{this.worker.postMessage({requestId,tag,document:structuredClone(this.store.getSnapshot().document) as ProjectDoc});}
    catch(error){this.#fail(error instanceof Error?error.message:'Could not start the 3D preview.');}
  }
  dispose():void{
    if(this.#disposed)return;this.#disposed=true;clearTimeout(this.#timer);this.#active=null;
    this.#unsubscribe();this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate();
  }
}
