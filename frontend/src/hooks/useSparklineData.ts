import { useState, useEffect, useRef } from 'react';

/**
 * Hook to track historical data for sparklines
 * Stores data points at intervals based on refresh rate
 */
export function useSparklineData(
  currentValue: number | undefined,
  refreshInterval: number,
  maxDataPoints: number = 20
) {
  const [data, setData] = useState<number[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (currentValue === undefined) return;

    const now = Date.now();
    // Calculate minimum interval (refresh / 2, but not less than 1000ms)
    const minInterval = Math.max(1000, refreshInterval / 2);

    // Only add data point if enough time has passed
    if (now - lastUpdateRef.current >= minInterval) {
      setData((prev) => {
        const newData = [...prev, currentValue];
        // Keep only the last maxDataPoints
        if (newData.length > maxDataPoints) {
          return newData.slice(-maxDataPoints);
        }
        return newData;
      });
      lastUpdateRef.current = now;
    }
  }, [currentValue, refreshInterval, maxDataPoints]);

  return data;
}
