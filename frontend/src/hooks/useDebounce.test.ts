import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated' });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Value should be updated after delay
    expect(result.current).toBe('updated');
  });

  it('should cancel previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // Rapid changes
    rerender({ value: 'change1' });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change2' });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change3' });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Value should still be initial (only 300ms total, but timer resets)
    expect(result.current).toBe('initial');

    // Complete the final delay
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('change3');
  });

  it('should use custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // Should not update after 300ms
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('initial');

    // Should update after 500ms
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('updated');
  });

  it('should work with different types', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 42 } }
    );

    expect(result.current).toBe(42);

    rerender({ value: 100 });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(100);
  });
});
