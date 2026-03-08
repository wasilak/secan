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
  /** Array of custom label values available in the cluster (e.g., ["zone-a", "rack-1"]) */
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
    // Add "By Label (All)" option if labels are available
    ...(availableLabels.length > 0 ? [{ value: 'label', label: 'By Label (All)' }] : []),
    // Add individual label value options
    ...availableLabels.map(labelValue => ({
      value: `label:${labelValue}`,
      label: `By Label: ${labelValue}`,
      disabled: false,
    })),
  ];

  // Determine current value for the select
  // If grouping by label with a specific label value, use "label:labelValue" format
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
            const labelValue = value.substring(6); // Remove 'label:' prefix
            onGroupingChange('label' as GroupingAttribute, labelValue);
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
