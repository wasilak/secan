import { Suspense } from 'react';
import { LoadingFallback } from './LoadingFallback';

/**
 * Wrapper component to add Suspense boundary to lazy-loaded components
 */
export function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}
