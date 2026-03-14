import { Modal, Box } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { ConsoleContent } from './ConsoleContent';
import { DURATIONS, EASINGS } from '../lib/transitions';

/**
 * ConsoleModal renders the console as a modal overlay
 * Used when console is in detached mode
 */
export function ConsoleModal() {
  const { isOpen, isDetached, clusterId, closePanel } = useConsolePanel();

  const shouldRender = isOpen && isDetached && clusterId;

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
              zIndex: 9999,
            },
            inner: {
              zIndex: 9999,
            },
            content: {
              zIndex: 9999,
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
