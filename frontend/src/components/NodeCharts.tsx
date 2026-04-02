import { Grid } from '@mantine/core';
import { TimeSeriesChart } from './charts/TimeSeriesChart';
import type { DataPoint } from '../hooks/useSparklineData';

interface NodeChartsProps {
  heapHistory: DataPoint[];
  diskHistory: DataPoint[];
  cpuHistory: DataPoint[];
  loadHistory: DataPoint[];
  load5History?: DataPoint[];
  load15History?: DataPoint[];
  prometheusQueries?: {
    heap?: string;
    disk?: string;
    cpu?: string;
    load?: string;
    load1?: string;
    load5?: string;
    load15?: string;
  };
}

/**
 * NodeCharts component displays time series charts for node metrics
 * Uses reusable multi-series TimeSeriesChart component
 */
export function NodeCharts({
  heapHistory,
  diskHistory,
  cpuHistory,
  loadHistory,
  load5History,
  load15History,
  prometheusQueries,
}: NodeChartsProps) {
  return (
    <Grid>
      {/* Heap Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="Heap Usage Over Time"
          series={[
            {
              name: 'Heap',
              color: 'blue',
              data: heapHistory,
              unit: '%',
            },
          ]}
          valueFormatter={(value: number) => `${value.toFixed(1)}%`}
          tickFormatter={(value: number) => `${value}%`}
          query={prometheusQueries?.heap}
        />
      </Grid.Col>

      {/* Disk Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="Disk Usage Over Time"
          series={[
            {
              name: 'Disk',
              color: 'cyan',
              data: diskHistory,
              unit: '%',
            },
          ]}
          valueFormatter={(value: number) => `${value.toFixed(1)}%`}
          tickFormatter={(value: number) => `${value}%`}
          query={prometheusQueries?.disk}
        />
      </Grid.Col>

      {/* CPU Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="CPU Usage Over Time"
          series={[
            {
              name: 'CPU',
              color: 'green',
              data: cpuHistory,
              unit: '%',
            },
          ]}
          valueFormatter={(value: number) => `${value.toFixed(1)}%`}
          tickFormatter={(value: number) => `${value}%`}
          query={prometheusQueries?.cpu}
        />
      </Grid.Col>

      {/* Load Average Over Time (3 series) */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="Load Average Over Time"
          series={[
            {
              name: '1 min',
              color: 'orange',
              data: loadHistory,
            },
            {
              name: '5 min',
              color: 'blue',
              data: load5History || loadHistory,
            },
            {
              name: '15 min',
              color: 'green',
              data: load15History || loadHistory,
            },
          ]}
          valueFormatter={(value: number) => value.toFixed(2)}
          tickFormatter={(value: number) => value.toFixed(2)}
          query={
            prometheusQueries?.load1
              ? [
                  `1m:  ${prometheusQueries.load1}`,
                  `5m:  ${prometheusQueries.load5}`,
                  `15m: ${prometheusQueries.load15}`,
                ]
              : undefined
          }
        />
      </Grid.Col>
    </Grid>
  );
}

export default NodeCharts;
