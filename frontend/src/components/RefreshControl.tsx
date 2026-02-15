import { Group, Select, ActionIcon, Text, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useRefresh, REFRESH_INTERVALS, RefreshInterval } from '../contexts/RefreshContext';
import { useEffect, useState } from 'react';

/**
 * RefreshControl component provides UI for controlling auto-refresh
 * 
 * Features:
 * - Dropdown to select refresh interval (5s, 10s, 15s, 30s, 1m, 2m, 5m, off)
 * - Manual refresh button
 * - Visual indicator when refreshing
 * - Countdown timer showing time until next refresh
 * 
 * Requirements: Real-time cluster state updates
 */
export function RefreshControl() {
  const { interval, setInterval, isRefreshing, refresh, lastRefreshTime } = useRefresh();
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<number | null>(null);

  // Calculate time until next refresh
  useEffect(() => {
    if (interval === 0 || !lastRefreshTime) {
      setTimeUntilRefresh(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - lastRefreshTime;
      const remaining = Math.max(0, interval - elapsed);
      setTimeUntilRefresh(remaining);
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 100);

    return () => window.clearInterval(timer);
  }, [interval, lastRefreshTime]);

  // Format time remaining
  const formatTimeRemaining = (ms: number | null): string => {
    if (ms === null) return '';
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  // Prepare select options
  const intervalOptions = Object.entries(REFRESH_INTERVALS).map(([label, value]) => ({
    value: String(value),
    label: label === 'OFF' ? 'Off' : label,
  }));

  return (
    <Group gap="xs">
      <Select
        data={intervalOptions}
        value={String(interval)}
        onChange={(value) => setInterval(Number(value) as RefreshInterval)}
        size="xs"
        w={80}
        styles={{
          input: {
            fontSize: '0.75rem',
          },
        }}
      />
      
      {timeUntilRefresh !== null && interval > 0 && (
        <Text size="xs" c="dimmed" style={{ minWidth: '30px', textAlign: 'right' }}>
          {formatTimeRemaining(timeUntilRefresh)}
        </Text>
      )}

      <Tooltip label="Refresh now" position="bottom">
        <ActionIcon
          variant="subtle"
          color="blue"
          onClick={refresh}
          loading={isRefreshing}
          size="sm"
        >
          <IconRefresh size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
