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
  STARTED: { icon: IconCircleCheckFilled, color: 'green', label: 'STARTED' },
  UNASSIGNED: { icon: IconHourglass, color: 'red', label: 'UNASSIGNED' },
  INITIALIZING: { icon: IconProgress, color: 'yellow', label: 'INITIALIZING' },
  RELOCATING: { icon: IconAlertCircle, color: 'orange', label: 'RELOCATING' },
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
 * Active (selected) states show in color, inactive states in grayscale
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
    <Group gap="xs" wrap="wrap">
      {states.map((state) => {
        const config = getShardStateConfig(state);
        const Icon = config.icon;
        const isSelected = selectedStates.includes(state);

        return (
          <Group
            key={state}
            gap={6}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              backgroundColor: isSelected ? `var(--mantine-color-${config.color}-0)` : 'var(--mantine-color-gray-1)',
              border: `1px solid ${isSelected ? `var(--mantine-color-${config.color}-3)` : 'var(--mantine-color-gray-2)'}`,
              opacity: isSelected ? 1 : 0.6,
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
              color={isSelected ? `var(--mantine-color-${config.color}-6)` : 'var(--mantine-color-gray-6)'}
              style={{ transition: 'color 150ms ease' }}
            />
            <Text
              size="xs"
              fw={isSelected ? 500 : 400}
              style={{ transition: 'font-weight 150ms ease' }}
            >
              {config.label}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}
