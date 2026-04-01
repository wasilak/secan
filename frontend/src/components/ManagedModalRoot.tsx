import React from 'react';
import { Modal } from '@mantine/core';
import { useModalManager } from '../contexts/ModalManagerContext';

type Props = React.ComponentProps<typeof Modal.Root>;

export const ManagedModalRoot: React.FC<Props> = ({ children, opened, onClose, ...rest }) => {
  const { openModal, closeModal } = useModalManager();

  const handleEnter = () => {
    try {
      openModal();
      window.dispatchEvent(new CustomEvent('secan:modal-change', { detail: { open: true } }));
    } catch {
      // ignore
    }
  };

  const handleExit = () => {
    try {
      closeModal();
      window.dispatchEvent(new CustomEvent('secan:modal-change', { detail: { close: true } }));
    } catch {
      // ignore
    }
  };

  // Modal.Root typing may not include these lifecycle props; cast the element to a generic record
  // when passing them to avoid using the explicit `any` type.
  return (
    <Modal.Root {...(rest as unknown as Record<string, unknown>)} opened={opened} onClose={onClose} onEnterTransitionEnd={handleEnter} onExitTransitionEnd={handleExit}>
      {children}
    </Modal.Root>
  );
};
