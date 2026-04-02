import { Stack, Text, Progress } from '@mantine/core';

export interface ProgressWithLabelProps {
  label: string;
  value: number;
  color?: string;
  description?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
}

/**
 * Reusable progress bar component with label and optional description
 * Used for displaying resource usage (CPU, memory, disk, heap)
 */
export function ProgressWithLabel({
  label,
  value,
  color = 'blue',
  description,
  size = 'sm',
  radius = 'xs',
  isLoading = false,
}: ProgressWithLabelProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Progress
        value={value}
        color={color}
        size={size}
        radius={radius}
        animated={isLoading}
        striped={isLoading}
      />
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}
    </Stack>
  );
}
