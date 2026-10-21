import fixture from '../../../../docs/examples/sample-project.json';
import {FURNITURE_FINISH_SLOT} from '@gharplan/core-model';
import {furnitureFinishLibrary} from '../editor/material-library';

/**
 * D76 R3: the sample a new person sees first, furnished with real catalog models and facing the right way. Walls,
 * rooms, openings and materials are exactly the accepted fixture (docs/examples/sample-project.json, unchanged); only
 * the furniture differs. Positions are hand-placed clear of both door swings and on the room floors:
 * living interior x 115–4385, y 115–4885 (main door x 2500–3500 on the south wall); bedroom x 4615–7885 (its door
 * y 550–1450 on the partition, window y 1900–3100 on the east wall). Rotation 0 faces north; backs go to the walls.
 * D77 decor: floor-length curtains at both windows (the living window x 1500–3000 is on the north wall, so the TV unit
 * stands just in front of its curtains), a floor lamp in the reading corner, a table lamp on the bedside table, two
 * framed pictures and leafy plants. Raised pieces carry an elevation (the optional last number): pictures have their
 * backs on the wall face and hang clear above what stands below; the lamp stands on the bedside table top.
 */
type Item=[id:string,assetId:string,version:number,x:number,y:number,rotationDeg:number,w:number,d:number,h:number,elevation?:number];
export const SHOWCASE_FURNITURE:readonly Item[]=[
 ['fu_tv','a_l0_tv_unit',1,1300,475,180,1800,400,440],
 ['fu_sofa','a_l0_sofa_3',3,1300,4420,0,2100,860,820],
 ['fu_coffee','a_l0_coffee_table',4,1300,3250,0,1100,600,450],
 ['fu_armchair','a_l0_armchair',3,3300,2900,270,800,820,820],
 ['fu_plant','a_l0_planter',3,4100,2150,0,450,420,1100],
 ['fu_rug','a_l0_rug',2,1300,3300,0,1600,1000,10],
 ['fu_bed','a_l0_king_bed',3,6500,1215,180,1900,2150,1100],
 ['fu_nightstand','a_l0_nightstand',1,5295,340,180,450,400,520],
 ['fu_wardrobe','a_l0_wardrobe_sliding',2,6250,4530,0,1800,650,2100],
 ['fu_plant_bed','a_l0_planter',3,7650,4600,0,450,420,1100],
 ['fu_plant_corner','a_l0_planter',3,4100,4600,0,450,420,1100],
 ['fu_floor_lamp','a_l0_floor_lamp',1,3350,2250,0,400,400,1600],
 ['fu_curtains_living','a_l0_curtains',1,2250,195,180,2100,160,2425],
 ['fu_art_living','a_l0_wall_art',1,135,2500,90,900,40,650,1300],
 ['fu_curtains_bed','a_l0_curtains',1,7805,2500,270,2100,160,2425],
 ['fu_table_lamp','a_l0_table_lamp',1,5295,340,180,260,260,450,520],
 ['fu_art_bed','a_l0_wall_art',1,6500,135,180,900,40,650,1250],
];
/** Calm natural finishes (the original FR-022 finish library): walnut wood and off-white instead of the models' bright defaults. */
export const SHOWCASE_FINISHES:Readonly<Record<string,string>>={fu_tv:'m_fin_walnut',fu_coffee:'m_fin_walnut',fu_nightstand:'m_fin_walnut',fu_armchair:'m_fin_white',fu_wardrobe:'m_fin_white'};
/** A fresh copy of the furnished first-run sample (callers parse and validate it as before). */
export function showcaseSample():unknown{
 const document=structuredClone(fixture) as unknown as {furniture:unknown[];materials:unknown[]};
 const finishes=[...new Set(Object.values(SHOWCASE_FINISHES))].map(id=>furnitureFinishLibrary.find(e=>e.material.id===id)!.material);
 document.materials=[...document.materials,...finishes.map(m=>({...m}))];
 document.furniture=SHOWCASE_FURNITURE.map(([id,assetId,assetVersion,x,y,rotationDeg,w,d,h,elevation=0])=>({id,floorId:'f0',assetId,assetVersion,position:{x,y},elevation,rotationDeg,size:{w,d,h},materialOverrides:SHOWCASE_FINISHES[id]?{[FURNITURE_FINISH_SLOT]:SHOWCASE_FINISHES[id]}:{},rev:0}));
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
