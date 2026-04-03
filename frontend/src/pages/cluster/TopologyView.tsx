import type { ReactElement } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Grid, Group, Modal, NumberInput, Select, Stack, Tabs, Text } from '@mantine/core';
import { useState } from 'react';
import { IconArrowsRightLeft, IconCheck, IconEyeOff } from '@tabler/icons-react';
import { FilterSidebar } from '../../components/FacetedFilter';
import { TopologyStatsCards } from '../../components/TopologyStatsCards';
import { DotBasedTopologyView } from '../../components/Topology/DotBasedTopologyView';
import { CanvasTopologyView } from '../../components/Topology/CanvasTopologyView';
import { SankeyTopologyView } from '../../components/Topology/SankeyTopologyView';
import { DiskTreemapView } from '../../components/Topology/DiskTreemapView';
import { useRefreshActions } from '../../contexts/RefreshContext';
import { useCallback } from 'react';
import { ShardAllocationGrid } from '../../components/Topology/ShardAllocationGrid';
import { ShardContextMenu } from '../../components/ShardContextMenu';
import type { GroupingAttribute, GroupingConfig } from '../../utils/topologyGrouping';
import type { ModalData } from '../../hooks/useModalStack';
import { extractLabelFromTag } from '../../utils/topologyGrouping';
import { SHARD_STATE_COLORS, getShardTypeColor } from '../../utils/colors';
import type { NodeInfo, ShardInfo, IndexInfo, NodeShardSummary } from '../../types/api';
import { GroupingControl } from '../../components/Topology/GroupingControl';

interface TopologyViewProps {
  clusterId: string;
  allNodesArray: NodeInfo[];
  allIndicesArray: IndexInfo[] | undefined;
  allShards: ShardInfo[] | undefined;
  /** Per-node shard count summary for the canvas view (no full ShardInfo objects). */
  shardSummary?: NodeShardSummary[];
  /** Pre-computed, filter-aware stats for the stats cards. Zoom-independent. */
  statsNodeCount: number;
  statsIndexCount: number;
  statsShardCount: number;
  statsPrimaryCount: number;
  statsReplicaCount: number;
  statsUnassignedCount: number;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void;
  topologyViewType: 'node' | 'index' | 'canvas' | 'sankey' | 'disk';
  setTopologyViewType: (value: 'node' | 'index' | 'canvas' | 'sankey' | 'disk') => void;
  topologyGroupingConfig: GroupingConfig;
  handleTopologyGroupingChange: (attribute: GroupingAttribute, tagValue?: string) => void;
  indexNameFilter: string;
  nodeNameFilter: string;
  setIndexNameFilter: (value: string) => void;
  setNodeNameFilter: (value: string) => void;
  selectedShardStates: string[];
  matchesWildcard: (text: string, pattern: string) => boolean;
  /** Whether to show dot-prefixed (special) indices. Forwarded to CanvasTopologyView. */
  showSpecialIndices: boolean;
  nodesLoading: boolean;
  allIndicesLoading: boolean;
  allShardsLoading: boolean;
  nodesError: unknown;
  allIndicesError: unknown;
  allShardsError: unknown;
  relocationMode: boolean;
  validDestinationNodes: string[];
  relocationSourceNode: NodeInfo | null;
  relocationDestinationNode: NodeInfo | null;
  relocationConfirmOpened: boolean;
  relocationShard: ShardInfo | null;
  relocationInProgress: boolean;
  topologyContextMenuShard: ShardInfo | null;
  topologyContextMenuPosition: { x: number; y: number };
  topologyContextMenuOpened: boolean;
  handleTopologyCancelRelocation: () => void;
  handleTopologyDestinationClick: (nodeId: string) => void;
  handleTopologyShardClick: (shard: ShardInfo, event?: React.MouseEvent) => void;
  handleTopologyContextMenuClose: () => void;
  handleTopologySelectForRelocation: (shard: ShardInfo) => void;
  openIndexModal: (indexName: string) => void;
  openNodeModal: (nodeId: string) => void;
  pushModal: (modal: ModalData) => void;
  setRelocationConfirmOpened: (open: boolean) => void;
  handleTopologyConfirmRelocation: () => void;
  /**
   * Called when the canvas zoom crosses the L2 threshold (0.7).
   * Used by ClusterView to gate the expensive per-node shard fetching.
   */
  onZoomChange?: (zoom: number) => void;
}

export function TopologyView(props: TopologyViewProps): ReactElement {
  const { pausePolling, resumePolling } = useRefreshActions();
  const [sankeyTopIndices, setSankeyTopIndices] = useState<number>(10);
  const [pendingSankeyTopIndices, setPendingSankeyTopIndices] = useState<number>(10);
  const [sankeySortBy, setSankeySortBy] = useState<'shards' | 'primary' | 'replicas' | 'store'>('shards');

  // Use useCallback for stable refs
  const handleNodeDragStart = useCallback(() => { pausePolling('drag'); }, [pausePolling]);
  const handleNodeDragStop = useCallback(() => { resumePolling('drag'); }, [resumePolling]);
  const {
    clusterId,
    allNodesArray,
    allIndicesArray,
    allShards,
    shardSummary,
    statsNodeCount,
    statsIndexCount,
    statsShardCount,
    statsPrimaryCount,
    statsReplicaCount,
    statsUnassignedCount,
    searchParams,
    setSearchParams,
    topologyViewType,
    setTopologyViewType,
    topologyGroupingConfig,
    indexNameFilter,
    nodeNameFilter,
    setIndexNameFilter,
    setNodeNameFilter,
    selectedShardStates,
    matchesWildcard,
    showSpecialIndices,
    nodesLoading,
    allIndicesLoading,
    allShardsLoading,
    nodesError,
    allIndicesError,
    allShardsError,
    relocationMode,
    validDestinationNodes,
    relocationSourceNode,
    relocationDestinationNode,
    relocationConfirmOpened,
    relocationShard,
    relocationInProgress,
    topologyContextMenuShard,
    topologyContextMenuPosition,
    topologyContextMenuOpened,
    handleTopologyCancelRelocation,
    handleTopologyDestinationClick,
    handleTopologyShardClick,
    handleTopologyContextMenuClose,
    handleTopologySelectForRelocation,
    openIndexModal,
    openNodeModal,
    pushModal,
    setRelocationConfirmOpened,
    handleTopologyConfirmRelocation,
    onZoomChange,
  } = props;

  const labelTags = Array.from(
    new Set(
      allNodesArray.flatMap((node) => node.tags ?? [])
    )
  );

  const availableLabels = labelTags
    .map((tag) => {
      const { name } = extractLabelFromTag(tag);
      return { name, tag };
    })
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      return nameCompare !== 0 ? nameCompare : a.tag.localeCompare(b.tag);
    });

  return (
    <Grid gutter="md" overflow="hidden">
      {/* Stats Row */}
      <Grid.Col span={12}>
        <TopologyStatsCards
          nodeCount={statsNodeCount}
          indexCount={statsIndexCount}
          shardCount={statsShardCount}
          primaryCount={statsPrimaryCount}
          replicaCount={statsReplicaCount}
          unassignedCount={statsUnassignedCount}
        />
      </Grid.Col>

      <Grid.Col span={12}>
        <Group gap="md" wrap="nowrap" align="flex-start">
          {/* Filter Sidebar */}
          <FilterSidebar
            textFilters={[
              { value: indexNameFilter, onChange: setIndexNameFilter, placeholder: 'Filter indices...' },
              { value: nodeNameFilter, onChange: setNodeNameFilter, placeholder: 'Filter nodes...' },
            ]}
            categories={[
              {
                title: 'State',
                options: [
                  { label: 'Started', value: 'STARTED', color: SHARD_STATE_COLORS.STARTED },
                  { label: 'Unassigned', value: 'UNASSIGNED', color: SHARD_STATE_COLORS.UNASSIGNED },
                  { label: 'Initializing', value: 'INITIALIZING', color: SHARD_STATE_COLORS.INITIALIZING },
                  { label: 'Relocating', value: 'RELOCATING', color: SHARD_STATE_COLORS.RELOCATING },
                ],
                selected: selectedShardStates,
                onChange: (newStates) => {
                  const params = new URLSearchParams(searchParams);
                  if (newStates.length === 4) {
                    params.delete('shardStates');
                  } else if (newStates.length > 0) {
                    params.set('shardStates', newStates.join(','));
                  }
                  setSearchParams(params, { replace: true });
                },
              },
            ]}
            conditionalSections={[
               {
                visible: topologyViewType === 'sankey',
                content: (() => {
                  const maxIndices = statsIndexCount > 0 ? statsIndexCount : undefined;
                  const ratio = maxIndices && maxIndices > 0 ? pendingSankeyTopIndices / maxIndices : 0;
                  const borderColor =
                    ratio >= 0.85
                      ? 'var(--mantine-color-orange-7)'
                      : ratio >= 0.65
                        ? 'var(--mantine-color-orange-5)'
                        : ratio >= 0.4
                          ? 'var(--mantine-color-orange-3)'
                          : undefined;
                  return (
                    <NumberInput
                      label="Top indices limit"
                      description="Number of top indices to display"
                      size="xs"
                      min={0}
                      max={maxIndices}
                      step={5}
                      value={pendingSankeyTopIndices}
                      onChange={(val) => {
                        if (typeof val === 'number') setPendingSankeyTopIndices(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && pendingSankeyTopIndices !== sankeyTopIndices) {
                          setSankeyTopIndices(pendingSankeyTopIndices);
                        }
                      }}
                      styles={borderColor ? { input: { borderColor, borderWidth: 2 } } : undefined}
                      rightSection={
                        <ActionIcon
                          variant="transparent"
                          color="blue"
                          size="sm"
                          onClick={() => setSankeyTopIndices(pendingSankeyTopIndices)}
                          aria-label="Apply top indices limit"
                          style={{
                            opacity: pendingSankeyTopIndices !== sankeyTopIndices ? 1 : 0.2,
                            cursor: pendingSankeyTopIndices !== sankeyTopIndices ? 'pointer' : 'default',
                            pointerEvents: pendingSankeyTopIndices !== sankeyTopIndices ? 'all' : 'none',
                          }}
                        >
                          <IconCheck size={13} />
                        </ActionIcon>
                      }
                      rightSectionWidth={32}
                    />
                  );
                })(),
              },
              {
                visible: topologyViewType === 'sankey',
                content: (
                  <Select
                    label="Rank by"
                    description="Criterion for selecting top indices"
                    size="xs"
                    value={sankeySortBy}
                    onChange={(val) => {
                      if (val) setSankeySortBy(val as typeof sankeySortBy);
                    }}
                    data={[
                      { value: 'shards', label: 'Total shards' },
                      { value: 'primary', label: 'Primary shards' },
                      { value: 'replicas', label: 'Replica count' },
                      { value: 'store', label: 'Store size' },
                    ]}
                    allowDeselect={false}
                  />
                ),
              },
            ]}
            rightSection={
              topologyViewType === 'node' || topologyViewType === 'canvas' ? (
                <GroupingControl
                  currentGrouping={topologyGroupingConfig.attribute}
                  currentGroupingValue={topologyGroupingConfig.value}
                  availableLabels={availableLabels}
                  onGroupingChange={props.handleTopologyGroupingChange}
                />
              ) : null
            }
            toggles={[
              {
                label: 'Show special indices',
                value: searchParams.get('showSpecial') === 'true',
                onChange: (val) => {
                  const params = new URLSearchParams(searchParams);
                  if (val) {
                    params.set('showSpecial', 'true');
                  } else {
                    params.delete('showSpecial');
                  }
                  setSearchParams(params, { replace: true });
                },
                icon: <IconEyeOff size={16} />,
              },
            ]}
          />

            {/* View Content */}
          <Stack gap="md" style={{ flex: 1 }}>
            {/* View type tabs (right column header row) */}
            <Group justify="space-between" align="flex-end">
              <Tabs
                value={topologyViewType}
                onChange={(value) => setTopologyViewType(value as 'node' | 'index' | 'canvas' | 'sankey' | 'disk')}
              >
                <Tabs.List>
                  <Tabs.Tab value="node">Node Overview</Tabs.Tab>
                  <Tabs.Tab value="index">Shard Grid</Tabs.Tab>
                  <Tabs.Tab value="canvas">Cluster Map</Tabs.Tab>
                  <Tabs.Tab value="sankey">Shard Flow</Tabs.Tab>
                  <Tabs.Tab value="disk">Disk Usage</Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </Group>
            {/* Relocation Banner */}
            {relocationMode && relocationShard && (
              <Alert
                color="violet"
                variant="light"
                icon={<IconArrowsRightLeft size={20} />}
                title="Relocation Mode"
              >
                <Group justify="space-between">
                  <Text size="sm">
                    <Text component="span" fw={600}>
                      Select destination for shard {relocationShard.shard}
                    </Text>
                    {relocationShard.primary ? ' (Primary)' : ' (Replica)'} of index "{relocationShard.index}". Purple
                    dashed boxes show valid destinations.
                  </Text>
                  <Button
                    size="xs"
                    color="red"
                    variant="filled"
                    onClick={handleTopologyCancelRelocation}
                    disabled={relocationInProgress}
                  >
                    Cancel Relocation
                  </Button>
                </Group>
              </Alert>
            )}

            {/* View */}
            {topologyViewType === 'node' ? (
              <DotBasedTopologyView
                nodes={allNodesArray}
                shards={allShards || []}
                indices={allIndicesArray || []}
                searchParams={searchParams}
                onShardClick={handleTopologyShardClick}
                onNodeClick={openNodeModal}
                relocationMode={relocationMode}
                validDestinationNodes={validDestinationNodes}
                onDestinationClick={handleTopologyDestinationClick}
                indexNameFilter={indexNameFilter}
                nodeNameFilter={nodeNameFilter}
                matchesWildcard={matchesWildcard}
                clusterId={undefined}
                topologyBatchSize={4}
                _topologyRetryCount={0}
                isLoading={nodesLoading || allIndicesLoading || allShardsLoading}
                groupingConfig={topologyGroupingConfig}
              />
            ) : topologyViewType === 'canvas' ? (
              <CanvasTopologyView
                nodes={allNodesArray}
                shardSummary={shardSummary ?? []}
                allShards={allShards}
                indices={allIndicesArray || []}
                searchParams={searchParams}
                onShardClick={handleTopologyShardClick}
                onNodeClick={openNodeModal}
                onPaneClick={handleTopologyContextMenuClose}
                onZoomChange={onZoomChange}
                relocationMode={relocationMode}
                validDestinationNodes={validDestinationNodes}
                onDestinationClick={handleTopologyDestinationClick}
                indexNameFilter={indexNameFilter}
                nodeNameFilter={nodeNameFilter}
                selectedShardStates={selectedShardStates}
                matchesWildcard={matchesWildcard}
                showSpecialIndices={showSpecialIndices}
                isLoading={nodesLoading || allIndicesLoading || allShardsLoading}
                groupingConfig={topologyGroupingConfig}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
              />
            ) : topologyViewType === 'sankey' ? (
              <SankeyTopologyView
                clusterId={clusterId}
                selectedShardStates={selectedShardStates}
                topIndices={sankeyTopIndices}
                sortBy={sankeySortBy}
                openNodeModal={openNodeModal}
                openIndexModal={openIndexModal}
                showSpecialIndices={showSpecialIndices}
              />
            ) : topologyViewType === 'disk' ? (
              <DiskTreemapView
                indices={allIndicesArray || []}
                isLoading={allIndicesLoading}
                showSpecialIndices={showSpecialIndices}
              />
            ) : (
              <ShardAllocationGrid
                nodes={allNodesArray}
                shards={allShards || []}
                indices={allIndicesArray || []}
                loading={nodesLoading || allIndicesLoading || allShardsLoading}
                error={nodesError || allIndicesError || allShardsError}
                openIndexModal={openIndexModal}
                openNodeModal={openNodeModal}
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                sharedRelocationMode={relocationMode}
                sharedValidDestinationNodes={validDestinationNodes}
                onSharedRelocationCancel={handleTopologyCancelRelocation}
                onSharedSelectForRelocation={handleTopologySelectForRelocation}
                onSharedDestinationClick={handleTopologyDestinationClick}
                indexNameFilter={indexNameFilter}
                nodeNameFilter={nodeNameFilter}
                matchesWildcard={matchesWildcard}
                onShardClick={handleTopologyShardClick}
              />
            )}
          </Stack>
        </Group>
      </Grid.Col>

      {/* Shared Context Menu */}
          {topologyContextMenuShard && (
            <ShardContextMenu
              shard={topologyContextMenuShard}
              opened={topologyContextMenuOpened}
              position={topologyContextMenuPosition}
              onClose={handleTopologyContextMenuClose}
              onShowStats={(shard) => {
              // Include shard primary flag and node so the ShardDetailsModal can render correct header
              pushModal({
                type: 'shard',
                indexName: shard.index,
                shardId: `${shard.index}[${shard.shard}]`,
                shardPrimary: shard.primary,
                shardNode: shard.node,
              });
                handleTopologyContextMenuClose();
              }}
          onSelectForRelocation={handleTopologySelectForRelocation}
          onShowIndexDetails={(shard) => {
            openIndexModal(shard.index);
            handleTopologyContextMenuClose();
          }}
        />
      )}

      {/* Shared Confirmation Modal */}
      <Modal
        opened={relocationConfirmOpened}
        onClose={() => setRelocationConfirmOpened(false)}
        title="Confirm Shard Relocation"
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">You are about to relocate the following shard:</Text>
          <Card withBorder padding="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Index:
                </Text>
                <Text size="sm" fw={600}>
                  {relocationShard?.index}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Shard Number:
                </Text>
                <Text size="sm" fw={600}>
                  {relocationShard?.shard}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Shard Type:
                </Text>
                <Badge size="sm" color={getShardTypeColor(relocationShard?.primary ?? false)}>
                  {relocationShard?.primary ? 'Primary' : 'Replica'}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Source Node:
                </Text>
                <Text size="sm" fw={600}>
                  {relocationSourceNode?.name}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Destination Node:
                </Text>
                <Text size="sm" fw={600} c="violet">
                  {relocationDestinationNode?.name}
                </Text>
              </Group>
            </Stack>
          </Card>
          <Text size="sm" c="dimmed">
            This operation will move the shard from {relocationSourceNode?.name} to {relocationDestinationNode?.name}. The
            shard will be temporarily unavailable during relocation.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setRelocationConfirmOpened(false)}
              disabled={relocationInProgress}
            >
              Cancel
            </Button>
            <Button color="violet" onClick={handleTopologyConfirmRelocation} loading={relocationInProgress}>
              Relocate Shard
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Grid>
  );
}
