import { Card, Group, Text, Stack, type MantineColor } from '@mantine/core';
import type { DataPoint } from '../../hooks/useSparklineData';
import { NivoSparkline } from './NivoSparkline';

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
  const sparklineChartData: number[] = hasSparkline
    ? sparklineData.map((point) => point.value)
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
            <NivoSparkline
              data={sparklineChartData}
              color={`var(--mantine-color-${color}-6)`}
              height={sparklineHeight}
            />
          </div>
        )}
      </Stack>
    </Card>
  );
}

export default StatsCard;
