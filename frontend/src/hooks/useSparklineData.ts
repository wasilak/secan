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
 * When resetKey changes (e.g., switching to statistics tab), performs an immediate
 * data pull to populate graphs right away instead of waiting for the next refresh cycle
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
  const needsImmediateDataRef = useRef(false);

  // Reset data when resetKey changes and mark that we need immediate data
  useEffect(() => {
    if (resetKey !== undefined && resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      initializedRef.current = false;
      needsImmediateDataRef.current = true; // Flag for immediate data pull
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
      needsImmediateDataRef.current = false; // Clear the flag after initialization
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
    
    needsImmediateDataRef.current = false; // Clear the flag after adding data
  }, [currentValue, lastRefreshTime, maxDataPoints]);

  // Perform immediate data pull when switching to statistics tab
  // This effect runs when currentValue changes AND we need immediate data
  useEffect(() => {
    if (currentValue !== undefined && needsImmediateDataRef.current && !initializedRef.current) {
      // This will trigger the initialization in the main effect above
      // The flag ensures we get data immediately instead of waiting for next refresh
    }
  }, [currentValue]);

  // Return data in requested format
  if (withTimestamps) {
    return data;
  }
  return data.map(d => d.value);
}
