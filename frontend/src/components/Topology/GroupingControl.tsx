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
  /** Array of custom labels available in the cluster */
  availableLabels: string[];
  /** Callback invoked when grouping selection changes */
  onGroupingChange: (attribute: GroupingAttribute) => void;
}

/**
 * GroupingControl component provides UI controls for selecting node grouping options
 * in the topology view.
 * 
 * This component displays a dropdown/select control with grouping options:
 * - None: No grouping (default view)
 * - By Role: Group nodes by their primary role
 * - By Type: Group nodes by their type classification
 * - By Label: Group nodes by custom labels (disabled when no labels exist)
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
 *   availableLabels={['zone-a', 'zone-b']}
 *   onGroupingChange={(attribute) => setGrouping(attribute)}
 * />
 * ```
 */
export function GroupingControl({
  currentGrouping,
  availableLabels,
  onGroupingChange,
}: GroupingControlProps) {
  // Define grouping options with labels
  const groupingOptions = [
    { value: 'none', label: 'None' },
    { value: 'role', label: 'By Role' },
    { value: 'type', label: 'By Type' },
    { value: 'label', label: 'By Label', disabled: availableLabels.length === 0 },
  ];

  return (
    <Select
      label="Group Nodes"
      data={groupingOptions}
      value={currentGrouping}
      onChange={(value) => {
        if (value) {
          onGroupingChange(value as GroupingAttribute);
        }
      }}
      size="sm"
      w={180}
      styles={{
        input: {
          fontSize: '0.875rem',
        },
      }}
    />
  );
}
