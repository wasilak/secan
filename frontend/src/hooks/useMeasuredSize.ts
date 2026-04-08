import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMeasuredSizeOptions {
  bottomMargin?: number; // px to leave under the element
  minHeight?: number; // px minimal height
  debounceMs?: number; // ms debounce for resize handler
}

/**
 * Measure available width/height for an element based on viewport:
 * height = max(minHeight, window.innerHeight - rect.top - bottomMargin)
 *
 * Returns:
 *  - containerRef: attach to the wrapper element
 *  - size: { width, height }
 *  - measure: manual measurement trigger
 */
export function useMeasuredSize(opts: UseMeasuredSizeOptions = {}) {
  const { bottomMargin = 48, minHeight = 200, debounceMs = 120 } = opts;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const w = Math.floor(el.clientWidth);
    const h = Math.max(minHeight, Math.floor(window.innerHeight - rect.top - bottomMargin));
    setSize((prev) => (prev.width !== w || prev.height !== h ? { width: w, height: h } : prev));
  }, [bottomMargin, minHeight]);

  useEffect(() => {
    // initial measurement
    measure();
    // Sometimes layout hasn't settled at first effect invocation (flex children
    // may compute width/height later). Schedule a rAF re-measure to catch
    // post-layout sizes so components that depend on the measurement render
    // immediately without waiting for a window.resize.
    try {
      rafRef.current = window.requestAnimationFrame(() => {
        measure();
        rafRef.current = null;
      }) as unknown as number;
    } catch {
      rafRef.current = null;
    }

    const onResize = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        measure();
        timerRef.current = null;
      }, debounceMs) as unknown as number;
    };

    window.addEventListener('resize', onResize);
    // Observe common layout-affecting mutations (e.g. sidebar toggles that
    // change document.body.className) so we re-measure when window.resize is
    // not emitted. Keep the observer narrow (attributes only) to avoid
    // performance issues.
    let mo: MutationObserver | null = null;
    if (typeof document !== 'undefined' && document.body && (window.MutationObserver)) {
      try {
        mo = new MutationObserver(() => {
          onResize();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
      } catch {
        // Best-effort: if MutationObserver isn't available or observing fails,
        // silently continue—the window.resize fallback still works.
        mo = null;
      }
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (mo) {
        try { mo.disconnect(); } catch { /* ignore */ }
        mo = null;
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      if (rafRef.current) {
        try { window.cancelAnimationFrame(rafRef.current); } catch { /* ignore */ }
        rafRef.current = null;
      }
    };
  }, [measure, debounceMs]);

  return { containerRef, size, measure } as const;
}
