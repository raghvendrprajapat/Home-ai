import { useSyncExternalStore } from 'react';

/** D76 M2: phone layout (tool bar at the bottom, panels as sheets) below 760 px, matching app.css. */
const QUERY='(max-width: 760px)';
const subscribe=(listener:()=>void)=>{const list=globalThis.matchMedia?.(QUERY);list?.addEventListener('change',listener);return ()=>list?.removeEventListener('change',listener);};
export function useNarrow():boolean{return useSyncExternalStore(subscribe,()=>globalThis.matchMedia?.(QUERY).matches??false,()=>false);}
