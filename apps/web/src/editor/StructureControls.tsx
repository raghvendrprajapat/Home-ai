import {useEffect,useState,useSyncExternalStore} from 'react';
import {floorOuterRect,stairRiser,stairTread} from '@gharplan/core-model';
import type {MaterialDef,ProjectStore,Roof,Stair} from '@gharplan/core-model';
import {editError,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
/** FR-035 (D66) original default finishes. Installed into the project with the first stair or roof that uses them. */
const STAIR_STONE:MaterialDef={id:'m_stair_stone',name:'Stair stone',baseColor:'#9a948a',roughness:0.9,metalness:0};
const ROOF_FINISH:Record<Roof['kind'],MaterialDef>={flat:{id:'m_roof_concrete',name:'Roof concrete',baseColor:'#b9b5ab',roughness:0.95,metalness:0},gable:{id:'m_roof_tiles',name:'Roof clay tiles',baseColor:'#a5543a',roughness:0.8,metalness:0}};
const DIRECTIONS=[[0,'directionNorth'],[90,'directionEast'],[180,'directionSouth'],[270,'directionWest']] as const;
type Run=(command:Record<string,unknown>)=>ReturnType<ProjectStore['execute']>;
type StairFields={x:string;y:string;rotationDeg:Stair['rotationDeg'];width:string;length:string;height:string;steps:string};
const fieldsOf=(s:Stair):StairFields=>({x:String(s.position.x),y:String(s.position.y),rotationDeg:s.rotationDeg,width:String(s.width),length:String(s.length),height:String(s.height),steps:String(s.steps)});
const fail=(locale:Locale,error?:{code:string;message:string})=>error?.code==='schema'||error?.code==='coordinates'||error?.code==='project'?message(locale,'structureInvalid'):editError(locale,error);

/** Stairs and roof of the active floor, edited through the whole-project store. Display stays in 2D/3D. */
export function StructureControls({store,activeFloorId,locale,onMessage}:{store:ProjectStore;activeFloorId:string;locale:Locale;onMessage(text:string):void}){
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot),doc=snapshot.document,floor=doc.floors.find(f=>f.id===activeFloorId);
 const stairs=(doc.stairs??[]).filter(s=>s.floorId===activeFloorId),roof=(doc.roofs??[]).find(r=>r.floorId===activeFloorId);
 const run:Run=command=>store.execute({id:`structure_${crypto.randomUUID().replaceAll('-','')}`,baseGeneration:store.getSnapshot().localGeneration,...command} as Parameters<ProjectStore['execute']>[0]);
 const add=()=>{
  if(!floor)return;
  // Climb to the floor above when there is one, else this floor's wall height; about 175 mm risers and 250 mm treads.
  const above=[...doc.floors].filter(f=>f.level>floor.level).sort((a,b)=>a.level-b.level)[0],height=Math.min(6000,Math.max(500,above?above.elevation-floor.elevation:floor.defaultWallHeight));
  const steps=Math.min(30,Math.max(2,Math.round(height/175))),length=Math.min(8000,Math.max(1000,steps*250)),outer=floorOuterRect(doc,floor.id);
  const centre=outer?{x:Math.round((outer[0]+outer[2])/2),y:Math.round((outer[1]+outer[3])/2)}:{x:0,y:0};
  const result=run({type:'AddStair',stair:{floorId:floor.id,position:centre,rotationDeg:0,width:900,length,height,steps},material:STAIR_STONE});
  onMessage(result.ok?message(locale,'stairsAdded'):fail(locale,result.errors[0]));
 };
 return <details className="structure-controls" data-stair-count={stairs.length} data-roof-kind={roof?.kind??'none'}><summary>{message(locale,'structureGroup')}</summary>
  <p className="structure-note">{message(locale,'structureDisclaimer')}</p>
  {stairs.map((stair,i)=><StairForm key={stair.id} stair={stair} number={i+1} run={run} locale={locale} onMessage={onMessage}/>)}
  <button type="button" disabled={!floor||(doc.stairs?.length??0)>=50} onClick={add}>{message(locale,'addStairs')}</button>
  {floor&&<RoofForm key={`${floor.id}:${roof?.rev??'none'}`} floorId={floor.id} roof={roof} run={run} locale={locale} onMessage={onMessage}/>}
 </details>;
}

function StairForm({stair,number,run,locale,onMessage}:{stair:Stair;number:number;run:Run;locale:Locale;onMessage(text:string):void}){
 const [fields,setFields]=useState(()=>fieldsOf(stair));
 useEffect(()=>setFields(fieldsOf(stair)),[stair]);
 const set=(key:keyof StairFields)=>(e:{target:{value:string}})=>setFields(f=>({...f,[key]:key==='rotationDeg'?Number(e.target.value) as Stair['rotationDeg']:e.target.value}));
 const apply=()=>{const result=run({type:'UpdateStair',stairId:stair.id,properties:{position:{x:Number(fields.x),y:Number(fields.y)},rotationDeg:fields.rotationDeg,width:Number(fields.width),length:Number(fields.length),height:Number(fields.height),steps:Number(fields.steps)}});onMessage(result.ok?message(locale,'stairsUpdated'):fail(locale,result.errors[0]));};
 const number_=(key:Exclude<keyof StairFields,'rotationDeg'>,label:'stairX'|'stairY'|'stairWidth'|'stairLength'|'stairHeight'|'stairSteps')=><label>{message(locale,label)}<input type="number" step={1} inputMode="numeric" value={fields[key]} onChange={set(key)}/></label>;
 return <fieldset className="stair-form" data-stair-id={stair.id}><legend>{message(locale,'stairsLabel',{number})}</legend>
  {number_('x','stairX')}{number_('y','stairY')}
  <label>{message(locale,'stairDirection')}<select value={fields.rotationDeg} onChange={set('rotationDeg')}>{DIRECTIONS.map(([deg,key])=><option key={deg} value={deg}>{message(locale,key)}</option>)}</select></label>
  {number_('width','stairWidth')}{number_('length','stairLength')}{number_('height','stairHeight')}{number_('steps','stairSteps')}
  <p className="structure-note" data-testid="stair-step-size">{message(locale,'stairStepSize',{riser:Math.round(stairRiser(stair)*10)/10,tread:Math.round(stairTread(stair)*10)/10})}</p>
  <button type="button" className="primary-button" onClick={apply}>{message(locale,'applyStairs')}</button>
  <button type="button" onClick={()=>{const result=run({type:'DeleteStair',stairId:stair.id});onMessage(result.ok?message(locale,'stairsDeleted'):fail(locale,result.errors[0]));}}>{message(locale,'deleteStairs')}</button>
 </fieldset>;
}

function RoofForm({floorId,roof,run,locale,onMessage}:{floorId:string;roof:Roof|undefined;run:Run;locale:Locale;onMessage(text:string):void}){
 const [kind,setKind]=useState<Roof['kind']|'none'>(roof?.kind??'none'),[pitch,setPitch]=useState(String(roof?.pitchDeg??25)),[overhang,setOverhang]=useState(String(roof?.overhang??300)),[ridge,setRidge]=useState<Roof['ridgeAxis']>(roof?.ridgeAxis??'x');
 const apply=()=>{
  if(kind==='none'){const result=run({type:'SetRoof',floorId,roof:null});onMessage(result.ok?message(locale,'roofRemoved'):fail(locale,result.errors[0]));return;}
  // A new roof, or a change between flat and sloped, brings that kind's default finish.
  const material=!roof||roof.kind!==kind?ROOF_FINISH[kind]:undefined;
  const result=run({type:'SetRoof',floorId,roof:{kind,pitchDeg:Number(pitch),overhang:Number(overhang),ridgeAxis:ridge},...material?{material}:{}});
  onMessage(result.ok?message(locale,'roofApplied'):fail(locale,result.errors[0]));
 };
 return <fieldset className="roof-form"><legend>{message(locale,'roofLegend')}</legend>
  <label>{message(locale,'roofKind')}<select value={kind} onChange={e=>setKind(e.target.value as Roof['kind']|'none')}><option value="none">{message(locale,'roofNone')}</option><option value="flat">{message(locale,'roofFlat')}</option><option value="gable">{message(locale,'roofGable')}</option></select></label>
  {kind!=='none'&&<label>{message(locale,'roofOverhang')}<input type="number" step={1} inputMode="numeric" value={overhang} onChange={e=>setOverhang(e.target.value)}/></label>}
  {kind==='gable'&&<><label>{message(locale,'roofPitch')}<input type="number" step={1} inputMode="numeric" value={pitch} onChange={e=>setPitch(e.target.value)}/></label>
   <label>{message(locale,'roofRidge')}<select value={ridge} onChange={e=>setRidge(e.target.value as Roof['ridgeAxis'])}><option value="x">{message(locale,'ridgeX')}</option><option value="y">{message(locale,'ridgeY')}</option></select></label></>}
  <button type="button" className="primary-button" disabled={kind==='none'&&!roof} onClick={apply}>{message(locale,'applyRoof')}</button>
 </fieldset>;
}
