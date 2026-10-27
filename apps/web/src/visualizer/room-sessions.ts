import type {Quad} from './homography';

/**
 * D87 Room photo sessions kept on this device (never uploaded, never part of the project). When the person keeps an
 * option, the visualizer saves its session: the prepared photo as JPEG, the chosen area (run-length mask, see
 * `encodeMask`), the four-corner plane and up to four kept options (JPEG) with their labels. At most MAX_SESSIONS are
 * kept; saving an eleventh removes the oldest. Sessions live in their own IndexedDB database, separate from drawings,
 * with a small summary record per session so the "Recent room photos" list never loads the photos themselves.
 */
export const MAX_SESSIONS=10,MAX_SESSION_OPTIONS=4,DB_NAME='gharplan-room-photos';
export interface SavedOption {readonly id:string;readonly label:string;readonly jpeg:Uint8Array}
export interface RoomSession {
 readonly id:string;readonly savedAt:number;readonly width:number;readonly height:number;
 /** The working-size photo as JPEG bytes. */
 readonly photo:Uint8Array;
 /** The chosen area, run-length encoded (`encodeMask`). */
 readonly mask:Uint8Array;
 readonly plane:Quad|null;readonly options:readonly SavedOption[];
}
export interface RoomSessionSummary {readonly id:string;readonly savedAt:number;readonly options:number;readonly thumb:Uint8Array}
export type SessionProblem='quota'|'failed'|'damaged'|'missing';
export class SessionError extends Error {constructor(readonly code:SessionProblem){super(code);this.name='SessionError';}}

/** Where sessions are kept: IndexedDB in the app, an in-memory map in tests. */
export interface SessionPort {
 summaries():Promise<RoomSessionSummary[]>;
 get(id:string):Promise<unknown>;
 /** Writes the session and its summary together (both or neither). */
 put(session:RoomSession,summary:RoomSessionSummary):Promise<void>;
 delete(ids:readonly string[]):Promise<void>;
 clear():Promise<void>;
}

const isBytes=(v:unknown):v is Uint8Array=>v instanceof Uint8Array;
const isPoint=(v:unknown)=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&Number.isFinite(n));
/** True for a session record as written by `save` (a damaged or foreign record is refused, never half-opened). */
export function isRoomSession(v:unknown):v is RoomSession{
 if(!v||typeof v!=='object')return false;
 const s=v as Record<string,unknown>;
 return typeof s.id==='string'&&typeof s.savedAt==='number'&&Number.isSafeInteger(s.width)&&Number.isSafeInteger(s.height)&&(s.width as number)>0&&(s.height as number)>0
  &&isBytes(s.photo)&&s.photo.length>0&&isBytes(s.mask)&&(s.plane===null||Array.isArray(s.plane)&&s.plane.length===4&&s.plane.every(isPoint))
  &&Array.isArray(s.options)&&s.options.length<=MAX_SESSION_OPTIONS&&s.options.every(o=>!!o&&typeof o==='object'&&typeof o.id==='string'&&typeof o.label==='string'&&isBytes(o.jpeg)&&o.jpeg.length>0);
}
/** The sessions to remove so that at most `max` stay: the oldest first, never the one just saved. */
export function sessionsToEvict(list:readonly Pick<RoomSessionSummary,'id'|'savedAt'>[],keep:string,max=MAX_SESSIONS):string[]{
 const newestFirst=[...list].sort((a,b)=>b.savedAt-a.savedAt||(a.id<b.id?-1:1)),others=newestFirst.filter(s=>s.id!==keep);
 return others.slice(Math.max(0,max-(list.some(s=>s.id===keep)?1:0))).map(s=>s.id);
}
const quota=(e:unknown)=>!!e&&typeof e==='object'&&('name' in e&&e.name==='QuotaExceededError'||'code' in e&&e.code===22);
const problem=(e:unknown,fallback:SessionProblem)=>e instanceof SessionError?e:new SessionError(quota(e)?'quota':fallback);

export class RoomSessions {
 constructor(private readonly port:SessionPort,private readonly max=MAX_SESSIONS){}
 /** Newest first. */
 async list():Promise<RoomSessionSummary[]>{
  try{return (await this.port.summaries()).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){throw problem(e,'failed');}
 }
 /** Saves (or replaces) a session and removes the oldest beyond the limit. Throws SessionError 'quota' when full. */
 async save(session:RoomSession,thumb:Uint8Array):Promise<void>{
  if(!isRoomSession(session))throw new SessionError('damaged');
  try{await this.port.put(session,{id:session.id,savedAt:session.savedAt,options:session.options.length,thumb});}catch(e){throw problem(e,'failed');}
  try{const old=sessionsToEvict(await this.port.summaries(),session.id,this.max);if(old.length)await this.port.delete(old);}catch{/* the session is saved; an older one may stay until the next save */}
 }
 async open(id:string):Promise<RoomSession>{
  let found:unknown;try{found=await this.port.get(id);}catch(e){throw problem(e,'failed');}
  if(found===undefined||found===null)throw new SessionError('missing');
  if(!isRoomSession(found)||found.id!==id)throw new SessionError('damaged');
  return found;
 }
 async remove(id:string):Promise<void>{try{await this.port.delete([id]);}catch(e){throw problem(e,'failed');}}
 async removeAll():Promise<void>{try{await this.port.clear();}catch(e){throw problem(e,'failed');}}
}

/** An in-memory port for tests. Where IndexedDB is missing the app does not fall back to it: the feature hides. */
export class MemorySessionPort implements SessionPort {
 readonly sessions=new Map<string,RoomSession>();readonly summaryMap=new Map<string,RoomSessionSummary>();
 async summaries(){return [...this.summaryMap.values()];}
 async get(id:string){return this.sessions.get(id);}
 async put(session:RoomSession,summary:RoomSessionSummary){this.sessions.set(session.id,session);this.summaryMap.set(summary.id,summary);}
 async delete(ids:readonly string[]){for(const id of ids){this.sessions.delete(id);this.summaryMap.delete(id);}}
 async clear(){this.sessions.clear();this.summaryMap.clear();}
}

const STORES=['summaries','sessions'] as const;
/** IndexedDB port: database `gharplan-room-photos`, stores `summaries` and `sessions` (key `id`). */
export class IndexedSessionPort implements SessionPort {
 constructor(readonly db:IDBDatabase){db.onversionchange=()=>db.close();}
 private run<T>(mode:IDBTransactionMode,work:(tx:IDBTransaction,done:(value:T)=>void)=>void):Promise<T>{
  return new Promise((resolve,reject)=>{
   let tx:IDBTransaction,value:T;
   try{tx=this.db.transaction(STORES,mode);}catch(e){reject(e);return;}
   tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error??new SessionError('failed'));tx.onerror=()=>undefined;
   try{work(tx,v=>{value=v;});}catch(e){try{tx.abort();}catch{/* already finished */}reject(e);}
  });
 }
 summaries(){return this.run<RoomSessionSummary[]>('readonly',(tx,done)=>{const r=tx.objectStore('summaries').getAll();r.onsuccess=()=>done(r.result as RoomSessionSummary[]);});}
 get(id:string){return this.run<unknown>('readonly',(tx,done)=>{const r=tx.objectStore('sessions').get(id);r.onsuccess=()=>done(r.result);});}
 put(session:RoomSession,summary:RoomSessionSummary){return this.run<void>('readwrite',tx=>{tx.objectStore('sessions').put(session);tx.objectStore('summaries').put(summary);});}
 delete(ids:readonly string[]){return this.run<void>('readwrite',tx=>{for(const id of ids){tx.objectStore('sessions').delete(id);tx.objectStore('summaries').delete(id);}});}
 clear(){return this.run<void>('readwrite',tx=>{tx.objectStore('sessions').clear();tx.objectStore('summaries').clear();});}
}
/**
 * Opens the device store, or null when this browser cannot keep data (no IndexedDB, blocked, private mode that refuses
 * storage). The Recent list and auto-save then simply do not appear.
 */
export function openRoomSessions(factory:IDBFactory|undefined=globalThis.indexedDB,name=DB_NAME):Promise<RoomSessions|null>{
 return new Promise(resolve=>{
  let settled=false;const finish=(v:RoomSessions|null)=>{if(!settled){settled=true;resolve(v);}};
  try{
   if(!factory){finish(null);return;}
   const request=factory.open(name,1);
   request.onupgradeneeded=()=>{const db=request.result;for(const store of STORES)if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'});};
   request.onblocked=()=>finish(null);request.onerror=()=>finish(null);
   request.onsuccess=()=>{if(settled)request.result.close();else finish(new RoomSessions(new IndexedSessionPort(request.result)));};
  }catch{finish(null);}
 });
}
