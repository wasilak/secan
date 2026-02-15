import { useState, useEffect, useRef } from 'react';

/**
 * Hook to track historical data for sparklines
 * Adds a new data point on every value change (refresh)
 * Initializes with [0, currentValue] to show trend from baseline
 */
export function useSparklineData(
  currentValue: number | undefined,
  maxDataPoints: number = 20
) {
  const [data, setData] = useState<number[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (currentValue === undefined) return;

    // On first value, initialize with [0, currentValue] to show trend from baseline
    if (!initializedRef.current) {
      initializedRef.current = true;
      setData([0, currentValue]);
      return;
    }

    // Add data point on every value change (every refresh)
    setData((prev) => {
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
