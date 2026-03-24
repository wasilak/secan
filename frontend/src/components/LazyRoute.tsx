import { Suspense } from 'react';
import { LoadingFallback } from './LoadingFallback';
import { FadeIn } from './transitions/FadeIn';
import { AppErrorBoundary } from './AppErrorBoundary';

/**
 * Wrapper component to add Suspense boundary to lazy-loaded components.
 * AppErrorBoundary wraps Suspense so it catches both render errors and
 * suspense failures (e.g. network errors during lazy-load).
 * Includes fade-in animation when content loads.
 */
export function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <FadeIn>{children}</FadeIn>
      </Suspense>
    </AppErrorBoundary>
  );
}
