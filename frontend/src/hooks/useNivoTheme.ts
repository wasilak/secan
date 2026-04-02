import { useMantineColorScheme } from '@mantine/core';
import type { Theme } from '@nivo/core';

export function useNivoTheme(): Theme {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const axisTickFill = isDark
    ? 'var(--mantine-color-gray-5)'
    : 'var(--mantine-color-dark-5)';

  const gridLineStroke = isDark
    ? 'var(--mantine-color-dark-4)'
    : 'var(--mantine-color-gray-3)';

  const tooltipBackground = isDark
    ? 'var(--mantine-color-dark-7)'
    : 'var(--mantine-color-gray-0)';

  const tooltipColor = isDark
    ? 'var(--mantine-color-gray-0)'
    : 'var(--mantine-color-dark-7)';

  const tooltipBorder = isDark
    ? '1px solid var(--mantine-color-dark-4)'
    : '1px solid var(--mantine-color-gray-3)';

  return {
    axis: {
      ticks: {
        text: {
          fill: axisTickFill,
        },
      },
    },
    grid: {
      line: {
        stroke: gridLineStroke,
        strokeOpacity: 0.4,
      },
    },
    legends: {
      text: {
        fill: axisTickFill,
      },
    },
    tooltip: {
      container: {
        background: tooltipBackground,
        color: tooltipColor,
        border: tooltipBorder,
        borderRadius: '4px',
      },
    },
  };
}
