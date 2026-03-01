import { Badge, Button, Menu, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

/**
 * Time range preset configuration
 */
export interface TimeRangePreset {
  label: string;
  minutes: number;
}

/**
 * Shared time range presets used across the application
 */
export const TIME_RANGE_PRESETS: TimeRangePreset[] = [
  { label: 'Last 5min', minutes: 5 },
  { label: 'Last 15min', minutes: 15 },
  { label: 'Last 30min', minutes: 30 },
  { label: 'Last 1h', minutes: 60 },
  { label: 'Last 6h', minutes: 360 },
  { label: 'Last 24h', minutes: 1440 },
  { label: 'Last 7d', minutes: 10080 },
  { label: 'Last 30d', minutes: 43200 },
];

export interface TimeRangePickerProps {
  /** Currently selected time range */
  selectedTimeRange: TimeRangePreset;
  /** Callback when time range changes */
  onChange: (preset: TimeRangePreset) => void;
  /** Whether the dropdown is open */
  opened?: boolean;
  /** Callback when dropdown open state changes */
  onOpenedChange?: (opened: boolean) => void;
}

/**
 * Reusable time range picker component
 * Used in Statistics tab and Node Modal for Prometheus metrics
 */
export function TimeRangePicker({
  selectedTimeRange,
  onChange,
  opened = false,
  onOpenedChange,
}: TimeRangePickerProps) {
  return (
    <Menu
      opened={opened}
      onChange={onOpenedChange}
      position="bottom-end"
      withArrow
    >
      <Menu.Target>
        <Button
          variant="light"
          size="sm"
          leftSection={<IconClock size={16} />}
          rightSection={
            <Text size="xs" c="dimmed">
              {selectedTimeRange?.label || 'Last 24h'}
            </Text>
          }
        >
          Time Range
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Text size="xs" c="dimmed" px="sm" py="xs">
          Select time range
        </Text>
        {TIME_RANGE_PRESETS.map((preset) => (
          <Menu.Item
            key={preset.label}
            onClick={() => onChange(preset)}
            leftSection={
              selectedTimeRange?.label === preset.label ? (
                <Badge size="xs" variant="filled" color="blue">
                  ✓
                </Badge>
              ) : null
            }
          >
            {preset.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
