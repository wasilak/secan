import { Card, Progress, Text, Stack, type MantineColor } from '@mantine/core';

export interface ProgressCardProps {
  title: string;
  value: number;
  maxValue?: number;
  color?: MantineColor;
  showValue?: boolean;
  valueFormatter?: (value: number, percent: number) => string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable progress card component
 * Used for CPU, memory, disk usage displays
 */
export function ProgressCard({
  title,
  value,
  maxValue = 100,
  color = 'blue',
  showValue = true,
  valueFormatter,
  size = 'sm',
}: ProgressCardProps) {
  const percent = Math.min(100, Math.max(0, (value / maxValue) * 100));
  
  // Format display value
  const displayValue = valueFormatter
    ? valueFormatter(value, percent)
    : `${percent.toFixed(1)}%`;

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {title}
        </Text>
        <Progress
          value={percent}
          color={color}
          size={size}
          radius="xs"
        />
        {showValue && (
          <Text size="xs" c="dimmed">
            {displayValue}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export default ProgressCard;
