import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ModalManagerContextValue = {
  modalCount: number;
  isModalOpen: boolean;
  registerModal: () => () => void;
  openModal: () => void;
  closeModal: () => void;
  overlayZIndex?: number;
  setOverlayZIndex: (z?: number) => void;
};

const ModalManagerContext = createContext<ModalManagerContextValue | undefined>(undefined);

export const ModalManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalCount, setModalCount] = useState(0);
  const [overlayZIndex, setOverlayZIndexState] = useState<number | undefined>(undefined);
  // Track whether we placed the global override so we only delete what we created
  const ownGlobalRef = useRef(false);

  const registerModal = useCallback(() => {
    setModalCount((c) => c + 1);
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      setModalCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const openModal = useCallback(() => setModalCount((c) => c + 1), []);
  const closeModal = useCallback(() => setModalCount((c) => Math.max(0, c - 1)), []);

  const setOverlayZIndex = useCallback((z?: number) => {
    setOverlayZIndexState(z);
    try {
      if (typeof z === 'number') {
        // export for backward compatibility; write to a typed window field
        (window as unknown as { __SE_CAN_CONSOLE_Z_INDEX__?: number }).__SE_CAN_CONSOLE_Z_INDEX__ = z;
        ownGlobalRef.current = true;
      } else {
        if (ownGlobalRef.current) {
          delete (window as unknown as { __SE_CAN_CONSOLE_Z_INDEX__?: number }).__SE_CAN_CONSOLE_Z_INDEX__;
          ownGlobalRef.current = false;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const onExternal = (e: Event) => {
      const ev = e as CustomEvent<Record<string, unknown>>;
      const d = ev?.detail as Record<string, unknown> | undefined;
      if (!d) return;
      if (d.open === true) openModal();
      if (d.close === true) closeModal();
      if (typeof d.count === 'number') setModalCount(Math.max(0, d.count));
      if (typeof d.overlayZIndex === 'number') setOverlayZIndex(d.overlayZIndex as number);
    };

    window.addEventListener('secan:modal-change', onExternal as EventListener);
    return () => window.removeEventListener('secan:modal-change', onExternal as EventListener);
  }, [openModal, closeModal, setOverlayZIndex]);

  const value: ModalManagerContextValue = {
    modalCount,
    isModalOpen: modalCount > 0,
    registerModal,
    openModal,
    closeModal,
    overlayZIndex,
    setOverlayZIndex,
  };

  return <ModalManagerContext.Provider value={value}>{children}</ModalManagerContext.Provider>;
};

export const useModalManager = () => {
  const ctx = useContext(ModalManagerContext);
  if (!ctx) throw new Error('useModalManager must be used within ModalManagerProvider');
  return ctx;
};
