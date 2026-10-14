export interface Disposable { dispose(): void }
export interface Lease<T extends Disposable> { readonly value: T; release(): void }
interface Entry { value: Disposable; references: number; disposed: boolean }
/** Releases own an entry, never a reusable key. Close invalidates all live leases. */
export class ResourcePool {
  #entries = new Map<string, Entry>();
  #closed = false;
  #created = 0;
  #disposed = 0;
  #disposalFailures=0;
  acquire<T extends Disposable>(key: string, factory: () => T): Lease<T> {
    if (this.#closed) throw new Error('resources-closed');
    let entry = this.#entries.get(key);
    if (!entry) {
      const value = factory(); // A failed factory must clean its partial allocation.
      entry = { value, references: 0, disposed: false };
      this.#entries.set(key, entry); this.#created++;
    }
    entry.references++;
    const owned = entry; let released = false;
    return { value: owned.value as T, release: () => {
      if (released) return; released = true;
      if (owned.disposed) return;
      if (--owned.references === 0) {
        if (this.#entries.get(key) === owned) this.#entries.delete(key);
        this.#dispose(owned);
      }
    } };
  }
  #dispose(entry: Entry): void {
    if (entry.disposed) return;
    entry.disposed=true;try{entry.value.dispose();this.#disposed++;}catch(error){this.#disposalFailures++;throw error;}
  }
  get stats(): {live:number;references:number;created:number;disposed:number;disposalFailures:number;closed:boolean} {
    return {live:this.#entries.size,references:[...this.#entries.values()].reduce((n,e)=>n+e.references,0),created:this.#created,disposed:this.#disposed,disposalFailures:this.#disposalFailures,closed:this.#closed};
  }
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    const entries = [...this.#entries.values()]; this.#entries.clear();
    let failure: unknown;
    for (const entry of entries) try { this.#dispose(entry); } catch (error) { failure ??= error; }
    if (failure) throw failure;
  }
}
/** Run independent cleanup steps once, even when an earlier disposer throws. */
export function releaseOnce(steps:readonly (()=>void)[]):()=>void {
  let released=false;
  return ()=>{if(released)return;released=true;let failure:unknown;
    for(const step of steps)try{step();}catch(error){failure??=error;}
    if(failure)throw failure;
  };
}
