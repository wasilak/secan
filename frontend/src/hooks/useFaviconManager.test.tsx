import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFaviconManager } from './useFaviconManager';

describe('useFaviconManager', () => {
  let faviconLink: HTMLLinkElement;

  beforeEach(() => {
    // Create a mock favicon link element
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.href = '/favicon-neutral.svg';
    document.head.appendChild(faviconLink);
  });

  afterEach(() => {
    // Clean up
    if (faviconLink && faviconLink.parentNode) {
      faviconLink.parentNode.removeChild(faviconLink);
    }
  });

  it('should set neutral favicon when clusterHealth is null', () => {
    renderHook(() => useFaviconManager(null));
    
    expect(faviconLink.href).toContain('/favicon-neutral.svg');
  });

  it('should set green favicon when clusterHealth is green', () => {
    renderHook(() => useFaviconManager('green'));
    
    expect(faviconLink.href).toContain('/favicon-green.svg');
  });

  it('should set yellow favicon when clusterHealth is yellow', () => {
    renderHook(() => useFaviconManager('yellow'));
    
    expect(faviconLink.href).toContain('/favicon-yellow.svg');
  });

  it('should set red favicon when clusterHealth is red', () => {
    renderHook(() => useFaviconManager('red'));
    
    expect(faviconLink.href).toContain('/favicon-red.svg');
  });

  it('should update favicon when clusterHealth changes', () => {
    const { rerender } = renderHook(
      ({ health }) => useFaviconManager(health),
      { initialProps: { health: 'green' as 'green' | 'yellow' | 'red' | null } }
    );
    
    expect(faviconLink.href).toContain('/favicon-green.svg');
    
    rerender({ health: 'yellow' });
    expect(faviconLink.href).toContain('/favicon-yellow.svg');
    
    rerender({ health: 'red' });
    expect(faviconLink.href).toContain('/favicon-red.svg');
    
    rerender({ health: null });
    expect(faviconLink.href).toContain('/favicon-neutral.svg');
  });

  it('should log warning if favicon link element is not found', () => {
    // Remove the favicon link
    faviconLink.parentNode?.removeChild(faviconLink);
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    renderHook(() => useFaviconManager('green'));
    
    expect(consoleWarnSpy).toHaveBeenCalledWith('Favicon link element not found');
    
    consoleWarnSpy.mockRestore();
    
    // Re-add for cleanup
    document.head.appendChild(faviconLink);
  });
});
