import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalStack, type ModalData } from './useModalStack';

describe('useModalStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return empty modal stack initially', () => {
      const { result } = renderHook(() => useModalStack());
      expect(result.current.modalStack).toEqual([]);
      expect(result.current.topModal).toBeNull();
    });
  });

  describe('pushModal', () => {
    it('should add a modal to the stack', () => {
      const { result } = renderHook(() => useModalStack());

      const modal: ModalData = { type: 'index', indexName: 'test-index' };

      act(() => {
        result.current.pushModal(modal);
      });

      expect(result.current.modalStack).toHaveLength(1);
      expect(result.current.modalStack[0].type).toBe('index');
      expect(result.current.modalStack[0].indexName).toBe('test-index');
      expect(result.current.topModal?.indexName).toBe('test-index');
    });

    it('should add multiple modals to the stack', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'shard', indexName: 'index-1', shardId: 'shard-0' });
      });

      expect(result.current.modalStack).toHaveLength(2);
      expect(result.current.modalStack[0].type).toBe('index');
      expect(result.current.modalStack[1].type).toBe('shard');
    });

    it('should prevent duplicate modals of the same type and data', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'test-index' });
        result.current.pushModal({ type: 'index', indexName: 'test-index' });
      });

      expect(result.current.modalStack).toHaveLength(1);
    });

    it('should allow same modal type with different data', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'index', indexName: 'index-2' });
      });

      expect(result.current.modalStack).toHaveLength(2);
    });

    it('should generate unique ids for each modal', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'index', indexName: 'index-2' });
      });

      expect(result.current.modalStack[0].id).not.toBe(result.current.modalStack[1].id);
    });
  });

  describe('popModal', () => {
    it('should remove the top modal from the stack', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'shard', indexName: 'index-1', shardId: 'shard-0' });
      });

      act(() => {
        result.current.popModal();
      });

      expect(result.current.modalStack).toHaveLength(1);
      expect(result.current.topModal?.type).toBe('index');
    });

    it('should do nothing when stack is empty', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.popModal();
      });

      expect(result.current.modalStack).toHaveLength(0);
    });

    it('should update topModal after pop', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'index', indexName: 'index-2' });
      });

      expect(result.current.topModal?.indexName).toBe('index-2');

      act(() => {
        result.current.popModal();
      });

      expect(result.current.topModal?.indexName).toBe('index-1');
    });
  });

  describe('clearModals', () => {
    it('should remove all modals from the stack', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'shard', indexName: 'index-1', shardId: 'shard-0' });
      });

      act(() => {
        result.current.clearModals();
      });

      expect(result.current.modalStack).toHaveLength(0);
      expect(result.current.topModal).toBeNull();
    });
  });

  describe('hasModalAbove', () => {
    it('should return true if there is a modal above the given modal', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'shard', indexName: 'index-1', shardId: 'shard-0' });
      });

      const indexModalId = result.current.modalStack[0].id;
      expect(result.current.hasModalAbove(indexModalId)).toBe(true);
    });

    it('should return false if the modal is the top modal', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
        result.current.pushModal({ type: 'shard', indexName: 'index-1', shardId: 'shard-0' });
      });

      const shardModalId = result.current.modalStack[1].id;
      expect(result.current.hasModalAbove(shardModalId)).toBe(false);
    });

    it('should return false for modal not in stack', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
      });

      expect(result.current.hasModalAbove('non-existent-id')).toBe(false);
    });

    it('should return false for single modal in stack', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
      });

      const modalId = result.current.modalStack[0].id;
      expect(result.current.hasModalAbove(modalId)).toBe(false);
    });
  });

  describe('topModal', () => {
    it('should update topModal when pushing modals', () => {
      const { result } = renderHook(() => useModalStack());

      act(() => {
        result.current.pushModal({ type: 'index', indexName: 'index-1' });
      });

      expect(result.current.topModal?.type).toBe('index');
      expect(result.current.topModal?.indexName).toBe('index-1');

      act(() => {
        result.current.pushModal({ type: 'shard', indexName: 'index-1', shardId: 'shard-0' });
      });

      expect(result.current.topModal?.type).toBe('shard');
      expect(result.current.topModal?.shardId).toBe('shard-0');
    });

    it('should be null when stack is empty', () => {
      const { result } = renderHook(() => useModalStack());
      expect(result.current.topModal).toBeNull();
    });
  });
});
