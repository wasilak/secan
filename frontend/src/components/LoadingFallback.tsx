import { Center, Loader } from '@mantine/core';
import { motion } from 'framer-motion';
import { useMotionPreference } from '../lib/transitions';

/**
 * Loading fallback component for lazy-loaded routes
 * Includes fade-in and pulse animations
 */
export function LoadingFallback() {
  const { enabled } = useMotionPreference();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Center h="100vh">
        <motion.div
          animate={
            enabled
              ? {
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7],
                }
              : undefined
          }
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Loader size="lg" />
        </motion.div>
      </Center>
    </motion.div>
  );
}
