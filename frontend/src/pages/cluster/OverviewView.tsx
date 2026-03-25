import type { ReactElement } from 'react';
import { Card, Grid, Group, Stack, Text } from '@mantine/core';
import { Sparkline } from '../../components/Sparkline';
import { ProgressWithLabel } from '../../components/ProgressWithLabel';
import { formatBytes, formatPercentRatio } from '../../utils/formatters';
import type { ClusterStats } from '../../types/api';

interface OverviewViewProps {
  clusterName: string | null;
  stats: ClusterStats | undefined;
  nodesHistoryNumbers: number[];
  indicesHistoryNumbers: number[];
  documentsHistoryNumbers: number[];
  shardsHistoryNumbers: number[];
  unassignedHistoryNumbers: number[];
  handleTabChange: (view: string) => void;
  getColor: (value: number) => string;
}

export function OverviewView({
  stats,
  nodesHistoryNumbers,
  indicesHistoryNumbers,
  documentsHistoryNumbers,
  shardsHistoryNumbers,
  unassignedHistoryNumbers,
  handleTabChange,
  getColor,
}: OverviewViewProps): ReactElement {
  return (
    <Stack gap="md">
      {/* First Row: Nodes, Indices, Shards */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
          <Card
            shadow="sm"
            padding="md"
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleTabChange('nodes')}
          >
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed">
                    Nodes
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats?.numberOfNodes || 0}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {stats?.numberOfDataNodes || 0} data
                </Text>
              </Group>
              {nodesHistoryNumbers.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Sparkline
                    data={nodesHistoryNumbers}
                    color="var(--mantine-color-blue-6)"
                    height={25}
                  />
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
          <Card
            shadow="sm"
            padding="md"
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleTabChange('indices')}
          >
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed">
                    Indices
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats?.numberOfIndices || 0}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {stats?.numberOfDataNodes || 0} data
                </Text>
              </Group>
              {indicesHistoryNumbers.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Sparkline
                    data={indicesHistoryNumbers}
                    color="var(--mantine-color-green-6)"
                    height={25}
                  />
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
          <Card
            shadow="sm"
            padding="md"
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleTabChange('shards')}
          >
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed">
                    Shards
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats?.activeShards || 0}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {stats?.activePrimaryShards || 0} primary
                </Text>
              </Group>
              {shardsHistoryNumbers.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Sparkline
                    data={shardsHistoryNumbers}
                    color="var(--mantine-color-violet-6)"
                    height={25}
                  />
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Second Row: Documents, Unassigned, Disk Usage */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
          <Card
            shadow="sm"
            padding="md"
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleTabChange('indices')}
          >
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed">
                    Documents
                  </Text>
                  <Text size="xl" fw={700}>
                    {(stats?.numberOfDocuments || 0).toLocaleString()}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  total
                </Text>
              </Group>
              {documentsHistoryNumbers.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Sparkline
                    data={documentsHistoryNumbers}
                    color="var(--mantine-color-cyan-6)"
                    height={25}
                  />
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
          <Card
            shadow="sm"
            padding="md"
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleTabChange('shards')}
          >
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed">
                    Unassigned
                  </Text>
                  <Text size="xl" fw={700} c={stats?.unassignedShards ? 'red' : undefined}>
                    {stats?.unassignedShards || 0}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {stats?.relocatingShards || 0} moving
                </Text>
              </Group>
              {unassignedHistoryNumbers.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Sparkline
                    data={unassignedHistoryNumbers}
                    color={
                      stats?.unassignedShards
                        ? 'var(--mantine-color-red-6)'
                        : 'var(--mantine-color-gray-6)'
                    }
                    height={25}
                  />
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
          <Card
            shadow="sm"
            padding="md"
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleTabChange('nodes')}
          >
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed">
                    Disk Usage
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats?.diskUsed && stats?.diskTotal ? formatBytes(stats.diskUsed) : '0 B'}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {stats?.diskTotal ? ` / ${formatBytes(stats.diskTotal)}` : ''}
                </Text>
              </Group>
              {stats?.diskUsed && stats?.diskTotal && (
                <div style={{ marginTop: 4 }}>
                  <Text size="xs" c="dimmed">
                    {formatPercentRatio(stats.diskUsed, stats.diskTotal)}% used
                  </Text>
                </div>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Resource Usage: CPU, Memory, Disk */}
      {(stats?.cpuPercent !== undefined || stats?.memoryTotal || stats?.diskTotal) && (
        <Grid>
          {stats?.cpuPercent !== undefined && (
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg">
                <ProgressWithLabel
                  label="CPU Usage"
                  value={stats.cpuPercent}
                  color={getColor(stats.cpuPercent)}
                  description={`${stats.cpuPercent.toFixed(1)}%`}
                />
              </Card>
            </Grid.Col>
          )}

          {stats?.memoryTotal && stats?.memoryUsed !== undefined && (
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg">
                <ProgressWithLabel
                  label="Memory Usage"
                  value={(stats.memoryUsed / stats.memoryTotal) * 100}
                  color={getColor((stats.memoryUsed / stats.memoryTotal) * 100)}
                  description={`${formatBytes(stats.memoryUsed)} / ${formatBytes(stats.memoryTotal)}`}
                />
              </Card>
            </Grid.Col>
          )}

          {stats?.diskTotal && stats?.diskUsed !== undefined && (
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg">
                <ProgressWithLabel
                  label="Disk Usage"
                  value={(stats.diskUsed / stats.diskTotal) * 100}
                  color={getColor((stats.diskUsed / stats.diskTotal) * 100)}
                  description={`${formatBytes(stats.diskUsed)} / ${formatBytes(stats.diskTotal)}`}
                />
              </Card>
            </Grid.Col>
          )}
        </Grid>
      )}
    </Stack>
  );
}
