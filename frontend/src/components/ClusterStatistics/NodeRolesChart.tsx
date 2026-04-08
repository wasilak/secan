import { Card, Stack, Text } from '@mantine/core';
import ThemedPre from '../common/ThemedPre';
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
  const nivoTheme = useNivoTheme();
  // Use CSS variables for code block colors to avoid JS timing issues
  // See: frontend/src/styles/reactflow-overrides.css for definitions

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
                <ThemedPre key={`${i}-${q.slice(0, 20)}`}>{q}</ThemedPre>
              ))
            ) : (
              <ThemedPre>{query}</ThemedPre>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
