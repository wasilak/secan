import { Card, Stack, Text } from '@mantine/core';
import ThemedPre from '../common/ThemedPre';
import { ResponsivePie, type PieTooltipProps } from '@nivo/pie';
import { useNivoTheme } from '../../hooks/useNivoTheme';
import type { MantineColorScheme } from '@mantine/core';

interface PieDatum {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DistributionChartProps {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  colorScheme: MantineColorScheme;
  query?: string | string[];
  /** Optional value formatter for tooltip; defaults to showing raw number */
  valueFormatter?: (value: number) => string;
}


function makePieTooltip(valueFormatter: (v: number) => string, total: number) {
  return function PieTooltipContent({ datum }: PieTooltipProps<PieDatum>) {
    const pct = total > 0 ? ((datum.value / total) * 100).toFixed(0) : '0';
    return (
      <div
        style={{
          background: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: '4px',
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {datum.label}: {valueFormatter(datum.value)} ({pct}%)
      </div>
    );
  };
}

/**
 * Distribution pie chart component
 */
export function DistributionChart({
  title,
  data,
  height = 200,
  colorScheme: _colorScheme,
  query,
  valueFormatter = String,
}: DistributionChartProps) {
  const nivoTheme = useNivoTheme();
  // Rely on CSS variables for code block colors to follow the computed root
  // color-scheme attribute instead of choosing tokens in JS.

  const filteredData: PieDatum[] = data
    .filter((item) => item.value > 0)
    .map((item) => ({
      id: item.name,
      label: item.name,
      value: item.value,
      color: item.color,
    }));

  const hasData = filteredData.length > 0;
  const total = filteredData.reduce((sum, d) => sum + d.value, 0);
  const PieTooltipContent = makePieTooltip(valueFormatter, total);

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {hasData ? (
          <div style={{ height }}>
            <ResponsivePie<PieDatum>
              data={filteredData}
              theme={nivoTheme}
              innerRadius={0.7}
              padAngle={2}
              colors={(datum) => datum.data.color}
              tooltip={PieTooltipContent}
              legends={[
                {
                  anchor: 'bottom',
                  direction: 'row',
                  itemWidth: 80,
                  itemHeight: 18,
                  itemsSpacing: 2,
                  symbolSize: 10,
                  symbolShape: 'circle',
                },
              ]}
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
