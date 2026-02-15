import { useState, useEffect, useRef } from 'react';
import { useRefresh } from '../contexts/RefreshContext';

/**
 * Hook to track historical data for sparklines
 * Adds a new data point on EVERY refresh (even if value doesn't change)
 * Initializes with [0, currentValue] to show trend from baseline
 * 
 * This ensures the time axis progresses properly on every refresh interval
 * by tracking lastRefreshTime from RefreshContext instead of value changes
 */
export function useSparklineData(
  currentValue: number | undefined,
  maxDataPoints: number = 20
) {
  const [data, setData] = useState<number[]>([]);
  const initializedRef = useRef(false);
  const { lastRefreshTime } = useRefresh();

  useEffect(() => {
    if (currentValue === undefined) return;

    // On first value, initialize with [0, currentValue] to show trend from baseline
    if (!initializedRef.current) {
      initializedRef.current = true;
      setData([0, currentValue]);
      return;
    }

    // Add data point on EVERY refresh (tracked by lastRefreshTime)
    // This ensures the time axis progresses even if value doesn't change
    setData((prev) => {
      const newData = [...prev, currentValue];
      
      // Keep only the last maxDataPoints
      if (newData.length > maxDataPoints) {
        return newData.slice(-maxDataPoints);
      }
      return newData;
    });
  }, [currentValue, lastRefreshTime, maxDataPoints]);

  return data;
}
