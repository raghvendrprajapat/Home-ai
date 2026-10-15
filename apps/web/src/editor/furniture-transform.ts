import type {Command,ProjectStore} from '@gharplan/core-model';
import {parseLength,formatLength} from './measurements';
type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
export interface FurnitureDraft {x:string;y:string;elevation:string;rotation:string;scale:string}
export function coordinateLabel(mm:number,units:'metric'|'imperial'):string{return (mm<0?'-':'')+formatLength(Math.abs(mm),units);}
export function furnitureDraft(snapshot:Snapshot,id:string):FurnitureDraft{
 const item=snapshot.document.furniture.find(f=>f.id===id);if(!item)throw Error('furniture-selection');return {x:coordinateLabel(item.position.x,snapshot.document.units),y:coordinateLabel(item.position.y,snapshot.document.units),elevation:formatLength(item.elevation,snapshot.document.units),rotation:String(item.rotationDeg),scale:'1'};
}
export function furnitureCommand(snapshot:Snapshot,id:string,draft:FurnitureDraft):Command{
 const item=snapshot.document.furniture.find(f=>f.id===id);if(!item)throw Error('furniture-selection');
 const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
 if(draft.rotation.length>80||draft.scale.length>16||!decimal.test(draft.rotation.trim())||!/^\+?(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(draft.scale.trim()))throw Error('furniture-number');
 const rotation=Number(draft.rotation),scale=Number(draft.scale);if(!Number.isFinite(rotation)||Math.abs(rotation)>36000||!Number.isFinite(scale)||scale<=0||scale>100)throw Error('furniture-number');
 const elevation=parseLength(draft.elevation,{coordinate:true,maximum:6000});if(elevation<0)throw Error('furniture-number');
 const [whole,fraction='']=draft.scale.trim().replace(/^\+/,'').split('.'),denominator=10n**BigInt(fraction.length),numerator=BigInt((whole||'0')+fraction);
 const scaled=(mm:number)=>Number((BigInt(mm)*numerator*2n+denominator)/(denominator*2n));
 const size={w:scaled(item.size.w),d:scaled(item.size.d),h:scaled(item.size.h)};
 const position={x:parseLength(draft.x,{coordinate:true}),y:parseLength(draft.y,{coordinate:true})},rotationDeg=((rotation%360)+360)%360;
 const properties:Extract<Command,{type:'UpdateFurniture'}>['properties']={};
 if(position.x!==item.position.x||position.y!==item.position.y)properties.position=position;
 if(elevation!==item.elevation)properties.elevation=elevation;
 if(rotationDeg!==item.rotationDeg)properties.rotationDeg=rotationDeg;
 if(size.w!==item.size.w||size.d!==item.size.d||size.h!==item.size.h)properties.size=size;
 return {id:`furniture_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:snapshot.localGeneration,type:'UpdateFurniture',furnitureId:id,properties};
}
