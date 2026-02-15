import { LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * Sparkline component - minimal line chart for showing trends
 */
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = 'var(--mantine-color-blue-6)', height = 30 }: SparklineProps) {
  // Convert array to chart data format
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
