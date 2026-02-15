import { LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * Sparkline component - minimal line chart for showing trends
 * Matches Mantine's Sparkline style
 */
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  fillOpacity?: number;
}

export function Sparkline({ 
  data, 
  color = 'var(--mantine-color-blue-6)', 
  height = 30,
  fillOpacity = 0.6
}: SparklineProps) {
  // Convert array to chart data format
  const chartData = data.map((value, index) => ({ value, index }));

  // Calculate gradient id based on color
  const gradientId = `gradient-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
