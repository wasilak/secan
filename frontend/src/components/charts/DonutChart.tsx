import { Card, Stack, Text, useMantineColorScheme } from '@mantine/core';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export interface DonutChartData {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  title: string;
  data: DonutChartData[];
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string };
  }>;
  colorScheme: 'light' | 'dark' | 'auto';
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
 * Reusable donut/pie chart component
 */
export function DonutChart({
  title,
  data,
  height = 200,
  showLegend = true,
  showTooltip = true,
}: DonutChartProps) {
  const { colorScheme } = useMantineColorScheme();
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
              {showTooltip && (
                <RechartsTooltip
                  content={<PieTooltip colorScheme={colorScheme} />}
                />
              )}
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Stack justify="center" align="center" style={{ height }}>
            <Text size="sm" c="dimmed">
              Data not available
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export default DonutChart;
