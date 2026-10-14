import fc from 'fast-check';
import {expect,it} from 'vitest';
import * as THREE from 'three';
import {sunPlacement} from './lighting';
it('REN-005 sun/shadow coverage is invariant under plan translation/elevation and explicitly capped on large plans',()=>{
 const base=sunPlacement([0,0,0,8,3,5],0);for(const [x,y,z]of [[500,0,0],[0,1000,0],[-50,-1000,30]]){const p=sunPlacement([x!,y!,z!,x!+8,y!+3,z!+5],y!);expect(p.target.map((v,i)=>v-[x!,y!,z!][i]!)).toEqual(base.target);expect(p.position.map((v,i)=>v-[x!,y!,z!][i]!)).toEqual(base.position);const light=new THREE.DirectionalLight();light.position.fromArray(p.position);light.target.position.fromArray(p.target);light.updateMatrixWorld();light.target.updateMatrixWorld();const c=light.shadow.camera;c.left=-p.coverage;c.right=p.coverage;c.top=p.coverage;c.bottom=-p.coverage;c.far=80;c.updateProjectionMatrix();light.shadow.updateMatrices(light);const projected=new THREE.Vector3(x!+4,y!,z!+2.5).project(c);expect(Math.abs(projected.x)).toBeLessThanOrEqual(1);expect(Math.abs(projected.y)).toBeLessThanOrEqual(1);expect(Math.abs(projected.z)).toBeLessThanOrEqual(1);light.shadow.dispose();}expect(sunPlacement([0,0,0,2000,3,20],0)).toMatchObject({coverage:20,partial:true});
});

it('REN-005 property translated/elevated bounded shadows retain relative sun direction and finite capped coverage',()=>{
 fc.assert(fc.property(fc.integer({min:-1000,max:1000}),fc.integer({min:-1000,max:1000}),fc.integer({min:-1000,max:1000}),fc.integer({min:1,max:2000}),fc.integer({min:1,max:2000}),(x,y,z,w,d)=>{const a=sunPlacement([0,0,0,w,3,d],0),b=sunPlacement([x,y,z,x+w,y+3,z+d],y);expect(b.coverage).toBe(a.coverage);expect(b.coverage).toBeGreaterThanOrEqual(5);expect(b.coverage).toBeLessThanOrEqual(20);for(let i=0;i<3;i++){expect(b.target[i]!-[x,y,z][i]!).toBeCloseTo(a.target[i]!,10);expect(b.position[i]!-[x,y,z][i]!).toBeCloseTo(a.position[i]!,10);}expect(b.position[1]).toBeGreaterThan(y+3);}),{numRuns:100,seed:33315});
});
