import { describe, expect, it } from 'vitest';
import type { ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import { roofOutline, stairSymbol } from './structure-symbol';

// FR-035 (D66) plan symbols. Claude-authored analytic tests.
const stair = { position: { x: 2000, y: 2500 }, rotationDeg: 0, width: 900, length: 4000, height: 3000, steps: 16 } as const;
describe('FR-035 plan symbols', () => {
  it('a north-climbing stair: 900 x 4000 outline, 15 riser lines every 250 mm, arrow from the bottom tread to the top edge', () => {
    const symbol = stairSymbol(stair);
    expect(symbol.outline).toEqual([1550, 500, 2450, 4500]);
    expect(symbol.risers).toHaveLength(15);
    expect(symbol.risers[0]).toEqual([[1550, 4250], [2450, 4250]]);
    expect(symbol.risers[14]).toEqual([[1550, 750], [2450, 750]]);
    expect(symbol.arrow).toEqual([[2000, 4375], [2000, 500]]);
  });
  it('turned east the risers are vertical and the arrow points east', () => {
    const symbol = stairSymbol({ ...stair, rotationDeg: 90, steps: 4 });
    expect(symbol.outline).toEqual([0, 2050, 4000, 2950]);
    expect(symbol.risers).toEqual([[[1000, 2050], [1000, 2950]], [[2000, 2050], [2000, 2950]], [[3000, 2050], [3000, 2950]]]);
    expect(symbol.arrow).toEqual([[500, 2500], [4000, 2500]]);
    expect(stairSymbol({ ...stair, rotationDeg: 180, steps: 4 }).risers[0]).toEqual([[1550, 1500], [2450, 1500]]);
    expect(stairSymbol({ ...stair, rotationDeg: 270, steps: 4 }).arrow).toEqual([[3500, 2500], [0, 2500]]);
  });
  it('the roof outline is the outer wall rectangle plus the overhang', () => {
    expect(roofOutline(sample as ProjectDoc, { floorId: 'f0', kind: 'flat', pitchDeg: 30, overhang: 600, ridgeAxis: 'x' })).toEqual([-715, -715, 8715, 5715]);
  });
});
