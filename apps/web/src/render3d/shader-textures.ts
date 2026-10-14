import {Texture} from 'three';
import {ResourcePool,releaseOnce} from './resources';
import type {Lease} from './resources';
// Three r186 shares its DFG lookup texture across physically based materials.
// Capture its mutable uniform through public onBeforeCompile, then lease it per
// renderer. Disposing the last renderer releases the LUT's context listeners.
const shared=new ResourcePool();
export class ShaderTextures {
  #pending=new Set<{value:unknown}>();
  #leases=new Map<Texture,Lease<Texture>>();
  #closed=false;
  observe(uniforms:Record<string,{value:unknown}>):void{
    if(!this.#closed&&uniforms.dfgLUT)this.#pending.add(uniforms.dfgLUT);
  }
  sample():void{
    if(this.#closed)return;
    for(const uniform of this.#pending)if(uniform.value instanceof Texture){
      const texture=uniform.value;if(!this.#leases.has(texture))this.#leases.set(texture,shared.acquire(`dfg:${texture.uuid}`,()=>texture));this.#pending.delete(uniform);
    }
  }
  close():void{
    if(this.#closed)return;this.sample();this.#closed=true;
    try{releaseOnce([...this.#leases.values()].map(lease=>()=>lease.release()))();}finally{this.#leases.clear();this.#pending.clear();}
  }
}
