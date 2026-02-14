import { Center, Loader } from '@mantine/core';

/**
 * Loading fallback component for lazy-loaded routes
 */
export function LoadingFallback() {
  return (
    <Center h="100vh">
      <Loader size="lg" />
    </Center>
  );
}
