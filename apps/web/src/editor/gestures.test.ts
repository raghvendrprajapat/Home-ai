import { expect, it } from 'vitest';
import fc from 'fast-check';
import { PlanGestures, pinchView } from './gestures';
import { screenToWorld, MIN_SCALE, MAX_SCALE } from './view2d';
const view={x:10,y:20,scale:0.1};
it('analytic pinch translates its midpoint and zooms without drifting the world anchor',()=>{
  expect(pinchView(view,[[100,100],[200,100]],[[120,130],[320,130]])).toEqual({x:-60,y:-30,scale:0.2});
  expect(pinchView(view,[[100,100],[100,100]],[[50,100],[200,100]])).toBe(view);
  fc.assert(fc.property(fc.double({min:MIN_SCALE,max:MAX_SCALE,noNaN:true}),fc.integer({min:2,max:2000}),fc.integer({min:1,max:3000}),fc.integer({min:-1000,max:1000}),(scale,gap,nextGap,translation)=>{
    const initial={x:17,y:-31,scale},middle:[number,number]=[200,300],currentMiddle:[number,number]=[200+translation,300-translation];
    const next=pinchView(initial,[[middle[0]-gap/2,middle[1]],[middle[0]+gap/2,middle[1]]],[[currentMiddle[0]-nextGap/2,currentMiddle[1]],[currentMiddle[0]+nextGap/2,currentMiddle[1]]]);
    const oldWorld=screenToWorld(middle,initial),newWorld=screenToWorld(currentMiddle,next);
    expect(next.scale).toBeGreaterThanOrEqual(MIN_SCALE);expect(next.scale).toBeLessThanOrEqual(MAX_SCALE);
    expect(Math.abs(oldWorld[0]-newWorld[0])*next.scale).toBeLessThan(1e-6);expect(Math.abs(oldWorld[1]-newWorld[1])*next.scale).toBeLessThan(1e-6);
  }),{seed:20261013,numRuns:1000});
});
it('touch requires150ms hold; early movement pans and cannot commit a corner',()=>{
  const g=new PlanGestures();expect(g.begin(1,true,[10,10],view,true,0).phase).toBe('pending');expect(g.hold(149).phase).toBe('pending');
  expect(g.move(1,[18,10],80)).toMatchObject({phase:'pan',view:{x:18,y:20,scale:0.1}});expect(g.hold(200).phase).toBe('pan');expect(g.end(1,[40,20],220).commit).toBeUndefined();
  g.begin(2,true,[10,10],view,true,300);expect(g.hold(450).phase).toBe('drag');g.move(2,[20,30],470);expect(g.end(2,[20,30],480)).toMatchObject({phase:'idle',commit:{pointerId:2,delta:[10,20]}});
});
it('mouse drag ends exactly once; a click/jitter returns selection without a commit',()=>{
  const g=new PlanGestures();g.begin(1,false,[0,0],view,true,0);expect(g.end(1,[2,1],10)).toMatchObject({phase:'idle',tap:[2,1]});
  g.begin(1,false,[0,0],view,true,20);expect(g.end(1,[10,0],50).commit).toMatchObject({delta:[10,0]});expect(g.end(1,[20,0],60).commit).toBeUndefined();
});
it('second finger discards editing and pinches; remaining finger never resumes editing; third finger blocks',()=>{
  const g=new PlanGestures();g.begin(1,true,[100,100],view,true,0);g.hold(150);g.move(1,[110,100],170);
  expect(g.begin(2,true,[210,100],view,false,180)).toMatchObject({phase:'pinch',cancelEdit:true});expect(g.move(2,[310,100],200).view?.scale).toBe(0.2);
  expect(g.end(2,[310,100],220)).toMatchObject({phase:'blocked',cancelEdit:true});expect(g.move(1,[200,200],250).drag).toBeUndefined();expect(g.end(1,[200,200],300).commit).toBeUndefined();
  g.begin(1,true,[0,0],view,true,400);g.begin(2,true,[100,0],view,false,420);expect(g.begin(3,true,[200,0],view,false,430).phase).toBe('blocked');expect(g.move(2,[150,0],440).view).toBeUndefined();
});
it('cancel and mixed pointer sequences cannot produce commands or resurrect drafts',()=>{
  fc.assert(fc.property(fc.array(fc.tuple(fc.integer({min:-1000,max:1000}),fc.integer({min:-1000,max:1000})),{minLength:1,maxLength:100}),points=>{
    const g=new PlanGestures();g.begin(1,true,[0,0],view,true,0);g.hold(150);for(const p of points)g.move(1,p,200);g.cancel();
    for(const p of points)expect(g.move(1,p,250).drag).toBeUndefined();expect(g.end(1,points.at(-1)!,300).commit).toBeUndefined();expect(g.phase).toBe('idle');
  }),{seed:20261013,numRuns:200});
  const g=new PlanGestures();g.begin(1,false,[0,0],view,true,0);expect(g.begin(2,true,[100,0],view,false,20).phase).toBe('blocked');g.clear();expect(g.ids()).toEqual([]);expect(g.phase).toBe('idle');
});
