import {it,expect,vi,afterEach} from 'vitest';
import {ContextRecovery} from './recovery';
afterEach(()=>vi.useRealTimers());
it('starts deadline at loss; repeated loss and stale draws cannot postpone it',()=>{
 vi.useFakeTimers();const fallback=vi.fn(),recovery=new ContextRecovery(fallback);recovery.lost();vi.advanceTimersByTime(2000);recovery.lost();recovery.drawn(1,2);expect(recovery.active).toBe(true);vi.advanceTimersByTime(999);expect(fallback).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(fallback).toHaveBeenCalledTimes(1);recovery.close();
});
it('only latest successful draw completes recovery, and subsequent loss has its own deadline',()=>{
 vi.useFakeTimers();const fallback=vi.fn(),recovery=new ContextRecovery(fallback);recovery.lost();vi.advanceTimersByTime(2500);recovery.drawn(3,3);vi.advanceTimersByTime(500);expect(fallback).not.toHaveBeenCalled();expect(recovery.active).toBe(false);recovery.lost();vi.advanceTimersByTime(3000);expect(fallback).toHaveBeenCalledTimes(1);recovery.close();
});
it('unmount closes timer and ignores late lost/draw events',()=>{
 vi.useFakeTimers();const fallback=vi.fn(),recovery=new ContextRecovery(fallback);recovery.lost();recovery.close();recovery.close();recovery.lost();recovery.drawn(1,1);vi.advanceTimersByTime(3000);expect(fallback).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});

it('a draw that crosses the monotonic deadline cannot cancel an overdue timer or acknowledge current',()=>{
 vi.useFakeTimers();let now=0;const fallback=vi.fn(),recovery=new ContextRecovery(fallback,3000,()=>now);recovery.lost();now=3001;expect(recovery.drawn(7,7)).toBe(false);expect(fallback).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);expect(recovery.drawn(7,7)).toBe(false);recovery.lost();vi.advanceTimersByTime(3000);expect(fallback).toHaveBeenCalledTimes(1);
});
it('current draw at the inclusive deadline is accepted before expiry callback runs',()=>{let now=0;const fallback=vi.fn(),recovery=new ContextRecovery(fallback,3000,()=>now);recovery.lost();now=3000;expect(recovery.drawn(4,4)).toBe(true);expect(fallback).not.toHaveBeenCalled();recovery.close();});
