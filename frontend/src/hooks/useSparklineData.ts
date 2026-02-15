import { useState, useEffect } from 'react';

/**
 * Hook to track historical data for sparklines
 * Adds a new data point on every value change (refresh)
 */
export function useSparklineData(
  currentValue: number | undefined,
  maxDataPoints: number = 20
) {
  const [data, setData] = useState<number[]>([]);

  useEffect(() => {
    if (currentValue === undefined) return;

    // Add data point on every value change (every refresh)
    setData((prev) => {
      // Always add the new value (even if same, to show refresh happened)
      const newData = [...prev, currentValue];
      
      // Keep only the last maxDataPoints
      if (newData.length > maxDataPoints) {
        return newData.slice(-maxDataPoints);
      }
      return newData;
    });
  }, [currentValue, maxDataPoints]);

  return data;
}
