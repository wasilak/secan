/**
 * AnimatedModal component
 *
 * Reusable modal wrapper with scale + fade animations using Framer Motion.
 *
 * @module transitions
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@mantine/core';
import { DURATIONS, EASINGS } from '../../lib/transitions';

/**
 * Props for AnimatedModal component
 */
interface AnimatedModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Modal title */
  title?: React.ReactNode;
  /** Modal size */
  size?: string | number;
  /** Whether to center the modal */
  centered?: boolean;
  /** Whether to trap focus inside the modal */
  trapFocus?: boolean;
  /** Z-index for the modal */
  zIndex?: number;
}

/**
 * Animated modal component with scale + fade transitions
 *
 * Provides smooth entrance and exit animations for modal dialogs.
 *
 * @example
 * ```tsx
 * <AnimatedModal
 *   opened={isOpen}
 *   onClose={handleClose}
 *   title="Modal Title"
 *   size="lg"
 * >
 *   <ModalContent />
 * </AnimatedModal>
 * ```
 */
export function AnimatedModal({
  opened,
  onClose,
  children,
  title,
  size = 'md',
  centered = false,
  trapFocus = true,
  zIndex,
}: AnimatedModalProps) {
  return (
    <AnimatePresence>
      {opened && (
        <Modal
          opened={opened}
          onClose={onClose}
          title={title}
          size={size}
          centered={centered}
          trapFocus={trapFocus}
          zIndex={zIndex}

        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: DURATIONS.slow,
              ease: EASINGS.default,
            }}
          >
            {children}
          </motion.div>
        </Modal>
      )}
    </AnimatePresence>
  );
}
