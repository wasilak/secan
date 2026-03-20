import { useState, useMemo } from 'react';
import {
  Accordion,
  Checkbox,
  Text,
  Group,
  ActionIcon,
  Box,
  rem,
} from '@mantine/core';
import { IconRotateClockwise } from '@tabler/icons-react';
import type { FilterCategoryProps } from './types';

export function FilterCategory({
  title,
  options,
  selected,
  onChange,
  allValues,
}: FilterCategoryProps) {
  const defaultValues = useMemo(
    () => allValues ?? options.map((o) => o.value),
    [allValues, options]
  );

  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const isModified = selected.length !== defaultValues.length ||
    !defaultValues.every((v) => selected.includes(v));

  const handleToggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const handleOnly = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange([value]);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValues);
  };

  return (
    <Accordion.Item value={title} style={{ borderBottom: '1px solid #e9ecef' }}>
      <Box style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
        <Accordion.Control>
          <Text fw={600} size="sm" c="gray.8">
            {title}
          </Text>
        </Accordion.Control>

        {isModified && (
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={handleReset}
            title="Reset to all"
          >
            <IconRotateClockwise style={{ width: rem(14), height: rem(14) }} />
          </ActionIcon>
        )}
      </Box>

      <Accordion.Panel p={0}>
        {options.length === 0 ? (
          <Text size="xs" c="dimmed" py="xs" px="xs">
            No options available
          </Text>
        ) : (
          options.map((opt) => (
            <Group
              key={opt.value}
              gap={4}
              px="xs"
              py={2}
              wrap="nowrap"
              justify="space-between"
              onMouseEnter={() => setHoveredValue(opt.value)}
              onMouseLeave={() => setHoveredValue(null)}
              style={{ cursor: 'pointer' }}
              onClick={() => handleToggle(opt.value)}
            >
              <Checkbox
                size="xs"
                checked={selected.includes(opt.value)}
                readOnly
                styles={{
                  input: { cursor: 'pointer' },
                  label: { cursor: 'pointer' },
                }}
                label={
                  <Group gap={6} wrap="nowrap">
                    {opt.color && (
                      <Box
                        style={{
                          width: 4,
                          height: 16,
                          borderRadius: 2,
                          backgroundColor: opt.color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {opt.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{opt.icon}</span>}
                    <Text
                      size="xs"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={opt.label}
                    >
                      {opt.label}
                    </Text>
                  </Group>
                }
              />

              {hoveredValue === opt.value && (
                <Text
                  size="xs"
                  fw={700}
                  c="blue.6"
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e: React.MouseEvent) => handleOnly(e, opt.value)}
                >
                  ONLY
                </Text>
              )}
            </Group>
          ))
        )}
      </Accordion.Panel>
    </Accordion.Item>
  );
}
