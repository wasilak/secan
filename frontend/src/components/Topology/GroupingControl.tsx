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
  /** Currently active grouping value (for label-specific grouping) - this is the full tag */
  currentGroupingValue?: string;
  /** Array of label objects with name and tag */
  availableLabels: Array<{ name: string; tag: string }>;
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
 * - By Label (All): Group nodes by their first label value
 * - By Label: <value>: Group nodes by a specific label value
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
 *   availableLabels={['zone-a', 'rack-1']}
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
    // Add individual label name options (no "By Label (All)" option)
    ...availableLabels.map(({ name, tag }) => ({
      value: `label:${tag}`, // Use full tag as value
      label: name, // Display just the label name
      disabled: false,
    })),
  ];

  // Determine current value for the select
  // If grouping by label with a specific label tag, use "label:tag" format
  // If grouping by label without a specific value, use the first available label
  // Otherwise use the attribute directly
  const selectValue = currentGrouping === 'label'
    ? currentGroupingValue
      ? `label:${currentGroupingValue}`
      : availableLabels.length > 0
        ? `label:${availableLabels[0].tag}`
        : 'none'
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
            const labelTag = value.substring(6); // Remove 'label:' prefix to get full tag
            onGroupingChange('label' as GroupingAttribute, labelTag);
          } else {
            onGroupingChange(value as GroupingAttribute);
          }
        }
      }}
      size="sm"
      w="auto"
      miw={220}
      maw={400}
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
