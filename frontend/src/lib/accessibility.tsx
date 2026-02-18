/**
 * Accessibility utilities for Secan
 * 
 * Provides utilities for:
 * - Color contrast verification
 * - Screen reader announcements
 * - ARIA live regions
 * 
 * Requirements: 32.5, 32.6, 32.7
 */

import React from 'react';
import { Anchor } from '@mantine/core';

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 specification
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return 1;
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color contrast meets WCAG AA standard
 * AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = isLargeText ? 3 : 4.5;
  return ratio >= threshold;
}

/**
 * Check if color contrast meets WCAG AAA standard
 * AAA requires 7:1 for normal text, 4.5:1 for large text
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = isLargeText ? 4.5 : 7;
  return ratio >= threshold;
}

/**
 * Screen reader announcement utility
 * Creates a live region for screen reader announcements
 */
class ScreenReaderAnnouncer {
  private liveRegion: HTMLDivElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.createLiveRegion();
    }
  }

  private createLiveRegion() {
    // Check if live region already exists
    let region = document.getElementById('sr-live-region') as HTMLDivElement;

    if (!region) {
      region = document.createElement('div');
      region.id = 'sr-live-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.style.position = 'absolute';
      region.style.left = '-10000px';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.overflow = 'hidden';
      document.body.appendChild(region);
    }

    this.liveRegion = region;
  }

  /**
   * Announce a message to screen readers
   * @param message - The message to announce
   * @param priority - 'polite' (default) or 'assertive'
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.liveRegion) {
      this.createLiveRegion();
    }

    if (this.liveRegion) {
      // Update aria-live attribute
      this.liveRegion.setAttribute('aria-live', priority);

      // Clear and set new message
      this.liveRegion.textContent = '';
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = message;
        }
      }, 100);
    }
  }

  /**
   * Announce an error message
   */
  announceError(message: string) {
    this.announce(`Error: ${message}`, 'assertive');
  }

  /**
   * Announce a success message
   */
  announceSuccess(message: string) {
    this.announce(`Success: ${message}`, 'polite');
  }

  /**
   * Announce a warning message
   */
  announceWarning(message: string) {
    this.announce(`Warning: ${message}`, 'polite');
  }

  /**
   * Announce loading state
   */
  announceLoading(message: string = 'Loading') {
    this.announce(message, 'polite');
  }
}

// Export singleton instance
export const screenReader = new ScreenReaderAnnouncer();

/**
 * Hook to use screen reader announcements in React components
 */
export function useScreenReader() {
  return {
    announce: screenReader.announce.bind(screenReader),
    announceError: screenReader.announceError.bind(screenReader),
    announceSuccess: screenReader.announceSuccess.bind(screenReader),
    announceWarning: screenReader.announceWarning.bind(screenReader),
    announceLoading: screenReader.announceLoading.bind(screenReader),
  };
}

/**
 * Get accessible color for health status
 * Ensures proper contrast ratios
 */
export function getAccessibleHealthColor(
  health: 'green' | 'yellow' | 'red' | 'unreachable',
  isDark: boolean
): string {
  // Return colors that meet WCAG AA contrast requirements
  if (isDark) {
    switch (health) {
      case 'green':
        return '#51cf66'; // Light green for dark background
      case 'yellow':
        return '#ffd43b'; // Light yellow for dark background
      case 'red':
        return '#ff6b6b'; // Light red for dark background
      case 'unreachable':
        return '#909296'; // Light gray for dark background
      default:
        return '#909296';
    }
  } else {
    switch (health) {
      case 'green':
        return '#2f9e44'; // Dark green for light background
      case 'yellow':
        return '#f59f00'; // Dark yellow for light background
      case 'red':
        return '#c92a2a'; // Dark red for light background
      case 'unreachable':
        return '#495057'; // Dark gray for light background
      default:
        return '#495057';
    }
  }
}

/**
 * Visually hidden class for screen reader only content
 * Use this for content that should be read by screen readers but not visible
 */
export const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Skip to main content link for keyboard navigation
 */
export function SkipToMainContent() {
  return (
    <Anchor
      href="#main-content"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
      onFocus={(e) => {
        e.currentTarget.style.position = 'fixed';
        e.currentTarget.style.left = '0';
        e.currentTarget.style.top = '0';
        e.currentTarget.style.width = 'auto';
        e.currentTarget.style.height = 'auto';
        e.currentTarget.style.padding = '1rem';
        e.currentTarget.style.background = '#fff';
        e.currentTarget.style.zIndex = '9999';
      }}
      onBlur={(e) => {
        e.currentTarget.style.position = 'absolute';
        e.currentTarget.style.left = '-10000px';
        e.currentTarget.style.top = 'auto';
        e.currentTarget.style.width = '1px';
        e.currentTarget.style.height = '1px';
        e.currentTarget.style.padding = '0';
      }}
    >
      Skip to main content
    </Anchor>
  );
}
