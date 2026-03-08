import React from 'react';
import { Card, Stack, Text, Code, Group, ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  YAxis,
  XAxis,
  CartesianGrid,
} from 'recharts';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { formatChartTime } from '../../utils/formatters';
import type { DataPoint } from '../../hooks/useSparklineData';

interface TimeSeriesChartProps {
  title: string;
  data: DataPoint[];
  dataKey: string;
  color: string;
  gradientId: string;
  unit?: string;
  valueFormatter?: (value: number | undefined) => string;
  tickFormatter?: (value: number) => string;
  query?: string;
  height?: number;
}

/**
 * CopyButton component for copying query text
 */
function QueryCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy query'} position="top">
      <ActionIcon
        variant="subtle"
        color={copied ? 'green' : 'gray'}
        size="sm"
        onClick={copyToClipboard}
      >
        {copied ? (
          <IconCheck style={{ width: '1rem', height: '1rem' }} />
        ) : (
          <IconCopy style={{ width: '1rem', height: '1rem' }} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}

/**
 * Generic time series area chart component
 */
export function TimeSeriesChart({
  title,
  data,
  dataKey: _dataKey,
  color,
  gradientId,
  unit,
  valueFormatter,
  tickFormatter,
  query,
  height = 200,
}: TimeSeriesChartProps) {
  const { colorScheme } = useMantineColorScheme();
  const hasData = data && data.length > 0;
  
  // Theme-aware code block colors
  const isDark = colorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>
            {title}
          </Text>
          {query && (
            <QueryCopyButton value={query} />
          )}
        </Group>
        {hasData ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={data.map((p) => ({
                time: formatChartTime(p.timestamp),
                value: p.value,
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--mantine-color-dark-4)"
                opacity={0.3}
              />
              <XAxis
                dataKey="time"
                stroke="var(--mantine-color-gray-6)"
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                height={40}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                stroke="var(--mantine-color-gray-6)"
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 11 }}
                width={unit ? 50 : 35}
                unit={unit}
                tickFormatter={tickFormatter}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-7)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '4px',
                  color: 'var(--mantine-color-gray-0)',
                }}
                labelStyle={{ color: 'var(--mantine-color-gray-0)' }}
                formatter={valueFormatter || ((_value: number | undefined) => _value ?? 0)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                name={title}
                dot={{ fill: color, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Stack justify="center" align="center" style={{ height }}>
            <Text size="sm" c="dimmed">
              Data not available
            </Text>
          </Stack>
        )}
        {query && (
          <Code
            block
            style={{
              backgroundColor: codeBg,
              color: codeColor,
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {query}
          </Code>
        )}
      </Stack>
    </Card>
  );
}
