import { useState, useCallback, useMemo } from 'react';

export type ModalType = 'index' | 'shard' | 'node' | 'indexCreate';

export interface ModalData {
  type: ModalType;
  indexName?: string;
  shardId?: string;
  nodeId?: string;
  tab?: string;
  // Optional metadata for shard modals
  shardPrimary?: boolean;
  shardNode?: string;
}

export interface ModalStackItem extends ModalData {
  id: string;
}

export interface UseModalStackReturn {
  modalStack: ModalStackItem[];
  topModal: ModalStackItem | null;
  pushModal: (modal: ModalData) => void;
  popModal: () => void;
  clearModals: () => void;
  hasModalAbove: (modalId: string) => boolean;
}

let modalIdCounter = 0;

function generateModalId(): string {
  return `modal-${Date.now()}-${++modalIdCounter}`;
}

export function useModalStack(): UseModalStackReturn {
  const [modalStack, setModalStack] = useState<ModalStackItem[]>([]);

  const topModal = useMemo(() => {
    return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
  }, [modalStack]);

  const pushModal = useCallback((modal: ModalData) => {
    // Debug: log shard modal push payload to help diagnose missing metadata
     
    if (modal.type === 'shard') console.debug('pushModal shard', modal);
    const newModal: ModalStackItem = {
      ...modal,
      id: generateModalId(),
    };
    setModalStack((prev) => {
      const exists = prev.some((m) => {
        if (modal.type === 'index') return m.type === 'index' && m.indexName === modal.indexName;
        if (modal.type === 'shard') return m.type === 'shard' && m.shardId === modal.shardId && m.indexName === modal.indexName;
        if (modal.type === 'node') return m.type === 'node' && m.nodeId === modal.nodeId;
        return false;
      });
      if (exists) return prev;
      return [...prev, newModal];
    });
  }, []);

  const popModal = useCallback(() => {
    setModalStack((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const clearModals = useCallback(() => {
    setModalStack([]);
  }, []);

  const hasModalAbove = useCallback(
    (modalId: string): boolean => {
      const modalIndex = modalStack.findIndex((m) => m.id === modalId);
      if (modalIndex === -1) return false;
      return modalIndex < modalStack.length - 1;
    },
    [modalStack]
  );

  return {
    modalStack,
    topModal,
    pushModal,
    popModal,
    clearModals,
    hasModalAbove,
  };
}
