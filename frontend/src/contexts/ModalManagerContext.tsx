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

// Provide a safe fallback when the provider isn't mounted. Tests and some
// lightweight renderers may mount consumers without the provider in place,
// so return a no-op implementation rather than throwing to make those
// renders resilient. The real provider will override this when present.
export const useModalManager = () => {
  const ctx = useContext(ModalManagerContext);

  // Always create fallback hooks to keep hook order stable whether a
  // provider is present or not. When a real provider exists we return it,
  // otherwise we expose a lightweight DOM-based fallback that detects
  // dialogs via MutationObserver so tests that don't mount the provider
  // still behave reasonably.
  const [modalCount, setModalCount] = useState(0);
  const [overlayZIndex, setOverlayZIndexState] = useState<number | undefined>(undefined);
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
        (window as unknown as { __SE_CAN_CONSOLE_Z_INDEX__?: number }).__SE_CAN_CONSOLE_Z_INDEX__ = z;
        ownGlobalRef.current = true;
      } else {
        if (ownGlobalRef.current) {
          delete (window as unknown as { __SE_CAN_CONSOLE_Z_INDEX__?: number }).__SE_CAN_CONSOLE_Z_INDEX__;
          ownGlobalRef.current = false;
        }
      }
    } catch {
      // ignore for non-browser environments
    }
  }, []);

  // DOM-based detection: watch for elements that look like modals/dialogs and
  // mark modalCount accordingly. This is a minimal heuristic used only when
  // the real provider isn't mounted (tests and some renderers).
  useEffect(() => {
    const checkDialogs = () => {
      try {
        const nodes = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')) as HTMLElement[];
        const visible = nodes.some((n) => {
          try {
            const rect = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
            if (rect && (rect.width > 0 || rect.height > 0)) return true;
            const style = window.getComputedStyle ? window.getComputedStyle(n) : ({} as CSSStyleDeclaration);
            if (style.display === 'none') return false;
            if (style.visibility === 'hidden') return false;
            if ((n as HTMLElement).offsetWidth > 0 || (n as HTMLElement).offsetHeight > 0) return true;
            return false;
          } catch {
            return false;
          }
        });
        setModalCount(visible ? 1 : 0);
      } catch {
        // In non-browser envs, do nothing
      }
    };

    checkDialogs();
    const mo = new MutationObserver(checkDialogs);
    try {
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-modal', 'role'] });
    } catch {
      // ignore if document.body is not present
    }

    return () => mo.disconnect();
  }, []);

  // Listen to the same custom event hook the provider supports so tests or
  // other code can still control modal state via events.
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

  if (ctx) return ctx;

  return {
    modalCount,
    isModalOpen: modalCount > 0,
    registerModal,
    openModal,
    closeModal,
    overlayZIndex,
    setOverlayZIndex,
  } as ModalManagerContextValue;
};
