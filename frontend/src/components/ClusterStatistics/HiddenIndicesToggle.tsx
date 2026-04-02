import { Group, Text, Badge } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

interface HiddenIndicesToggleProps {
  showHiddenIndices: boolean;
  onToggle: (show: boolean) => void;
  hiddenIndicesCount: number;
}

/**
 * Hidden indices toggle button (similar to indices list filter)
 */
export default function HiddenIndicesToggle({
  showHiddenIndices,
  onToggle,
  hiddenIndicesCount,
}: HiddenIndicesToggleProps) {
  return (
    <Group
      gap="xs"
      style={{
        cursor: 'pointer',
        opacity: showHiddenIndices ? 1 : 0.5,
        transition: 'opacity 150ms',
      }}
      onClick={() => onToggle(!showHiddenIndices)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(!showHiddenIndices);
        }
      }}
      tabIndex={0}
      role="button"
    >
      {showHiddenIndices ? (
        <IconEye
          style={{ width: '1rem', height: '1rem' }}
          stroke={2}
          color="var(--mantine-color-violet-6)"
        />
      ) : (
        <IconEyeOff
          style={{ width: '1rem', height: '1rem' }}
          stroke={2}
          color="var(--mantine-color-violet-6)"
        />
      )}
      <Text size="xs" c="violet">
        special
      </Text>
      {hiddenIndicesCount > 0 && (
        <Badge size="xs" variant="light" color="violet">
          {hiddenIndicesCount}
        </Badge>
      )}
    </Group>
  );
}
