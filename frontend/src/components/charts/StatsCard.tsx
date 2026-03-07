import { Card, Group, Text, Stack, type MantineColor } from '@mantine/core';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import type { DataPoint } from '../../hooks/useSparklineData';

export interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  color?: MantineColor;
  sparklineData?: DataPoint[];
  sparklineHeight?: number;
  valueFormatter?: (value: number | string) => string;
  onClick?: () => void;
}

/**
 * Reusable stats card component with optional sparkline
 * Used for cluster list and cluster overview cards
 */
export function StatsCard({
  title,
  value,
  subtitle,
  color = 'blue',
  sparklineData,
  sparklineHeight = 25,
  valueFormatter,
  onClick,
}: StatsCardProps) {
  const hasSparkline = sparklineData && sparklineData.length > 0;
  
  // Prepare sparkline data
  const sparklineChartData = hasSparkline
    ? sparklineData.map((point) => ({
        value: point.value,
      }))
    : [];

  // Format display value
  const displayValue = valueFormatter ? valueFormatter(value) : value;

  return (
    <Card
      shadow="sm"
      padding="lg"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
      }}
      onClick={onClick}
    >
      <Stack gap="xs" justify="space-between" style={{ height: '100%' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              {title}
            </Text>
            <Text size="xl" fw={700} style={{ whiteSpace: 'nowrap' }}>
              {displayValue}
            </Text>
          </Stack>
          {subtitle && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {subtitle}
            </Text>
          )}
        </Group>
        
        {hasSparkline && (
          <div style={{ marginTop: 4 }}>
            <ResponsiveContainer width="100%" height={sparklineHeight}>
              <AreaChart data={sparklineChartData}>
                <defs>
                  <linearGradient
                    id={`gradient-${color}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={`var(--mantine-color-${color}-6)`}
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="100%"
                      stopColor={`var(--mantine-color-${color}-6)`}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={`var(--mantine-color-${color}-6)`}
                  strokeWidth={2}
                  fill={`url(#gradient-${color})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Stack>
    </Card>
  );
}

export default StatsCard;
