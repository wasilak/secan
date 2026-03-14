import { Suspense } from 'react';
import { LoadingFallback } from './LoadingFallback';
import { FadeIn } from './transitions/FadeIn';

/**
 * Wrapper component to add Suspense boundary to lazy-loaded components
 * Includes fade-in animation when content loads
 */
export function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FadeIn>{children}</FadeIn>
    </Suspense>
  );
}
