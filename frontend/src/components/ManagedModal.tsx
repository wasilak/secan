import React from 'react';
import { Modal, ModalProps } from '@mantine/core';
import { useModalManager } from '../contexts/ModalManagerContext';

export const ManagedModal: React.FC<ModalProps> = (props) => {
  const { openModal, closeModal } = useModalManager();
  const { onEnterTransitionEnd, onExitTransitionEnd, opened, ...rest } = props;

  const handleEnter = () => {
    try {
      openModal();
      // Notify any non-reactive consumers
      window.dispatchEvent(new CustomEvent('secan:modal-change', { detail: { open: true } }));
    } catch {
      // ignore
    }
    if (onEnterTransitionEnd) onEnterTransitionEnd();
  };

  const handleExit = () => {
    try {
      closeModal();
      window.dispatchEvent(new CustomEvent('secan:modal-change', { detail: { close: true } }));
    } catch {
      // ignore
    }
    if (onExitTransitionEnd) onExitTransitionEnd();
  };

  return <Modal {...rest} opened={opened} onEnterTransitionEnd={handleEnter} onExitTransitionEnd={handleExit} />;
};
