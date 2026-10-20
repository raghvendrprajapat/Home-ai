import type {ProjectDoc} from '@gharplan/core-model';

/** D76: the default 3D overview cuts walls down so furniture against the near walls stays visible. */
export const LOW_WALL_MM=1000;
/**
 * The drawing as the 3D overview shows it with low walls: walls at most `heightMm` high; a door or window keeps its
 * gap up to the new top, and a window whose sill is within 150 mm of the top (or above it) closes. Roofs, which sit on
 * the full walls, are left out. Render-only: the saved drawing never changes.
 */
export function lowerWalls(document:ProjectDoc,heightMm:number):ProjectDoc{
 const walls=document.walls.map(w=>w.height>heightMm?{...w,height:heightMm}:w),height=new Map(walls.map(w=>[w.id,w.height]));
 const openings=document.openings.flatMap(o=>{const top=height.get(o.wallId)??heightMm;if(o.sill>=top-150)return [];return [o.sill+o.height>top?{...o,height:top-o.sill}:o];});
 const lowered:ProjectDoc={...document,walls,openings};delete lowered.roofs;return lowered;
}
/**
 * D77: in the low-wall overview a raised piece (elevation above its floor) whose middle is above the cut hangs on wall
 * that is not drawn, such as a picture, a wall cabinet or window-length curtains, so it is left out instead of floating.
 * Floor-standing pieces (a wardrobe, floor-length curtains) and things standing on furniture (a table lamp on a bedside
 * table) stay. Render-only, like the lowered walls.
 */
export function hungAboveCut(item:Pick<ProjectDoc['furniture'][number],'elevation'|'size'>,heightMm:number|undefined):boolean{
 return heightMm!==undefined&&item.elevation>0&&item.elevation+item.size.h/2>heightMm;
}
