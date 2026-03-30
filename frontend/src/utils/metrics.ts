/**
 * Lightweight in-memory metrics for frontend diagnostics.
 * Used to count occurrences where server omits derived fields like heapPercent.
 * Exposed on window for easy inspection during development.
 */

let heapPercentMissingCount = 0;

export function incrementHeapPercentMissing(): void {
  heapPercentMissingCount += 1;
  try {
    // Expose for debugging in devtools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__secanHeapPercentMissingCount = heapPercentMissingCount;
  } catch {
    // ignore in non-browser environments
  }
}

export function getHeapPercentMissingCount(): number {
  return heapPercentMissingCount;
}
