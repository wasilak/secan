import { useState, useEffect, useRef } from 'react';
import { useRefresh } from '../contexts/RefreshContext';

/**
 * Data point with timestamp for charts
 */
export interface DataPoint {
  value: number;
  timestamp: number;
}

/**
 * Hook to track historical data for sparklines and charts
 * Adds a new data point on EVERY refresh (even if value doesn't change)
 * Initializes with [0, currentValue] to show trend from baseline
 * 
 * This ensures the time axis progresses properly on every refresh interval
 * by tracking lastRefreshTime from RefreshContext instead of value changes
 * 
 * @param currentValue - The current value to track
 * @param maxDataPoints - Maximum number of data points to keep (default: 20)
 * @param resetKey - Optional key that when changed, resets the data (useful for tab switching)
 * @param withTimestamps - If true, returns DataPoint[] with timestamps, otherwise returns number[]
 */
export function useSparklineData(
  currentValue: number | undefined,
  maxDataPoints: number = 20,
  resetKey?: string | number,
  withTimestamps: boolean = false
): number[] | DataPoint[] {
  const [data, setData] = useState<DataPoint[]>([]);
  const initializedRef = useRef(false);
  const { lastRefreshTime } = useRefresh();
  const lastResetKeyRef = useRef(resetKey);

  // Reset data when resetKey changes
  useEffect(() => {
    if (resetKey !== undefined && resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      initializedRef.current = false;
      setData([]);
    }
  }, [resetKey]);

  useEffect(() => {
    if (currentValue === undefined) return;

    // On first value, initialize with [0, currentValue] to show trend from baseline
    if (!initializedRef.current) {
      initializedRef.current = true;
      const now = Date.now();
      setData([
        { value: 0, timestamp: now - 1000 }, // 1 second before for baseline
        { value: currentValue, timestamp: now }
      ]);
      return;
    }

    // Add data point on EVERY refresh (tracked by lastRefreshTime)
    // This ensures the time axis progresses even if value doesn't change
    setData((prev) => {
      const newData = [...prev, { value: currentValue, timestamp: Date.now() }];
      
      // Keep only the last maxDataPoints
      if (newData.length > maxDataPoints) {
        return newData.slice(-maxDataPoints);
      }
      return newData;
    });
  }, [currentValue, lastRefreshTime, maxDataPoints]);

  // Return data in requested format
  if (withTimestamps) {
    return data;
  }
  return data.map(d => d.value);
}
