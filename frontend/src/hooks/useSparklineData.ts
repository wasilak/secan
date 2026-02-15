import { useState, useEffect } from 'react';

/**
 * Hook to track historical data for sparklines
 * Adds a new data point on every value change (refresh)
 * Initializes with duplicate values so sparkline shows immediately
 */
export function useSparklineData(
  currentValue: number | undefined,
  maxDataPoints: number = 20
) {
  const [data, setData] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (currentValue === undefined) return;

    setData((prev) => {
      // On first value, initialize with 2 duplicate points so sparkline shows immediately
      if (!initialized) {
        setInitialized(true);
        return [currentValue, currentValue];
      }

      // Add data point on every value change (every refresh)
      const newData = [...prev, currentValue];
      
      // Keep only the last maxDataPoints
      if (newData.length > maxDataPoints) {
        return newData.slice(-maxDataPoints);
      }
      return newData;
    });
  }, [currentValue, maxDataPoints, initialized]);

  return data;
}
