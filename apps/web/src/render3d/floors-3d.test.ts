import {it,expect} from 'vitest';
import * as THREE from 'three';
import sample from '../../../../docs/examples/sample-project.json';
import {ProjectStore} from '@gharplan/core-model';
import type {Command,ProjectDoc} from '@gharplan/core-model';
import {SceneAdapter} from './scene';
import {buildScene} from './mesh';
import {openingBounds} from './camera';
import {pickRay,furnitureRayHit} from './picking';
import {pointLightPosition} from './lighting';
// Audit 2026-10-19 (FR-034/035). Claude-authored analytic tests, not independent fixtures.
// H.6 sample + "Add floor" with the outer walls copied: the upper floor starts at 3000 mm, ground walls are 3000 mm high.
// Ground w1 runs (0,0)->(4500,0), 230 mm thick, with the living window at x 1500..3000 mm, sill 900, height 1200.
let n=0;
const run=(s:ProjectStore,c:Record<string,unknown>)=>s.execute({id:`audit_${++n}`,baseGeneration:s.getSnapshot().localGeneration,...c} as Command);
function twoFloors(){
 const s=new ProjectStore(structuredClone(sample) as ProjectDoc,'audit');expect(run(s,{type:'AddFloor',name:'Floor 1',copyOutlineFrom:'f0'}).ok).toBe(true);
 const d=s.getSnapshot().document,upper=d.floors.find(f=>f.level===1)!.id,j=(id:string)=>d.junctions.find(k=>k.id===id)!;
 const upperW1=d.walls.find(w=>w.floorId===upper&&j(w.a).x===0&&j(w.a).y===0&&j(w.b).x===4500&&j(w.b).y===0)!; // the copy of w1
 expect(run(s,{type:'AddOpening',opening:{id:'o_up',wallId:upperW1.id,kind:'door',assetId:'a_door_single_900',offset:2000,width:900,height:2100,sill:0,flipX:false,flipY:false}}).ok).toBe(true);
 return {s,upper};
}
const across=(y:number)=>new THREE.Raycaster(new THREE.Vector3(2,y,-3),new THREE.Vector3(0,0,1)); // from the north, through x=2.0 m (door centre)
const down=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));

it('audit: an upstairs door is picked at its own floor height (3.0-5.1 m), not over the ground wall',()=>{
 const {s}=twoFloors(),d=s.getSnapshot().document as ProjectDoc,b=openingBounds(d,'o_up')!;
 // x = 2000 +- 900/2 mm, z = 0 +- 230/2 mm, y = 3000 + 0 .. 3000 + 2100 mm
 expect(b[0]).toBeCloseTo(1.55,12);expect(b[3]).toBeCloseTo(2.45,12);expect(b[2]).toBeCloseTo(-.115,12);expect(b[5]).toBeCloseTo(.115,12);expect(b[1]).toBe(3);expect(b[4]).toBeCloseTo(5.1,12);
 const win=openingBounds(d,'o_win_living')!;expect(win[1]).toBeCloseTo(.9,12);expect(win[4]).toBeCloseTo(2.1,12); // ground window stays at 0.9..2.1 m
 const adapter=new SceneAdapter('mid');adapter.apply(buildScene(d),d);
 expect(pickRay(across(.5),adapter.group,d)).toEqual({kind:'wall',id:'w1'}); // below the ground window sill: solid ground wall
 expect(pickRay(across(1),adapter.group,d)).toEqual({kind:'opening',id:'o_win_living'}); // ground window 0.9..2.1 m
 expect(pickRay(across(4),adapter.group,d)).toEqual({kind:'opening',id:'o_up'}); // through the upstairs door
 adapter.dispose();
});

it.each(['low','mid'] as const)('audit: %s ground-floor cutaway hides and stops picking the floors above; the upper floor active picks upstairs',tier=>{
 const {s,upper}=twoFloors(),d=structuredClone(s.getSnapshot().document) as ProjectDoc,upperRoom=d.rooms.find(r=>r.floorId===upper)!;
 d.furniture.push({...d.furniture[0]!,id:'fu_up',floorId:upper,position:{x:6000,y:2500},rotationDeg:0,elevation:0,size:{w:600,d:600,h:800}});
 const adapter=new SceneAdapter(tier);adapter.apply(buildScene(d),d);
 // Everything shown (upper floor active or "show floors above"): the upstairs room floor at 3.0 m is the first hit.
 expect(pickRay(down(2,2.5),adapter.group,d)).toEqual({kind:'room',id:upperRoom.id});
 expect(furnitureRayHit(down(6,2.5),adapter.group,d)?.id).toBe('fu_up');
 adapter.setHiddenFloors(new Set([upper]),d);expect([...adapter.hiddenFloors]).toEqual([upper]);
 expect(pickRay(down(2,2.5),adapter.group,d,adapter.hiddenFloors)).toEqual({kind:'room',id:'r_living'});
 expect(pickRay(down(6,2.5),adapter.group,d,adapter.hiddenFloors)).toEqual({kind:'room',id:'r_bed'}); // upstairs item hidden too
 expect(pickRay(across(4),adapter.group,d,adapter.hiddenFloors)).toBeNull(); // nothing on the ground floor reaches 4 m
 expect(pickRay(across(.5),adapter.group,d,adapter.hiddenFloors)).toEqual({kind:'wall',id:'w1'});
 // Nothing drawn belongs to the upper floor; the ground floor stays drawn.
 const drawn=adapter.group.children.filter(o=>o.visible&&o instanceof THREE.Mesh) as THREE.Mesh[];
 expect(drawn.some(m=>m.userData.floorId===upper||m.userData.entityId==='fu_up')).toBe(false);
 expect(drawn.some(m=>m.userData.floorId==='f0')).toBe(true);
 if(tier==='mid'){expect(adapter.mesh(`floor:${upperRoom.id}`)!.visible).toBe(false);expect(adapter.mesh('floor:r_living')!.visible).toBe(true);}
 // Re-applying the scene keeps the cutaway; clearing it shows and picks the upper floor again.
 adapter.apply(buildScene(d),d);expect(pickRay(down(2,2.5),adapter.group,d,adapter.hiddenFloors)).toEqual({kind:'room',id:'r_living'});
 adapter.setHiddenFloors(new Set(),d);expect(pickRay(down(2,2.5),adapter.group,d,adapter.hiddenFloors)).toEqual({kind:'room',id:upperRoom.id});
 if(tier==='mid')expect(adapter.mesh(`floor:${upperRoom.id}`)!.visible).toBe(true);
 adapter.dispose();
});

it('audit: a point light hangs from its own floor (upper floor 3000 mm + 2900 mm = 5.9 m)',()=>{
 const {s,upper}=twoFloors(),d=s.getSnapshot().document;
 expect(pointLightPosition(d,{floorId:upper,height:2900,position:{x:1500,y:2500}})).toEqual([1.5,5.9,2.5]);
 expect(pointLightPosition(d,{floorId:'f0',height:2900,position:{x:2250,y:2500}})).toEqual([2.25,2.9,2.5]);
});
