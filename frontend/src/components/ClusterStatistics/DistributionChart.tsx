import { Card, Stack, Text, Code, useMantineColorScheme } from '@mantine/core';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import type { MantineColorScheme } from '@mantine/core';

interface DistributionChartProps {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  colorScheme: MantineColorScheme;
  query?: string | string[];
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string };
  }>;
  colorScheme: MantineColorScheme;
}

function PieTooltip({ active, payload, colorScheme }: PieTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const effectiveScheme = colorScheme === 'auto' ? 'light' : colorScheme;
    return (
      <div
        style={{
          backgroundColor:
            effectiveScheme === 'dark'
              ? 'var(--mantine-color-dark-7)'
              : 'var(--mantine-color-gray-0)',
          border: `1px solid ${effectiveScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
          borderRadius: '4px',
          padding: '8px 12px',
          color:
            effectiveScheme === 'dark'
              ? 'var(--mantine-color-gray-0)'
              : 'var(--mantine-color-dark-7)',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 500 }}>
          {data.payload.name} : {data.value}
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Distribution pie chart component
 */
export function DistributionChart({
  title,
  data,
  height = 200,
  colorScheme,
  query,
}: DistributionChartProps) {
  const { colorScheme: mantineColorScheme } = useMantineColorScheme();
  const isDark = mantineColorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';

  const filteredData = data.filter((item) => item.value > 0);
  const hasData = filteredData.length > 0;

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {hasData ? (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {filteredData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                content={<PieTooltip colorScheme={colorScheme} />}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Stack justify="center" align="center" style={{ height }}>
            <Text size="sm" c="dimmed">
              Data not available
            </Text>
          </Stack>
        )}

        {query && (
          <Stack gap="xs">
            {Array.isArray(query) ? (
              query.map((q, i) => (
                <Code
                  key={i}
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
                  {q}
                </Code>
              ))
            ) : (
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
        )}
      </Stack>
    </Card>
  );
}
