import { Group, Text, Tooltip } from '@mantine/core';
import {
  IconCircleCheckFilled,
  IconAlertCircle,
  IconProgress,
  IconHourglass,
} from '@tabler/icons-react';

/**
 * Shard state icon and color mapping
 */
const SHARD_STATE_CONFIG: Record<string, { icon: typeof IconCircleCheckFilled; color: string; label: string }> = {
  STARTED: { icon: IconCircleCheckFilled, color: 'green', label: 'started' },
  UNASSIGNED: { icon: IconHourglass, color: 'red', label: 'unassigned' },
  INITIALIZING: { icon: IconProgress, color: 'yellow', label: 'initializing' },
  RELOCATING: { icon: IconAlertCircle, color: 'orange', label: 'relocating' },
};

export function getShardStateConfig(state: string) {
  return SHARD_STATE_CONFIG[state] || { 
    icon: IconAlertCircle, 
    color: 'gray', 
    label: state 
  };
}

/**
 * ShardStateIcon component - displays a single shard state icon with tooltip
 */
export function ShardStateIcon({ state, size = 16 }: { state: string; size?: number }) {
  const config = getShardStateConfig(state);
  const Icon = config.icon;

  return (
    <Tooltip label={config.label} withArrow>
      <Icon size={size} color={`var(--mantine-color-${config.color}-6)`} />
    </Tooltip>
  );
}

/**
 * ShardStateFilterToggle component - clickable shard states that toggle on/off
 * Displays as a legend-style filter with icons and text labels
 */
export function ShardStateFilterToggle({
  states,
  selectedStates,
  onToggle,
}: {
  states: string[];
  selectedStates: string[];
  onToggle: (state: string) => void;
}) {
  return (
    <Group gap="md" wrap="wrap">
      {states.map((state) => {
        const config = getShardStateConfig(state);
        const Icon = config.icon;
        const isSelected = selectedStates.includes(state);

        return (
          <Group
            key={state}
            gap={6}
            style={{
              cursor: 'pointer',
              opacity: isSelected ? 1 : 0.5,
              transition: 'opacity 150ms ease',
            }}
            onClick={() => onToggle(state)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(state);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <Icon
              size={16}
              color={`var(--mantine-color-${config.color}-6)`}
              style={{ transition: 'opacity 150ms ease' }}
            />
            <Text
              size="xs"
              style={{ transition: 'opacity 150ms ease' }}
            >
              {config.label}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}
