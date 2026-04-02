import { Checkbox, Group } from '@mantine/core';
import type { ToggleFilterProps } from './types';

export function ToggleFilter({
  label,
  checked,
  onChange,
  icon,
}: ToggleFilterProps) {
  return (
    <Group gap="xs" wrap="nowrap">
      {icon}
      <Checkbox
        label={label}
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        size="xs"
        styles={{
          label: {
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
          input: { cursor: 'pointer' },
        }}
      />
    </Group>
  );
}
