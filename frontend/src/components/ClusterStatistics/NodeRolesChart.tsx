import { Card, Stack, Text, Code, useMantineColorScheme } from '@mantine/core';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

interface NodeRolesChartProps {
  title: string;
  data: Array<{ role: string; count: number; fullMark: number }>;
  height?: number;
  query?: string | string[];
}

/**
 * Node roles radar chart component
 */
export function NodeRolesChart({
  title,
  data,
  height = 200,
  query,
}: NodeRolesChartProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';

  const hasData = data && data.length > 0;

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {hasData ? (
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart data={data}>
              <PolarGrid stroke="var(--mantine-color-dark-4)" />
              <PolarAngleAxis
                dataKey="role"
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 'dataMax']}
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
              />
              <Radar
                name="Node Count"
                dataKey="count"
                stroke="var(--mantine-color-blue-6)"
                fill="var(--mantine-color-blue-6)"
                fillOpacity={0.5}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-7)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '4px',
                  color: 'var(--mantine-color-gray-0)',
                }}
                labelStyle={{ color: 'var(--mantine-color-gray-0)' }}
              />
              <Legend />
            </RadarChart>
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
