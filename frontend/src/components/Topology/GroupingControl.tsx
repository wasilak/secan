import { Select } from '@mantine/core';
import type { GroupingAttribute } from '../../utils/topologyGrouping';

/**
 * Props for the GroupingControl component
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */
export interface GroupingControlProps {
  /** Currently active grouping attribute */
  currentGrouping: GroupingAttribute;
  /** Currently active grouping value (for label-specific grouping) */
  currentGroupingValue?: string;
  /** Array of custom label NAMES available in the cluster (e.g., ["zone", "rack"]) */
  availableLabels: string[];
  /** Callback invoked when grouping selection changes */
  onGroupingChange: (attribute: GroupingAttribute, value?: string) => void;
}

/**
 * GroupingControl component provides UI controls for selecting node grouping options
 * in the topology view.
 * 
 * This component displays a dropdown/select control with grouping options:
 * - None: No grouping (default view)
 * - By Role: Group nodes by their roles (nodes appear in all role groups)
 * - By Type: Group nodes into Master and Other
 * - By Label: Group nodes by values of a specific label name
 * 
 * The component highlights the currently active grouping option and calls the
 * onGroupingChange callback when the user selects a different option.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 * 
 * @example
 * ```tsx
 * <GroupingControl
 *   currentGrouping="role"
 *   availableLabels={['zone', 'rack']}
 *   onGroupingChange={(attribute, value) => setGrouping(attribute, value)}
 * />
 * ```
 */
export function GroupingControl({
  currentGrouping,
  currentGroupingValue,
  availableLabels,
  onGroupingChange,
}: GroupingControlProps) {
  // Define grouping options with labels
  const groupingOptions = [
    { value: 'none', label: 'None' },
    { value: 'role', label: 'By Role' },
    { value: 'type', label: 'By Type' },
    // Add individual label NAME options (not values)
    ...availableLabels.map(labelName => ({
      value: `label:${labelName}`,
      label: `By Label: ${labelName}`,
      disabled: false,
    })),
  ];

  // Determine current value for the select
  // If grouping by label with a specific label name, use "label:labelName" format
  // Otherwise use the attribute directly
  const selectValue = currentGrouping === 'label' && currentGroupingValue
    ? `label:${currentGroupingValue}`
    : currentGrouping;

  return (
    <Select
      label="Group Nodes"
      data={groupingOptions}
      value={selectValue}
      onChange={(value) => {
        if (value) {
          // Handle label-specific grouping
          if (value.startsWith('label:')) {
            const labelName = value.substring(6); // Remove 'label:' prefix
            onGroupingChange('label' as GroupingAttribute, labelName);
          } else {
            onGroupingChange(value as GroupingAttribute);
          }
        }
      }}
      size="sm"
      w={220}
      styles={{
        input: {
          fontSize: '0.875rem',
        },
        dropdown: {
          minWidth: 'fit-content',
          width: 'auto',
        },
        option: {
          whiteSpace: 'nowrap',
        },
      }}
    />
  );
}
