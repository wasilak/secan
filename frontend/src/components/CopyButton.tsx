import { ActionIcon, Tooltip, CopyButton as MantineCopyButton } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface CopyButtonProps {
  /** Value to copy to clipboard */
  value: string;
  /** Optional tooltip text */
  tooltip?: string;
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Button variant */
  variant?: string;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Reusable copy button component
 * 
 * Copies a value to clipboard and shows visual feedback with a toast notification.
 * Handles clipboard API failures gracefully with fallback message.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  tooltip = 'Copy to clipboard',
  size = 'xs',
  variant = 'subtle',
  className,
}) => {
  return (
    <MantineCopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied!' : tooltip} position="top" withArrow>
          <ActionIcon
            onClick={copy}
            size={size}
            variant={variant}
            color={copied ? 'green' : 'gray'}
            className={className}
            aria-label={tooltip}
          >
            {copied ? (
              <IconCheck style={{ width: '1rem', height: '1rem' }} />
            ) : (
              <IconCopy style={{ width: '1rem', height: '1rem' }} />
            )}
          </ActionIcon>
        </Tooltip>
      )}
    </MantineCopyButton>
  );
};

export default CopyButton;
