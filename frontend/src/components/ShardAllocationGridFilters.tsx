import { Group, TextInput, Checkbox, Text, ActionIcon, Tooltip, Badge, Menu } from '@mantine/core';
import {
  IconSearch,
  IconEyeOff,
  IconAlertCircle,
  IconMaximize,
  IconMinimize,
  IconLockOpen,
  IconLock,
} from '@tabler/icons-react';
import { ShardStateFilterToggle } from './ShardStateFilter';
import { ShardInfo, IndexInfo, NodeInfo } from '../types/api';

interface ShardAllocationGridFiltersProps {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  indices: IndexInfo[];
  shards: ShardInfo[];
  nodes: NodeInfo[];
  shardAllocationEnabled: boolean;
  enableAllocationMutation: any;
  disableAllocationMutation: any;
}

/**
 * ShardAllocationGridFilters Component
 *
 * Common filter bar shared between Dot View and Index View.
 * Includes shard allocation enable/disable controls.
 */
export function ShardAllocationGridFilters({
  searchParams,
  setSearchParams,
  indices,
  shards,
  nodes,
  shardAllocationEnabled,
  enableAllocationMutation,
  disableAllocationMutation,
}: ShardAllocationGridFiltersProps) {
  const SHARD_STATES = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;
  const selectedStatesParam = searchParams.get('shardStates');
  const selectedShardStates = selectedStatesParam
    ? selectedStatesParam.split(',').filter(Boolean)
    : [...SHARD_STATES];

  const searchQuery = searchParams.get('overviewSearch') || '';
  const showClosed = searchParams.get('showClosed') === 'true';
  const showSpecial = searchParams.get('showSpecial') === 'true';
  const expandedView = searchParams.get('overviewExpanded') === 'true';
  const showOnlyAffected = searchParams.get('overviewAffected') === 'true';

  const unassignedShards = shards.filter((s: ShardInfo) => s.state === 'UNASSIGNED');

  const updateParam = (key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '' || value === false) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    setSearchParams(newParams);
  };

  const updateShardStates = (states: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (states.length === SHARD_STATES.length) {
      newParams.delete('shardStates');
    } else if (states.length > 0) {
      newParams.set('shardStates', states.join(','));
    } else {
      newParams.set('shardStates', SHARD_STATES[0]);
    }
    setSearchParams(newParams);
  };

  return (
    <Group gap="xs" wrap="nowrap" justify="space-between">
      {/* Left: Allocation control */}
      <Group gap="xs" wrap="nowrap">
        {shardAllocationEnabled ? (
          <Menu position="bottom" withArrow withinPortal>
            <Menu.Target>
              <ActionIcon
                size="md"
                variant="subtle"
                color="green"
                loading={disableAllocationMutation.isPending}
              >
                <IconLockOpen size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => disableAllocationMutation.mutate('none')}>
                <Group gap="xs">
                  <IconLock size={14} />
                  <Text size="sm">All</Text>
                </Group>
              </Menu.Item>
              <Menu.Item onClick={() => disableAllocationMutation.mutate('primaries')}>
                <Group gap="xs">
                  <IconLock size={14} />
                  <Text size="sm">Primaries only</Text>
                </Group>
              </Menu.Item>
              <Menu.Item onClick={() => disableAllocationMutation.mutate('new_primaries')}>
                <Group gap="xs">
                  <IconLock size={14} />
                  <Text size="sm">New primaries only</Text>
                </Group>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Tooltip label="Enable shard allocation">
            <ActionIcon
              size="md"
              variant="subtle"
              color="red"
              onClick={() => enableAllocationMutation.mutate()}
              loading={enableAllocationMutation.isPending}
            >
              <IconLock size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* Center: Search and filters */}
      <Group gap="xs" style={{ flex: 1 }} wrap="wrap">
        <TextInput
          placeholder="Filter indices..."
          leftSection={<IconSearch size={14} />}
          value={searchQuery}
          onChange={(e) => updateParam('overviewSearch', e.currentTarget.value)}
          style={{ minWidth: 200, maxWidth: 300 }}
          size="xs"
        />

        <ShardStateFilterToggle
          states={Array.from(SHARD_STATES)}
          selectedStates={selectedShardStates}
          onToggle={(state: string) => {
            const newStates = selectedShardStates.includes(state)
              ? selectedShardStates.filter((s: string) => s !== state)
              : [...selectedShardStates, state];
            updateShardStates(newStates);
          }}
        />

        <Checkbox
          label={`closed (${indices.filter((i: IndexInfo) => i.status !== 'open').length})`}
          checked={showClosed}
          onChange={(e) => updateParam('showClosed', e.currentTarget.checked)}
          size="xs"
        />

        <Group
          gap={4}
          style={{
            cursor: 'pointer',
            opacity: showSpecial ? 1 : 0.5,
            transition: 'opacity 150ms ease',
          }}
          onClick={() => updateParam('showSpecial', !showSpecial)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              updateParam('showSpecial', !showSpecial);
            }
          }}
        >
          <IconEyeOff size={16} color="var(--mantine-color-violet-6)" />
          <Text size="xs">special ({indices.filter((i: IndexInfo) => i.name.startsWith('.')).length})</Text>
        </Group>

        {unassignedShards.length > 0 && (
          <Group
            gap={4}
            style={{
              cursor: 'pointer',
              opacity: showOnlyAffected ? 1 : 0.5,
              transition: 'opacity 150ms ease',
            }}
            onClick={() => updateParam('overviewAffected', !showOnlyAffected)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                updateParam('overviewAffected', !showOnlyAffected);
              }
            }}
          >
            <IconAlertCircle size={16} color="var(--mantine-color-red-6)" />
            <Text size="xs">affected ({unassignedShards.length})</Text>
          </Group>
        )}
      </Group>

      {/* Right: Stats */}
      <Group gap="xs" wrap="nowrap">
        <Text size="xs">
          <Text component="span" fw={600}>{nodes.filter((n: NodeInfo) => n.roles.includes('data')).length}</Text> nodes
        </Text>
        <Text size="xs">
          <Text component="span" fw={600}>{indices.length}</Text> indices
        </Text>
        <Text size="xs">
          <Text component="span" fw={600}>{shards.length}</Text> shards
        </Text>
        {unassignedShards.length > 0 && (
          <Badge color="red" variant="filled" size="sm">
            {unassignedShards.length} unassigned
          </Badge>
        )}
      </Group>
    </Group>
  );
}
