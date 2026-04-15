import React, { useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { showErrorNotification } from '../utils/notifications';
import { getErrorMessage } from '../lib/errorHandling';

interface ModalRefreshButtonProps {
  onRefresh: () => Promise<unknown> | void;
  loading?: boolean;
  tooltip?: string;
}

export function ModalRefreshButton({ onRefresh, loading, tooltip = 'Refresh' }: ModalRefreshButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);

  const isLoading = loading ?? internalLoading;

  const handleClick = async () => {
    if (isLoading) return;
    try {
      setInternalLoading(true);
      const result = onRefresh();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await result as Promise<unknown>;
      }
      // Success: per requirements, do not show success notification; spinner indicates success
    } catch (err) {
      showErrorNotification({ title: 'Refresh failed', message: getErrorMessage(err) });
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Tooltip label={tooltip} position="bottom">
      <ActionIcon variant="subtle" color="blue" onClick={handleClick} loading={isLoading} size="sm" aria-label={tooltip}>
        <IconRefresh size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

export default ModalRefreshButton;
