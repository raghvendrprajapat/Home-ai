import type {MaterialDef,ProjectStore} from '@gharplan/core-model';
import type {Locale} from '../i18n/messages';
type Document=ReturnType<ProjectStore['getSnapshot']>['document'];
/** Original solid-colour defaults. No downloaded/proprietary texture assets. */
export const surfaceLibrary:readonly {material:MaterialDef;hi:string}[]=[
 {material:{id:'m_ext',name:'Exterior plaster',baseColor:'#d9d2c5',roughness:.9,metalness:0},hi:'बाहरी प्लास्टर'},
 {material:{id:'m_paint_white',name:'Paint - white',baseColor:'#f4f4f2',roughness:.8,metalness:0},hi:'सफ़ेद रंग'},
 {material:{id:'m_paint_blue',name:'Paint - sky blue',baseColor:'#bcd7ea',roughness:.8,metalness:0},hi:'आसमानी रंग'},
 {material:{id:'m_tile_vitrified',name:'Vitrified tile 600x600',baseColor:'#e8e3da',uvScaleMm:600,roughness:.3,metalness:0},hi:'हल्का टाइल रंग'},
 {material:{id:'m_wood_laminate',name:'Wood laminate',baseColor:'#a07850',uvScaleMm:1200,roughness:.6,metalness:0},hi:'लकड़ी का रंग'},
];
export function surfacePalette(document:Document):readonly MaterialDef[]{return [...document.materials,...surfaceLibrary.filter(e=>!document.materials.some(m=>m.id===e.material.id)).map(e=>e.material)];}
export function surfaceMaterialName(material:MaterialDef,locale:Locale):string{const known=surfaceLibrary.find(e=>e.material.id===material.id&&e.material.name===material.name);return locale==='hi'&&known?known.hi:material.name;}
