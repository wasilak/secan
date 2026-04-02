/**
 * Accessibility utilities for Secan
 *
 * Provides utilities for:
 * - Screen reader announcements
 * - ARIA live regions
 *
 * Requirements: 32.5, 32.6, 32.7
 */

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
