import {describe,it,expect,vi} from 'vitest';
import {ResourcePool,releaseOnce} from './resources';
describe('resource leases',()=>{
 it('shares until the last owner, releases once, and never releases a replacement entry',()=>{
  const pool=new ResourcePool(),old={dispose:vi.fn()},replacement={dispose:vi.fn()};
  const a=pool.acquire('geometry',()=>old),b=pool.acquire('geometry',()=>{throw Error('must share');});
  expect(b.value).toBe(old);expect(pool.stats.references).toBe(2);a.release();a.release();expect(old.dispose).not.toHaveBeenCalled();b.release();expect(old.dispose).toHaveBeenCalledTimes(1);
  const c=pool.acquire('geometry',()=>replacement);a.release();b.release();expect(replacement.dispose).not.toHaveBeenCalled();c.release();expect(replacement.dispose).toHaveBeenCalledTimes(1);expect(pool.stats).toEqual({live:0,references:0,created:2,disposed:2,disposalFailures:0,closed:false});
 });
 it('does not cache failed factories; close disposes live leases once and rejects later acquisitions',()=>{
  const pool=new ResourcePool(),resource={dispose:vi.fn()};expect(()=>pool.acquire('a',()=>{throw Error('factory');})).toThrow('factory');expect(pool.stats.created).toBe(0);
  const lease=pool.acquire('a',()=>resource);pool.close();pool.close();lease.release();expect(resource.dispose).toHaveBeenCalledTimes(1);expect(pool.stats.live).toBe(0);expect(()=>pool.acquire('b',()=>resource)).toThrow('resources-closed');
 });
 it('closes all entries even if one disposer throws',()=>{
  const pool=new ResourcePool(),good={dispose:vi.fn()};pool.acquire('bad',()=>({dispose:()=>{throw Error('dispose');}}));pool.acquire('good',()=>good);expect(()=>pool.close()).toThrow('dispose');pool.close();expect(good.dispose).toHaveBeenCalledTimes(1);expect(pool.stats).toMatchObject({live:0,disposed:1,disposalFailures:1,closed:true});
 });
});

it('independent renderer cleanup continues after throwing dispose and never runs twice',()=>{const dispose=vi.fn(()=>{throw Error('dispose');}),lose=vi.fn(),remove=vi.fn(),release=releaseOnce([dispose,lose,remove]);expect(release).toThrow('dispose');release();expect(dispose).toHaveBeenCalledTimes(1);expect(lose).toHaveBeenCalledTimes(1);expect(remove).toHaveBeenCalledTimes(1);});
