/**
 * Heap utilities
 * Single source of truth for computing heap percent and deriving a color.
 */

export function computeHeapPercent(heapUsed?: number, heapMax?: number): number {
  if (heapUsed === undefined || heapMax === undefined) return 0;
  if (!Number.isFinite(heapUsed) || !Number.isFinite(heapMax) || heapMax <= 0) return 0;
  const pct = (heapUsed as number) / (heapMax as number) * 100;
  // Clamp to sensible bounds
  return Math.max(0, Math.min(100, pct));
}

export function getHeapColor(percent: number): string {
  return percent < 70 ? 'green' : percent < 85 ? 'yellow' : 'red';
}
