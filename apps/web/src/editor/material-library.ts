import {FURNITURE_FINISH_SLOT} from '@gharplan/core-model';
import type {MaterialDef,ProjectStore} from '@gharplan/core-model';
import type {Locale} from '../i18n/messages';
type Document=ReturnType<ProjectStore['getSnapshot']>['document'];
/** Original solid-colour defaults (D76: the 3D view may add CC0 textures by name; the saved drawing keeps only these colours). */
export const surfaceLibrary:readonly {material:MaterialDef;hi:string}[]=[
 {material:{id:'m_ext',name:'Exterior plaster',baseColor:'#d9d2c5',roughness:.9,metalness:0},hi:'बाहरी प्लास्टर'},
 {material:{id:'m_paint_white',name:'Paint - white',baseColor:'#f4f4f2',roughness:.8,metalness:0},hi:'सफ़ेद रंग'},
 {material:{id:'m_paint_blue',name:'Paint - sky blue',baseColor:'#bcd7ea',roughness:.8,metalness:0},hi:'आसमानी रंग'},
 {material:{id:'m_paint_beige',name:'Paint - beige',baseColor:'#e6d5b8',roughness:.8,metalness:0},hi:'बेज रंग'},
 {material:{id:'m_paint_grey',name:'Paint - light grey',baseColor:'#d3d5d4',roughness:.8,metalness:0},hi:'हल्का स्लेटी रंग'},
 {material:{id:'m_paint_mint',name:'Paint - mint green',baseColor:'#cfe3d3',roughness:.8,metalness:0},hi:'हल्का हरा रंग'},
 {material:{id:'m_paint_peach',name:'Paint - peach',baseColor:'#f2d3bf',roughness:.8,metalness:0},hi:'पीच रंग'},
 {material:{id:'m_tile_vitrified',name:'Vitrified tile 600x600',baseColor:'#e8e3da',uvScaleMm:600,roughness:.3,metalness:0},hi:'हल्का टाइल रंग'},
 {material:{id:'m_wood_laminate',name:'Wood laminate',baseColor:'#a07850',uvScaleMm:1200,roughness:.6,metalness:0},hi:'लकड़ी का रंग'},
 {material:{id:'m_marble_white',name:'Marble - white',baseColor:'#ece9e3',uvScaleMm:1500,roughness:.25,metalness:0},hi:'सफ़ेद संगमरमर'},
];
export function surfacePalette(document:Document):readonly MaterialDef[]{return [...document.materials,...surfaceLibrary.filter(e=>!document.materials.some(m=>m.id===e.material.id)).map(e=>e.material)];}
export function surfaceMaterialName(material:MaterialDef,locale:Locale):string{const known=surfaceLibrary.find(e=>e.material.id===material.id&&e.material.name===material.name);return locale==='hi'&&known?known.hi:material.name;}
/** FR-022 original furniture finishes (solid colours only). They recolour a model's main material. */
export const furnitureFinishLibrary:readonly {material:MaterialDef;hi:string}[]=[
 {material:{id:'m_fin_teak',name:'Finish - teak',baseColor:'#9a6b43',roughness:.6,metalness:0},hi:'सागौन रंग'},
 {material:{id:'m_fin_walnut',name:'Finish - walnut',baseColor:'#5b3a29',roughness:.6,metalness:0},hi:'अखरोट रंग'},
 {material:{id:'m_fin_white',name:'Finish - white',baseColor:'#f2f0eb',roughness:.7,metalness:0},hi:'सफ़ेद'},
 {material:{id:'m_fin_charcoal',name:'Finish - charcoal',baseColor:'#3a3d40',roughness:.7,metalness:0},hi:'कोयला रंग'},
 {material:{id:'m_fin_sage',name:'Finish - sage green',baseColor:'#8a9a7b',roughness:.8,metalness:0},hi:'हल्का हरा'},
 {material:{id:'m_fin_navy',name:'Finish - navy',baseColor:'#2f3e5c',roughness:.8,metalness:0},hi:'गहरा नीला'},
 {material:{id:'m_fin_terracotta',name:'Finish - terracotta',baseColor:'#b5603f',roughness:.8,metalness:0},hi:'टेराकोटा'},
 {material:{id:'m_fin_mustard',name:'Finish - mustard',baseColor:'#c99a2e',roughness:.8,metalness:0},hi:'सरसों पीला'},
];
export function furnitureFinishName(material:MaterialDef,locale:Locale):string{const known=furnitureFinishLibrary.find(e=>e.material.id===material.id&&e.material.name===material.name);return locale==='hi'&&known?known.hi:material.name;}
type Item=Document['furniture'][number];
/** null = the model's own colours; a colour = the main-slot finish; undefined = an override the app cannot show. */
export function furnitureFinish(document:Document,item:Item):string|null|undefined{
 const keys=Object.keys(item.materialOverrides);if(!keys.length)return null;if(keys.length!==1||keys[0]!==FURNITURE_FINISH_SLOT)return undefined;
 return document.materials.find(m=>m.id===item.materialOverrides[FURNITURE_FINISH_SLOT])?.baseColor;
}
