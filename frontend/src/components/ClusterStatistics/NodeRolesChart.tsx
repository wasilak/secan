import { Card, Stack, Text, Code, useMantineColorScheme } from '@mantine/core';
import { ResponsiveRadar } from '@nivo/radar';
import { useNivoTheme } from '../../hooks/useNivoTheme';
import { ROLE_COLORS } from '../RoleIcons';

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
  const nivoTheme = useNivoTheme();
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
          <div style={{ height }}>
            <ResponsiveRadar
              data={data}
              keys={['count']}
              indexBy="role"
              theme={nivoTheme}
              colors={(datum: { key: string; index: number }) =>
                ROLE_COLORS[datum.key] ?? 'var(--mantine-color-gray-6)'
              }
              fillOpacity={0.5}
              gridLevels={4}
              dotSize={6}
              dotColor={{ theme: 'background' }}
              dotBorderWidth={2}
            />
          </div>
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
                  key={`${i}-${q.slice(0, 20)}`}
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
