import type { ReactElement } from 'react';
import { Badge, Button, Group, Menu, Stack, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { ClusterStatistics } from '../../components/ClusterStatistics/ClusterStatistics';
import type { NodeInfo, IndexInfo } from '../../types/api';
import type { ClusterStats } from '../../types/api';
import type { DataPoint } from '../../hooks/useSparklineData';

interface StatisticsViewProps {
  clusterInfo: { metrics_source?: 'prometheus' | 'internal' | string } | null;
  isPrometheus: boolean;
  metricsLoading?: boolean;
  timeRangeDropdownOpened: boolean;
  setTimeRangeDropdownOpened: (open: boolean) => void;
  selectedTimeRange: { minutes: number; label: string } | null;
  TIME_RANGE_PRESETS: { minutes: number; label: string }[];
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void;
  nodesHistory: DataPoint[];
  cpuHistory: DataPoint[];
  cpuSeries: { name: string; data: DataPoint[]; labels: Record<string, string> }[];
  memoryHistory: DataPoint[];
  memorySeries: { name: string; data: DataPoint[]; labels: Record<string, string> }[];
  indicesHistory: DataPoint[];
  documentsHistory: DataPoint[];
  shardsHistory: DataPoint[];
  unassignedHistory: DataPoint[];
  diskUsageHistory: DataPoint[];
  stats: ClusterStats | undefined;
  allNodesArray: NodeInfo[];
  prometheusQueries: Record<string, string> | undefined;
  showHiddenIndices: boolean;
  setShowHiddenIndices: (value: boolean) => void;
  hiddenIndicesCount: number;
  allIndicesArray: IndexInfo[] | undefined;
}

export function StatisticsView(props: StatisticsViewProps): ReactElement {
  const {
    clusterInfo,
    isPrometheus,
    metricsLoading,
    timeRangeDropdownOpened,
    setTimeRangeDropdownOpened,
    selectedTimeRange,
    TIME_RANGE_PRESETS,
    searchParams,
    setSearchParams,
    nodesHistory,
    cpuHistory,
    cpuSeries,
    memoryHistory,
    memorySeries,
    indicesHistory,
    documentsHistory,
    shardsHistory,
    unassignedHistory,
    diskUsageHistory,
    stats,
    allNodesArray,
    prometheusQueries,
    showHiddenIndices,
    setShowHiddenIndices,
    hiddenIndicesCount,
    allIndicesArray,
  } = props;

  return (
    <Stack gap="md">
      {/* Time Range Dropdown - Top Right */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Text size="sm" fw={500}>
            Cluster Statistics
          </Text>
          <Badge
            size="sm"
            variant="light"
            color={clusterInfo?.metrics_source === 'prometheus' ? 'blue' : 'green'}
          >
            {clusterInfo?.metrics_source === 'prometheus' ? 'Prometheus' : 'Internal'}
          </Badge>
        </Group>
        {/* Only show time range selector for Prometheus metrics */}
        {isPrometheus && (
          <Menu
            opened={timeRangeDropdownOpened}
            onChange={setTimeRangeDropdownOpened}
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
                aria-label="Select time range"
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
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('timeRange', preset.minutes.toString());
                    setSearchParams(newParams, { replace: true });
                    setTimeRangeDropdownOpened(false);
                  }}
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
        )}
      </Group>

      <ClusterStatistics
        nodesHistory={nodesHistory}
        cpuHistory={cpuHistory}
        cpuSeries={cpuSeries}
        memoryHistory={memoryHistory}
        memorySeries={memorySeries}
        indicesHistory={indicesHistory}
        documentsHistory={documentsHistory}
        shardsHistory={shardsHistory}
        unassignedHistory={unassignedHistory}
        diskUsageHistory={diskUsageHistory}
        stats={stats}
        nodes={allNodesArray}
        prometheusQueries={prometheusQueries}
        showHiddenIndices={showHiddenIndices}
        onToggleHiddenIndices={setShowHiddenIndices}
        hiddenIndicesCount={hiddenIndicesCount}
        allIndices={allIndicesArray}
        metricsLoading={metricsLoading}
      />
    </Stack>
  );
}
