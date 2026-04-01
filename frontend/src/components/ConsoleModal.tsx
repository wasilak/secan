import { Modal, Box } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { ConsoleContent } from './ConsoleContent';
import { DURATIONS, EASINGS } from '../lib/transitions';
import { useModalManager } from '../contexts/ModalManagerContext';

/**
 * ConsoleModal renders the console as a modal overlay
 * Used when console is in detached mode
 */
export function ConsoleModal() {
  const { isOpen, isDetached, clusterId, closePanel, isSticky, width } = useConsolePanel();
  const { overlayZIndex } = useModalManager();

  const shouldRender = isOpen && isDetached && clusterId;

  // When the console is pinned as a right sidebar we don't want the modal
  // backdrop/content to hide that sidebar. If the sidebar is pinned we offset
  // the modal overlay from the right by the console width so the pinned
  // console remains visible while the detached console appears on top of
  // other modals.
  // Access potential global override in a typed-safe way to avoid `any` usage
  const globalWindow = window as unknown as { __SE_CAN_CONSOLE_Z_INDEX__?: number };
  const globalZ = typeof overlayZIndex !== 'undefined'
    ? overlayZIndex
    : (typeof globalWindow.__SE_CAN_CONSOLE_Z_INDEX__ !== 'undefined' ? globalWindow.__SE_CAN_CONSOLE_Z_INDEX__ : 10500);

  // When pinned, avoid covering the pinned console. Clamp so modal area never becomes too narrow.
  const MIN_MODAL_WIDTH = 420;
  let overlayRight: string | undefined = undefined;
  if (isSticky && width) {
    // compute right offset but ensure remaining width >= MIN_MODAL_WIDTH
    const remaining = window.innerWidth - width;
    const clampedRemaining = Math.max(remaining, MIN_MODAL_WIDTH);
    const rightPx = window.innerWidth - clampedRemaining;
    overlayRight = `${rightPx}px`;
  }

  return (
    <AnimatePresence>
      {shouldRender && (
        <Modal
          opened={true}
          onClose={closePanel}
          title="REST Console"
          trapFocus={false}

          styles={{
            overlay: {
              // Put console modal above regular app modals but below global notifications
              zIndex: globalZ,
              // If a pinned console exists on the right, avoid covering it
              right: overlayRight,
            },
            inner: {
              zIndex: globalZ,
              right: overlayRight,
            },
            content: {
              zIndex: globalZ,
              // Ensure modal content does not overlap the pinned console
              marginRight: overlayRight,
            },
            body: {
              height: '70vh',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: DURATIONS.slow,
              ease: EASINGS.default,
            }}
            style={{ height: '100%' }}
          >
            <Box style={{ height: '100%' }}>
              <ConsoleContent clusterId={clusterId} />
            </Box>
          </motion.div>
        </Modal>
      )}
    </AnimatePresence>
  );
}
