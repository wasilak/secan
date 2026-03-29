import { describe, it, expect } from 'vitest';
import { computeHeapPercent } from './heap';

describe('computeHeapPercent', () => {
  it('returns 0 when values are undefined', () => {
    // call with undefined values via any to avoid TS error in test
    expect(computeHeapPercent((undefined as any) as number, (undefined as any) as number)).toBe(0);
  });

  it('returns 0 when heapMax is zero or non-finite', () => {
    expect(computeHeapPercent(100, 0)).toBe(0);
    expect(computeHeapPercent(100, NaN)).toBe(0);
  });

  it('computes correct percentage and clamps', () => {
    expect(computeHeapPercent(50, 100)).toBeCloseTo(50);
    expect(computeHeapPercent(150, 100)).toBe(100);
    expect(computeHeapPercent(-10, 100)).toBe(0);
  });

  it('handles large numbers', () => {
    expect(computeHeapPercent(1024 * 1024 * 512, 1024 * 1024 * 1024)).toBeCloseTo(50);
  });
});
