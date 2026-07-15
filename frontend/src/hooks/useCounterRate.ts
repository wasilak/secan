import { useState, useEffect, useRef } from 'react';
import { useRefreshState } from '../contexts/RefreshContext';

/**
 * Hook to derive an instantaneous rate (units/second) from a cumulative counter.
 *
 * Elasticsearch node stats expose cumulative totals (e.g. indexing.index_total).
 * On every refresh tick this hook compares the current total with the previous
 * sample and computes the per-second rate, suitable for feeding into
 * useSparklineData / TimeSeriesChart alongside other internal metrics.
 *
 * Returns undefined until two samples are available. A counter reset (node
 * restart) yields undefined for that interval instead of a negative rate.
 *
 * @param total - Current cumulative counter value
 */
export function useCounterRate(total: number | undefined): number | undefined {
  const { lastRefreshTime } = useRefreshState();
  const prevRef = useRef<{ total: number; time: number } | null>(null);
  const [rate, setRate] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (total === undefined) {
      return;
    }
    const now = Date.now();
    const prev = prevRef.current;
    if (prev && now > prev.time) {
      const delta = total - prev.total;
      setRate(delta >= 0 ? (delta / (now - prev.time)) * 1000 : undefined);
    }
    prevRef.current = { total, time: now };
  }, [total, lastRefreshTime]);

  return rate;
}
