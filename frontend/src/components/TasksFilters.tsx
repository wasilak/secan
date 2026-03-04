import React from 'react';
import { MultiSelect, Group, Stack, Text } from '@mantine/core';

/**
 * Tasks filter component for filtering task list
 *
 * Provides multiselect filters for:
 * - Task type (e.g., "transport", "management", "search")
 * - Task action (e.g., "cluster:monitor/tasks/lists", "indices:data/read/search")
 *
 * Requirements: 3 (Task filtering)
 */
interface TasksFiltersProps {
  uniqueTypes: string[];
  uniqueActions: string[];
  selectedTypes: string[];
  selectedActions: string[];
  onTypesChange: (types: string[]) => void;
  onActionsChange: (actions: string[]) => void;
}

export function TasksFilters({
  uniqueTypes,
  uniqueActions,
  selectedTypes,
  selectedActions,
  onTypesChange,
  onActionsChange,
}: TasksFiltersProps): JSX.Element {
  const typeData = uniqueTypes.map((type) => ({
    value: type,
    label: type,
  }));

  const actionData = uniqueActions.map((action) => ({
    value: action,
    label: action,
  }));

  return (
    <Stack gap="md" mb="lg">
      <Group grow>
        <div>
          <Text size="sm" fw={500} mb={4}>
            Task Type
            {selectedTypes.length > 0 && (
              <Text component="span" size="xs" c="blue" ml={4}>
                ({selectedTypes.length} selected)
              </Text>
            )}
          </Text>
          <MultiSelect
            placeholder="Select task types..."
            data={typeData}
            value={selectedTypes}
            onChange={onTypesChange}
            searchable
            clearable
            maxDropdownHeight={200}
          />
        </div>

        <div>
          <Text size="sm" fw={500} mb={4}>
            Task Action
            {selectedActions.length > 0 && (
              <Text component="span" size="xs" c="blue" ml={4}>
                ({selectedActions.length} selected)
              </Text>
            )}
          </Text>
          <MultiSelect
            placeholder="Select task actions..."
            data={actionData}
            value={selectedActions}
            onChange={onActionsChange}
            searchable
            clearable
            maxDropdownHeight={200}
          />
        </div>
      </Group>
    </Stack>
  );
}
