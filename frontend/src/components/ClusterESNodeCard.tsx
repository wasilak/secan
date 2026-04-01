import { Group, Text, Badge, Divider, Flex, Box, Tooltip, Skeleton } from '@mantine/core';
import ShardPills from './ShardPills';
import type { ShardInfo } from '../types/api';
import type { ClusterGroupNodeDataFlat } from '../utils/canvasLayout';
import { GROUP_WIDTH } from '../utils/canvasLayout';
import { RoleIcons } from './RoleIcons';
import type { MouseEvent, KeyboardEvent } from 'react';

/**
 * Pure Mantine node card extracted from ClusterGroupNode.
 * This component is UI-only and does not depend on React Flow.
 */
export type ClusterESNodeCardProps = ClusterGroupNodeDataFlat & { selected?: boolean; isLoading?: boolean; hideInnerBorder?: boolean };

export function ClusterESNodeCard(props: ClusterESNodeCardProps) {
  const {
    id,
    name,
    version,
    roles,
    isMaster,
    ip,
    heapPercent,
    heapColor,
    cpuPercent,
    cpuColor,
    diskDisplay,
    load1m,
    loadColor,
    groupLabel,
    isValidDestination,
    summaryCounts,
    dots = [],
    renderDots = true,
    onShardClick,
    onNodeClick,
    onDestinationClick,
    selected,
    isLoading,
    hideInnerBorder,
  } = props;
  // Card-level destination click (used for relocation) should remain
  // clickable when a destination handler is provided. Node-details modal
  // must open only when clicking the node name below.
  const isDestinationClickable = !!isValidDestination && !!onDestinationClick;
  

  // Ensure summaryCounts is present — its absence is a caller bug and should fail loudly
  if (!summaryCounts) {
     
    console.error('ClusterESNodeCard rendered without summaryCounts', { id, name });
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Missing summaryCounts for node ${id ?? name}`);
    }
    // In production, render a minimal fallback UI instead of throwing to avoid crashing the whole app
    // Render simple fallback card
    return (
      <div className="secan-cluster-node-card"
        style={{
          width: GROUP_WIDTH,
          minWidth: GROUP_WIDTH,
          boxSizing: 'border-box',
          borderRadius: 8,
          padding: '10px 12px 8px',
          backgroundColor: selected ? 'var(--mantine-color-blue-light)' : 'var(--mantine-color-body)',
          cursor: isDestinationClickable ? 'pointer' : 'default',
          opacity: isLoading ? 0.6 : 1,
          border: hideInnerBorder ? 'none' : (isValidDestination ? '2px dashed var(--mantine-color-violet-6)' : '1px solid var(--mantine-color-default-border)'),
        }}
      >
        <Group gap="xs" wrap="nowrap" justify="space-between" mb={4}>
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Text
              fw={500}
              size="sm"
              className="clickable-name"
              role={onNodeClick ? 'button' : undefined}
              tabIndex={onNodeClick ? 0 : undefined}
              aria-label={onNodeClick ? `Open node details ${name}` : undefined}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                if (onNodeClick) onNodeClick(id);
              }}
              onContextMenu={(e: MouseEvent) => {
                // Support right-click to open node details like left-click
                e.preventDefault();
                e.stopPropagation();
                if (onNodeClick) onNodeClick(id);
              }}
              onKeyDown={(e: KeyboardEvent) => {
                if (!onNodeClick) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onNodeClick(id);
                }
              }}
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: onNodeClick ? 'pointer' : undefined }}
            >
              <span style={{ textTransform: 'none' }}>{name}</span>
            </Text>
            {version && (
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                v{version}
              </Text>
            )}
          </Group>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {isMaster && (
              <Badge size="xs" variant="filled" color="blue">M</Badge>
            )}
            <RoleIcons roles={roles ?? []} size={13} />
          </Group>

        </Group>

        <Text size="xs" c="dimmed" fw={500} mb={2}>Missing shard summary</Text>
      </div>
    );
  }
  const sc = summaryCounts;

    return (
    <div className="secan-cluster-node-card"
      style={{
        // Allow the outer RF node container to size itself from this element
        // while keeping this card's borders fully visible. Use minWidth only
        // so the card can grow if RF or container sizing requires it.
        // Allow the card to expand to fit the full name + badges/icons when needed.
        // The RF wrapper will measure and nudge collisions accordingly. Use a
        // flexible minWidth so long names don't get truncated.
        minWidth: GROUP_WIDTH,
        // allow the inner card to grow beyond GROUP_WIDTH up to measured width
        width: 'auto',
        boxSizing: 'border-box',
        borderRadius: 8,
        padding: '10px 12px 8px',
        backgroundColor: selected
          ? 'var(--mantine-color-blue-light)'
          : 'var(--mantine-color-body)',
        cursor: isDestinationClickable ? 'pointer' : 'default',
        opacity: isLoading ? 0.6 : 1,
        border: hideInnerBorder ? 'none' : (isValidDestination ? '2px dashed var(--mantine-color-violet-6)' : '1px solid var(--mantine-color-default-border)'),
      }}
      onClick={() => {
        if (isDestinationClickable && onDestinationClick) {
          onDestinationClick(id);
        }
      }}
    >
      <Group gap="xs" wrap="nowrap" justify="space-between" mb={4}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text
            fw={500}
            size="sm"
            className="clickable-name"
            role={onNodeClick ? 'button' : undefined}
            tabIndex={onNodeClick ? 0 : undefined}
            aria-label={onNodeClick ? `Open node details ${name}` : undefined}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              if (onNodeClick) onNodeClick(id);
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (!onNodeClick) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onNodeClick(id);
              }
            }}
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: onNodeClick ? 'pointer' : undefined }}
          >
            <span style={{ textTransform: 'none' }}>{name}</span>
          </Text>
          {version && (
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              v{version}
            </Text>
          )}
        </Group>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {isMaster && (
            <Badge size="xs" variant="filled" color="blue">M</Badge>
          )}
          <RoleIcons roles={roles ?? []} size={13} />
        </Group>
      </Group>

      {groupLabel && (
        <Text size="xs" c="dimmed" fw={500} mb={2}>{groupLabel}</Text>
      )}

      {/* Metrics: hide heap/disk for unassigned bucket entirely */}
      {!props.isUnassigned && (
        <Flex gap="xs" wrap="wrap" mb={6}>
          {ip && <Text size="xs" c="dimmed">IP: {ip}</Text>}
          {cpuPercent !== undefined && (
            <Text size="xs" c={cpuColor}>CPU: {cpuPercent.toFixed(1)}%</Text>
          )}
          <Text size="xs" c={heapColor}>Heap: {typeof heapPercent === 'number' && !isNaN(heapPercent) ? `${heapPercent.toFixed(1)}%` : 'N/A'}</Text>
          <Text size="xs" c="dimmed">Disk: {diskDisplay}</Text>
          {load1m !== undefined && (
            <Text size="xs" c={loadColor}>Load: {load1m.toFixed(2)}</Text>
          )}
        </Flex>
      )}

      <Divider mb={6} />

        {/* If the node/card is currently loading shard details, show a small
            in-card skeleton for the shard area to avoid layout flashes and to
            communicate loading state. Otherwise render real shard dots when
            available. */}
        {isLoading ? (
          <Flex gap={3} wrap="wrap" mb={6}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} width={14} height={14} radius="sm" />
            ))}
          </Flex>
        ) : (
          renderDots !== false && dots.length > 0 && (
            <Flex gap={3} wrap="wrap" mb={6}>
              {dots.map((dot, idx) => (
                <Tooltip
                  key={idx}
                  label={dot.tooltip}
                  withArrow
                  withinPortal
                >
                  <Box
                    className="secan-shard-dot"
                    style={{
                      width: 14,
                      height: 14,
                      backgroundColor: dot.color,
                      borderRadius: 2,
                      opacity: dot.primary ? 1 : 0.5,
                      boxShadow: dot.primary ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                      flexShrink: 0,
                      cursor: onShardClick ? 'pointer' : 'default',
                    }}
                    onClick={(e: MouseEvent) => {
                      if (onShardClick) {
                        e.stopPropagation();
                        onShardClick(dot.shard as ShardInfo, e);
                      }
                    }}
                    onContextMenu={(e: MouseEvent) => {
                      // Right-click should also open the shard context menu
                      if (onShardClick) {
                        e.preventDefault();
                        e.stopPropagation();
                        onShardClick(dot.shard as ShardInfo, e);
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              ))}
            </Flex>
          )
        )}

      {/*
        Avoid rendering a misleading "0 shards" pill when no shard details are
        available. Show shard pills only when there is at least one shard or the
        caller explicitly disables suppression.
      */}
      {/* Render totals pill when available, but if we are loading show a
          lightweight skeleton in its place so users know counts are being
          fetched. We still avoid rendering a misleading "0 shards" pill when
          suppression is requested. */}
      {isLoading ? (
        <Skeleton width={80} height={16} />
      ) : (
        !props.suppressShardSummary && sc.total > 0 && (
          <ShardPills total={sc.total} primary={sc.primary} replica={sc.replica} size="xs" />
        )
      )}
    </div>
  );
}

export default ClusterESNodeCard;
