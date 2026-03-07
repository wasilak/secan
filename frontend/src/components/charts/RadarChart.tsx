import { Card, Stack, Text, useMantineColorScheme } from '@mantine/core';
import {
  RadarChart as RechartsRadar,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

export interface RadarChartData {
  category: string;
  value: number;
  fullMark?: number;
}

export interface RadarChartProps {
  title: string;
  data: RadarChartData[];
  height?: number;
  color?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
}

/**
 * Reusable radar chart component
 */
export function RadarChart({
  title,
  data,
  height = 200,
  color = 'blue',
  showLegend = true,
  showTooltip = true,
}: RadarChartProps) {
  const { colorScheme } = useMantineColorScheme();
  const hasData = data && data.length > 0;

  // Calculate max value for scaling
  const maxValue = Math.max(...data.map((d) => d.fullMark || d.value), 1);

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {hasData ? (
          <ResponsiveContainer width="100%" height={height}>
            <RechartsRadar data={data}>
              <PolarGrid stroke="var(--mantine-color-dark-4)" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, maxValue]}
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
              />
              <Radar
                name={title}
                dataKey="value"
                stroke={`var(--mantine-color-${color}-6)`}
                fill={`var(--mantine-color-${color}-6)`}
                fillOpacity={0.5}
              />
              {showTooltip && (
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: colorScheme === 'dark'
                      ? 'var(--mantine-color-dark-7)'
                      : 'var(--mantine-color-gray-0)',
                    border: `1px solid ${colorScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                    borderRadius: '4px',
                    color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)',
                  }}
                  labelStyle={{ color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)' }}
                />
              )}
              {showLegend && <Legend />}
            </RechartsRadar>
          </ResponsiveContainer>
        ) : (
          <Stack justify="center" align="center" style={{ height }}>
            <Text size="sm" c="dimmed">
              Data not available
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export default RadarChart;
