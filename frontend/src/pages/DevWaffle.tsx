import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, NumberInput, Stack, Text } from '@mantine/core';
import { ShardWaffleChart } from '../components/Topology/ShardWaffleChart';

// Lightweight dev-only page to render many shard dots for visual testing.
export function DevWaffle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = Number(searchParams.get('count') ?? 300);
  const [count, setCount] = React.useState<number>(initial);

  const makeDots = (n: number) => {
    const dots = [] as any[];
    for (let i = 0; i < n; i++) {
      dots.push({
        color: i % 3 === 0 ? '#2ecc71' : i % 3 === 1 ? '#27ae60' : '#1abc9c',
        tooltip: `shard ${i}`,
        primary: i % 2 === 0,
        shard: { index: `idx-${i % 50}`, shard: i % 100 },
      });
    }
    return dots;
  };

  const dots = React.useMemo(() => makeDots(count), [count]);

  return (
    <Box p="md">
      <Stack spacing="md">
        <Text size="lg">Dev Waffle Test</Text>
        <NumberInput
          label="Shard count"
          value={count}
          min={1}
          step={10}
          onChange={(v) => setCount(v ?? 0)}
        />
        <Button
          onClick={() => {
            setSearchParams({ count: String(count) });
          }}
        >
          Update URL
        </Button>

        <Box>
          <ShardWaffleChart dots={dots} />
        </Box>
      </Stack>
    </Box>
  );
}

export default DevWaffle;
