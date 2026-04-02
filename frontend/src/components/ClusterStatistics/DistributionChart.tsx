import { Card, Stack, Text, Code, useMantineColorScheme } from '@mantine/core';
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}

function makePieTooltip(valueFormatter: (v: number) => string) {
  return function PieTooltipContent({ datum }: PieTooltipProps<PieDatum>) {
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
        {datum.label}: {valueFormatter(datum.value)} ({datum.formattedValue})
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
  const { colorScheme: mantineColorScheme } = useMantineColorScheme();
  const nivoTheme = useNivoTheme();
  const isDark = mantineColorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';

  const filteredData: PieDatum[] = data
    .filter((item) => item.value > 0)
    .map((item) => ({
      id: item.name,
      label: item.name,
      value: item.value,
      color: item.color,
    }));

  const hasData = filteredData.length > 0;
  const PieTooltipContent = makePieTooltip(valueFormatter);

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
