/**
 * D85 Room photo: kept results ("Tile A", "Tile B") for comparison, at most MAX_VARIANTS. Each keeps only a compressed
 * image (a few hundred KB), not raw pixels, so four variants stay cheap on a budget phone. Visualizer memory only.
 */
export const MAX_VARIANTS=4,MAX_VARIANT_LABEL=24;
export interface Variant {readonly id:string;readonly label:string;readonly blob:Blob;readonly url:string}

/** A short label: trimmed, single-spaced, at most 24 characters; empty falls back to the given default. */
export function variantLabel(raw:string,fallback:string):string{
 const clean=raw.replace(/\s+/g,' ').trim().slice(0,MAX_VARIANT_LABEL).trim();
 return clean||fallback;
}
/** The default label for the next variant: "Option A", "Option B"…, skipping letters already in use. */
export function nextLetter(list:readonly Pick<Variant,'label'>[],word:string):string{
 for(const letter of 'ABCDEFGH'){const label=`${word} ${letter}`;if(!list.some(v=>v.label===label))return label;}
 return `${word} ${list.length+1}`;
}
/** The list with v added at the end, or undefined when the list is full (the caller asks to delete one first). */
export function addVariant<T extends Pick<Variant,'id'>>(list:readonly T[],v:T):T[]|undefined{
 if(list.length>=MAX_VARIANTS||list.some(x=>x.id===v.id))return undefined;
 return [...list,v];
}
