/** A loss episode ends only after drawing the latest canonical generation. */
export class ContextRecovery {
  #timer: ReturnType<typeof setTimeout>|undefined;
  #closed=false;
  #active=false;
  #deadline=0;
  constructor(private fallback:()=>void,private deadlineMs=3000,private now:()=>number=()=>performance.now()){}
  get active():boolean{return this.#active;}
  lost():void{
    if(this.#closed||this.#active)return;
    this.#active=true;this.#deadline=this.now()+this.deadlineMs;
    this.#timer=setTimeout(()=>this.#expire(),this.deadlineMs);
  }
  #expire():void{if(this.#closed||!this.#active)return;this.#closed=true;this.#active=false;clearTimeout(this.#timer);this.#timer=undefined;this.fallback();}
  drawn(generation:number,currentGeneration:number):boolean{
    if(this.#closed||generation!==currentGeneration)return false;
    if(this.#active&&this.now()>this.#deadline){this.#expire();return false;}
    clearTimeout(this.#timer);this.#timer=undefined;this.#active=false;return true;
  }
  close():void{if(this.#closed)return;this.#closed=true;clearTimeout(this.#timer);this.#timer=undefined;this.#active=false;}
}
