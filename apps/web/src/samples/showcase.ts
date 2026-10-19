import fixture from '../../../../docs/examples/sample-project.json';

/**
 * D76 R3: the sample a new person sees first, furnished with real catalog models and facing the right way. Walls,
 * rooms, openings and materials are exactly the accepted fixture (docs/examples/sample-project.json, unchanged); only
 * the furniture differs. Positions are hand-placed clear of both door swings and on the room floors:
 * living interior x 115–4385, y 115–4885 (main door x 2500–3500 on the south wall); bedroom x 4615–7885 (its door
 * y 550–1450 on the partition, window y 1900–3100 on the east wall). Rotation 0 faces north; backs go to the walls.
 */
type Item=[id:string,assetId:string,version:number,x:number,y:number,rotationDeg:number,w:number,d:number,h:number];
export const SHOWCASE_FURNITURE:readonly Item[]=[
 ['fu_tv','a_l0_tv_unit',1,1300,320,180,1800,400,440],
 ['fu_sofa','a_l0_sofa_3',2,1300,4420,0,2100,860,820],
 ['fu_coffee','a_l0_coffee_table',3,1300,3250,0,1100,600,450],
 ['fu_armchair','a_l0_armchair',2,3300,2900,270,800,820,820],
 ['fu_plant','a_l0_planter',2,4100,2150,0,450,420,1100],
 ['fu_bed','a_l0_king_bed',2,6500,1215,180,1900,2150,1100],
 ['fu_nightstand','a_l0_nightstand',1,5295,340,180,450,400,520],
 ['fu_wardrobe','a_l0_wardrobe_sliding',1,6250,4530,0,1800,650,2100],
 ['fu_plant_bed','a_l0_planter',2,7650,4600,0,450,420,1100],
];
/** A fresh copy of the furnished first-run sample (callers parse and validate it as before). */
export function showcaseSample():unknown{
 const document=structuredClone(fixture) as unknown as {furniture:unknown[]};
 document.furniture=SHOWCASE_FURNITURE.map(([id,assetId,assetVersion,x,y,rotationDeg,w,d,h])=>({id,floorId:'f0',assetId,assetVersion,position:{x,y},elevation:0,rotationDeg,size:{w,d,h},materialOverrides:{},rev:0}));
 return document;
}
/**
 * Browser tests built in e2e mode may ask for the unfurnished fixture by setting the storage key `gharplan-e2e-sample`
 * before the page loads: tests written against its exact furniture keep their hand-derived assertions. Production
 * builds ignore the key.
 */
function e2eFixture():boolean{try{return localStorage.getItem('gharplan-e2e-sample')==='fixture';}catch{return false;}}
export function firstRunSample():unknown{
 if(import.meta.env.MODE==='e2e'&&e2eFixture())return structuredClone(fixture);
 return showcaseSample();
}
