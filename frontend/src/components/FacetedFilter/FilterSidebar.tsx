import { useState } from 'react';
import { ScrollArea, Box, ActionIcon, Stack, Button, rem, Accordion } from '@mantine/core';
import { IconChevronRight, IconChevronLeft } from '@tabler/icons-react';
import { FilterCategory } from './FilterCategory';
import { TextSearchInput } from './TextSearchInput';
import { ToggleFilter } from './ToggleFilter';
import type { FilterSidebarProps } from './types';

const DEFAULT_WIDTH = 280;
const COLLAPSED_WIDTH = 48;

export function FilterSidebar({
  textFilter,
  categories,
  toggles = [],
  actions = [],
  defaultExpanded = true,
  width = DEFAULT_WIDTH,
}: FilterSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Box
      style={{
        width: isExpanded ? width : COLLAPSED_WIDTH,
        height: '100%',
        transition: 'width 200ms ease',
        borderRight: '1px solid #e9ecef',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Box style={{ padding: '8px 4px', display: 'flex', justifyContent: 'flex-end' }}>
        <ActionIcon
          variant="subtle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse filters' : 'Expand filters'}
        >
          {isExpanded ? (
            <IconChevronLeft style={{ width: rem(18), height: rem(18) }} />
          ) : (
            <IconChevronRight style={{ width: rem(18), height: rem(18) }} />
          )}
        </ActionIcon>
      </Box>

      {isExpanded && (
        <ScrollArea style={{ flex: 1 }} p="xs">
          <Stack gap="md">
            {textFilter && (
              <TextSearchInput
                value={textFilter.value}
                onChange={textFilter.onChange}
                placeholder={textFilter.placeholder}
              />
            )}

            {categories.length > 0 && (
              <Accordion multiple defaultValue={categories.map((c) => c.title)}>
                {categories.map((category) => (
                  <FilterCategory
                    key={category.title}
                    title={category.title}
                    options={category.options}
                    selected={category.selected}
                    onChange={category.onChange}
                    allValues={category.defaultValue ?? category.options.map((o) => o.value)}
                  />
                ))}
              </Accordion>
            )}

            {toggles.length > 0 && (
              <Stack gap="xs">
                {toggles.map((toggle, index) => (
                  <ToggleFilter
                    key={`toggle-${index}`}
                    label={toggle.label}
                    checked={toggle.value}
                    onChange={toggle.onChange}
                    icon={toggle.icon}
                  />
                ))}
              </Stack>
            )}

            {actions.length > 0 && (
              <Stack gap="xs" mt="sm">
                {actions.map((action, index) => (
                  <Button
                    key={`action-${index}`}
                    onClick={action.onClick}
                    variant={action.variant ?? 'filled'}
                    size="sm"
                    leftSection={action.icon}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
