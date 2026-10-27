import {describe,expect,it} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {decodeMask,encodeMask} from './mask';
import {isRoomSession,MAX_SESSIONS,MemorySessionPort,openRoomSessions,RoomSessions,SessionError,sessionsToEvict} from './room-sessions';
import type {RoomSession,SessionPort} from './room-sessions';

// D87 Claude-authored builder tests: the session store over an in-memory port and over fake-indexeddb (real
// IndexedDB transaction rules). Bytes are made up so equality is checked byte for byte.
const bytes=(seed:number,n:number)=>Uint8Array.from({length:n},(_,i)=>(seed*31+i*7)&255);
function session(id:string,savedAt:number,options=1):RoomSession{
 const mask=new Uint8Array(12*8);mask.fill(255,10,30);mask[31]=90;
 return {id,savedAt,width:12,height:8,photo:bytes(savedAt,300),mask:encodeMask(mask),plane:[[1,1],[10,1],[10,7],[1,7]],
  options:Array.from({length:options},(_,i)=>({id:`${id}-o${i}`,label:`Option ${'ABCD'[i]}`,jpeg:bytes(savedAt+i,50+i)}))};
}
const copy=(s:RoomSession)=>structuredClone(s);

describe('D87 room photo sessions',()=>{
 it('evicts the oldest beyond the limit, never the one just saved',()=>{
  const list=Array.from({length:12},(_,i)=>({id:`s${i}`,savedAt:1000+i}));
  // Newest first: s11 … s0; keep 10 → remove s1 and s0.
  expect(sessionsToEvict(list,'s11')).toEqual(['s1','s0']);
  // Re-saving an old session (now newest in time) keeps it even when its record says otherwise.
  expect(sessionsToEvict(list,'s0')).toEqual(['s2','s1']);
  expect(sessionsToEvict(list.slice(0,3),'s2')).toEqual([]);
  expect(sessionsToEvict(list,'s5',1)).toEqual(['s11','s10','s9','s8','s7','s6','s4','s3','s2','s1','s0']);
 });
 for(const [name,make] of [['memory',async()=>new RoomSessions(new MemorySessionPort())],['IndexedDB (fake)',async()=>(await openRoomSessions(new IDBFactory()))!]] as const){
  it(`${name}: save, list newest first, reopen byte for byte, delete one and all`,async()=>{
   const store=await make(),a=session('a',1000,2),b=session('b',2000,4);
   await store.save(a,bytes(1,20));await store.save(b,bytes(2,24));
   const list=await store.list();
   expect(list.map(s=>[s.id,s.savedAt,s.options])).toEqual([['b',2000,4],['a',1000,2]]);
   expect(list[0]!.thumb).toEqual(bytes(2,24));
   const back=await store.open('a');
   expect(back).toEqual(a);expect(back.photo).toEqual(a.photo);expect(back.options.map(o=>o.jpeg)).toEqual(a.options.map(o=>o.jpeg));
   expect(decodeMask(back.mask,12*8)).toEqual(decodeMask(a.mask,12*8));
   // Replacing a session keeps one record, with the new options.
   const a2={...copy(a),savedAt:3000,options:[...a.options,{id:'a-o9',label:'Tile',jpeg:bytes(9,9)}]};
   await store.save(a2,bytes(3,8));
   expect((await store.list()).map(s=>[s.id,s.options])).toEqual([['a',3],['b',4]]);
   expect((await store.open('a')).options.map(o=>o.label)).toEqual(['Option A','Option B','Tile']);
   await store.remove('a');expect((await store.list()).map(s=>s.id)).toEqual(['b']);
   await expect(store.open('a')).rejects.toMatchObject({code:'missing'});
   await store.removeAll();expect(await store.list()).toEqual([]);
  });
  it(`${name}: keeps at most ${MAX_SESSIONS}; the eleventh removes the oldest`,async()=>{
   const store=await make();
   for(let i=0;i<11;i++)await store.save(session(`s${i}`,100+i),bytes(i,4));
   const ids=(await store.list()).map(s=>s.id);
   expect(ids).toHaveLength(MAX_SESSIONS);expect(ids[0]).toBe('s10');expect(ids).not.toContain('s0');
   await expect(store.open('s0')).rejects.toMatchObject({code:'missing'});
   expect((await store.open('s1')).id).toBe('s1');
  });
 }
 it('refuses to save or open a damaged record',async()=>{
  const port=new MemorySessionPort(),store=new RoomSessions(port);
  await expect(store.save({...session('x',1),options:Array.from({length:5},(_,i)=>({id:`${i}`,label:'',jpeg:bytes(i,3)}))},bytes(0,1))).rejects.toMatchObject({code:'damaged'});
  port.sessions.set('y',{...session('y',1),photo:'not bytes'} as unknown as RoomSession);
  await expect(store.open('y')).rejects.toMatchObject({code:'damaged'});
  port.sessions.set('z',session('other',1));
  await expect(store.open('z')).rejects.toMatchObject({code:'damaged'});
  expect(isRoomSession(session('ok',1))).toBe(true);expect(isRoomSession(null)).toBe(false);expect(isRoomSession({...session('p',1),plane:[[1,1]]})).toBe(false);
 });
 it('a full device answers "quota" and keeps the earlier sessions',async()=>{
  const inner=new MemorySessionPort(),full:SessionPort={...inner,summaries:()=>inner.summaries(),get:id=>inner.get(id),delete:ids=>inner.delete(ids),clear:()=>inner.clear(),
   put:async()=>{throw new DOMException('The quota has been exceeded.','QuotaExceededError');}};
  await inner.put(session('old',1),{id:'old',savedAt:1,options:1,thumb:bytes(0,2)});
  const store=new RoomSessions(full);
  const error=await store.save(session('new',2),bytes(0,2)).catch(e=>e as unknown);
  expect(error).toBeInstanceOf(SessionError);expect((error as SessionError).code).toBe('quota');
  expect((await store.list()).map(s=>s.id)).toEqual(['old']);
  const broken=new RoomSessions({...full,put:async()=>{throw new Error('disk');}});
  await expect(broken.save(session('n',3),bytes(0,1))).rejects.toMatchObject({code:'failed'});
 });
 it('IndexedDB: a quota abort inside the transaction is reported as "quota"',async()=>{
  const store=(await openRoomSessions(new IDBFactory()))!,port=(store as unknown as {port:{db:IDBDatabase}}).port;
  const original=port.db.transaction.bind(port.db);
  port.db.transaction=((...args:Parameters<IDBDatabase['transaction']>)=>{const tx=original(...args);if(args[1]==='readwrite')queueMicrotask(()=>{Object.defineProperty(tx,'error',{value:new DOMException('full','QuotaExceededError')});tx.abort();});return tx;}) as IDBDatabase['transaction'];
  await expect(store.save(session('q',1),bytes(0,1))).rejects.toMatchObject({code:'quota'});
  port.db.transaction=original;expect(await store.list()).toEqual([]);
 });
 it('no IndexedDB, or one that refuses to open, hides the feature (null), never throws',async()=>{
  expect(await openRoomSessions(undefined)).toBeNull();
  const refusing={open:()=>{throw new DOMException('denied','SecurityError');}} as unknown as IDBFactory;
  expect(await openRoomSessions(refusing)).toBeNull();
  const failing={open:()=>{const r={} as IDBOpenDBRequest;queueMicrotask(()=>r.onerror?.(new Event('error')));return r;}} as unknown as IDBFactory;
  expect(await openRoomSessions(failing)).toBeNull();
 });
});
