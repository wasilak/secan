import { Text, Tooltip } from '@mantine/core';

/**
 * Props for MasterIndicator component
 */
export interface MasterIndicatorProps {
  /** Whether this node is the current master */
  isMaster: boolean;
  /** Whether this node is master-eligible */
  isMasterEligible: boolean;
  /** Size of the indicator */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
}

/**
 * MasterIndicator component displays a crown indicator for master and master-eligible nodes.
 *
 * Features:
 * - Filled crown (♛) for current master node (yellow)
 * - Hollow crown (♔) for master-eligible nodes (gray)
 * - No indicator for non-master nodes
 * - Configurable size (sm, md, lg)
 * - Optional tooltip with status description
 *
 * @example
 * ```tsx
 * <MasterIndicator isMaster={true} isMasterEligible={true} size="md" />
 * <MasterIndicator isMaster={false} isMasterEligible={true} size="sm" />
 * ```
 */
export function MasterIndicator({
  isMaster,
  isMasterEligible,
  size = 'md',
  showTooltip = true,
}: MasterIndicatorProps) {
  // Don't render anything if node is neither master nor master-eligible
  if (!isMaster && !isMasterEligible) {
    return null;
  }

  // Determine icon, color, and tooltip text
  const icon = isMaster ? '♛' : '♔';
  const color = isMaster ? 'yellow.6' : 'gray.6';
  const tooltipText = isMaster ? 'Current Master' : 'Master Eligible';

  // Map size prop to font size
  const fontSize = size === 'sm' ? '14px' : size === 'md' ? '18px' : '24px';

  const indicator = (
    <Text
      component="span"
      c={color}
      style={{
        fontSize,
        cursor: 'default',
        lineHeight: 1,
        display: 'inline-block',
      }}
      aria-label={tooltipText}
    >
      {icon}
    </Text>
  );

  // Wrap with tooltip if enabled
  if (showTooltip) {
    return (
      <Tooltip label={tooltipText} withArrow>
        {indicator}
      </Tooltip>
    );
  }

  return indicator;
}
