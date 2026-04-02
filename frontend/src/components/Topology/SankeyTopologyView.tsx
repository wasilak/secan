import type { ReactElement, FunctionComponent } from 'react';
import { Alert, Badge, Group, NumberInput, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle, IconRefresh } from '@tabler/icons-react';
import { ResponsiveSankey } from '@nivo/sankey';
import type { DefaultNode, DefaultLink, SankeyNodeDatum, SankeyLinkDatum } from '@nivo/sankey';
import { useSankeyData } from '../../hooks/useSankeyData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SankeyNodeExtra extends DefaultNode {
  kind: 'index' | 'node' | 'unassigned';
  totalShards: number;
  primaryShards: number;
  replicaShards: number;
  storeBytes: number;
}

interface SankeyLinkExtra extends DefaultLink {
  primaryShards: number;
  replicaShards: number;
}

export interface SankeyTopologyViewProps {
  clusterId: string;
  selectedShardStates: string[];
  topIndices: number;
  onTopIndicesChange: (n: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a CSS custom property to its computed value so nivo (SVG) can
 * use it as a concrete color string.
 */
function resolveCSSVar(variable: string): string {
  if (typeof document !== 'undefined') {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
    if (val) return val;
  }
  return '#888888';
}

function nodeColor(kind: 'index' | 'node' | 'unassigned'): string {
  switch (kind) {
    case 'index':
      return resolveCSSVar('--mantine-color-blue-6');
    case 'node':
      return resolveCSSVar('--mantine-color-teal-6');
    case 'unassigned':
      return resolveCSSVar('--mantine-color-red-6');
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Tooltip components
// ---------------------------------------------------------------------------

const NodeTooltip: FunctionComponent<{
  node: SankeyNodeDatum<SankeyNodeExtra, SankeyLinkExtra>;
}> = ({ node }) => (
  <Paper shadow="sm" p="xs" withBorder style={{ minWidth: 180 }}>
    <Stack gap={4}>
      <Group gap={6}>
        <Badge size="xs" color={node.kind === 'index' ? 'blue' : node.kind === 'node' ? 'teal' : 'red'}>
          {node.kind}
        </Badge>
        <Text size="xs" fw={600} style={{ wordBreak: 'break-all' }}>
          {node.id}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        Total shards: <strong>{node.totalShards}</strong>
      </Text>
      <Text size="xs" c="dimmed">
        Primary: <strong>{node.primaryShards}</strong> · Replica: <strong>{node.replicaShards}</strong>
      </Text>
      {node.storeBytes > 0 && (
        <Text size="xs" c="dimmed">
          Store: <strong>{formatBytes(node.storeBytes)}</strong>
        </Text>
      )}
    </Stack>
  </Paper>
);

const LinkTooltip: FunctionComponent<{
  link: SankeyLinkDatum<SankeyNodeExtra, SankeyLinkExtra>;
}> = ({ link }) => (
  <Paper shadow="sm" p="xs" withBorder style={{ minWidth: 200 }}>
    <Stack gap={4}>
      <Text size="xs" fw={600}>
        {link.source.id} → {link.target.id}
      </Text>
      <Text size="xs" c="dimmed">
        Total shards: <strong>{link.value}</strong>
      </Text>
      <Text size="xs" c="dimmed">
        Primary: <strong>{link.primaryShards}</strong> · Replica: <strong>{link.replicaShards}</strong>
      </Text>
    </Stack>
  </Paper>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SankeyTopologyView(props: SankeyTopologyViewProps): ReactElement {
  const { clusterId, selectedShardStates, topIndices, onTopIndicesChange } = props;

  const { data, loading, error, refetch } = useSankeyData({
    clusterId,
    topIndices,
    includeUnassigned: true,
    states: selectedShardStates.length > 0 ? selectedShardStates : undefined,
  });

  // ---- Loading state ----
  if (loading && data === null) {
    return <Skeleton height={400} radius="sm" />;
  }

  // ---- Error state ----
  if (error) {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle size={18} />}
        title="Failed to load Sankey data"
        variant="light"
      >
        <Group mt="xs">
          <Text size="sm">{error instanceof Error ? error.message : 'Unknown error'}</Text>
          <Badge
            component="button"
            style={{ cursor: 'pointer' }}
            color="red"
            variant="outline"
            leftSection={<IconRefresh size={12} />}
            onClick={refetch}
          >
            Retry
          </Badge>
        </Group>
      </Alert>
    );
  }

  // ---- Empty state ----
  if (!data || data.nodes.length === 0) {
    return (
      <Stack align="center" justify="center" style={{ height: 400 }}>
        <IconInfoCircle size={32} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="sm">
          No shard data available
        </Text>
      </Stack>
    );
  }

  // ---- Map to nivo format ----
  const nivoNodes: SankeyNodeExtra[] = data.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    totalShards: n.totalShards,
    primaryShards: n.primaryShards,
    replicaShards: n.replicaShards,
    storeBytes: n.storeBytes,
  }));

  const nivoLinks: SankeyLinkExtra[] = data.links.map((l) => ({
    source: l.source,
    target: l.target,
    value: l.totalShards,
    primaryShards: l.primaryShards,
    replicaShards: l.replicaShards,
  }));

  return (
    <Stack gap="sm">
      {/* Truncation warning */}
      {data.meta.truncated && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={18} />}
          title="Large cluster — showing top indices only"
          variant="light"
        >
          <Group gap="md" align="flex-end">
            <Text size="sm">
              Showing <strong>{data.meta.displayedIndices}</strong> of{' '}
              <strong>{data.meta.totalIndices}</strong> indices. Adjust the limit:
            </Text>
            <NumberInput
              size="xs"
              min={5}
              max={200}
              step={10}
              value={topIndices}
              onChange={(val) => {
                if (typeof val === 'number') onTopIndicesChange(val);
              }}
              style={{ width: 80 }}
            />
          </Group>
        </Alert>
      )}

      {/* Sankey diagram */}
      <div style={{ height: 500 }}>
        <ResponsiveSankey<SankeyNodeExtra, SankeyLinkExtra>
          data={{ nodes: nivoNodes, links: nivoLinks }}
          margin={{ top: 16, right: 160, bottom: 16, left: 200 }}
          align="justify"
          colors={(node) => nodeColor(node.kind)}
          nodeOpacity={0.9}
          nodeHoverOpacity={1}
          nodeHoverOthersOpacity={0.15}
          nodeThickness={18}
          nodeSpacing={12}
          nodeBorderWidth={0}
          nodeBorderRadius={2}
          nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
          linkOpacity={0.3}
          linkHoverOpacity={0.6}
          linkHoverOthersOpacity={0.15}
          linkBlendMode="normal"
          enableLinkGradient
          labelPosition="outside"
          labelPadding={8}
          labelOrientation="horizontal"
          labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
          nodeTooltip={NodeTooltip}
          linkTooltip={LinkTooltip}
        />
      </div>
    </Stack>
  );
}
