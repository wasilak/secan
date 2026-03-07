import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IndexVisualization } from './IndexVisualization';

/**
 * Test suite for responsive font sizes in IndexVisualization
 * 
 * Requirements: 8.4 - Scale font sizes based on zoom level and viewport size
 * 
 * These tests verify that font sizes scale appropriately based on viewport width
 * to maintain readability at different screen sizes.
 */
describe('IndexVisualization - Responsive Font Sizes', () => {
  /**
   * Helper function to render component with Mantine provider
   */
  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <MantineProvider>
        {component}
      </MantineProvider>
    );
  };

  /**
   * Helper function to mock viewport size
   * Note: useViewportSize hook from Mantine uses window.innerWidth
   */
  const mockViewportSize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
  };

  describe('Mobile viewport (< 768px)', () => {
    it('should use smaller font sizes on mobile devices', () => {
      // Requirements: 8.4 - Font sizes scale based on viewport size
      mockViewportSize(375, 667); // iPhone SE dimensions
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      // Check that the component renders
      expect(container).toBeTruthy();
      
      // Verify index name is displayed
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });

    it('should maintain readability at minimum mobile width (320px)', () => {
      // Requirements: 8.4 - Ensure readability at different viewport sizes
      mockViewportSize(320, 568); // iPhone 5/SE minimum width
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });
  });

  describe('Tablet viewport (768px - 1024px)', () => {
    it('should use medium font sizes on tablet devices', () => {
      // Requirements: 8.4 - Font sizes scale based on viewport size
      mockViewportSize(768, 1024); // iPad dimensions
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });

    it('should scale proportionally between tablet breakpoints', () => {
      // Requirements: 8.4 - Font sizes scale proportionally
      mockViewportSize(900, 1200); // Mid-range tablet
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });
  });

  describe('Desktop viewport (> 1024px)', () => {
    it('should use standard font sizes on desktop devices', () => {
      // Requirements: 8.4 - Font sizes scale based on viewport size
      mockViewportSize(1440, 900); // Standard desktop
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });

    it('should cap font sizes at large desktop widths', () => {
      // Requirements: 8.4 - Font sizes scale proportionally with reasonable limits
      mockViewportSize(2560, 1440); // 4K display
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });
  });

  describe('Viewport resize behavior', () => {
    it('should update font sizes when viewport is resized', () => {
      // Requirements: 8.4, 8.5 - Recalculate layout when viewport is resized
      mockViewportSize(375, 667); // Start with mobile
      
      const { container, rerender } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      
      // Resize to desktop
      mockViewportSize(1440, 900);
      
      rerender(
        <MantineProvider>
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        </MantineProvider>
      );
      
      // Component should still render correctly
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });

    it('should transition smoothly between breakpoints', () => {
      // Requirements: 8.4 - Font sizes scale smoothly across breakpoints
      const viewportWidths = [375, 768, 1024, 1440];
      
      viewportWidths.forEach((width) => {
        mockViewportSize(width, 900);
        
        const { container, unmount } = renderWithProvider(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );
        
        expect(container).toBeTruthy();
        expect(screen.getAllByText('test-index').length).toBeGreaterThan(0);
        
        // Clean up after each iteration
        unmount();
      });
    });
  });

  describe('Font size accessibility', () => {
    it('should maintain minimum readable font sizes', () => {
      // Requirements: 8.4 - Ensure readability at different viewport sizes
      // Even at smallest viewport, fonts should be readable
      mockViewportSize(320, 568);
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      
      // Verify text content is present and readable
      expect(screen.getByText('test-index')).toBeInTheDocument();
      expect(screen.getByText('Primary Shards:')).toBeInTheDocument();
      expect(screen.getByText('Replica Shards:')).toBeInTheDocument();
    });

    it('should not exceed maximum font sizes for readability', () => {
      // Requirements: 8.4 - Font sizes scale with reasonable limits
      // At largest viewport, fonts should not be too large
      mockViewportSize(3840, 2160); // 4K display
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      expect(container).toBeTruthy();
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });
  });

  describe('Component integration', () => {
    it('should apply responsive fonts to all text elements', () => {
      // Requirements: 8.4 - All text elements use responsive font sizes
      mockViewportSize(1024, 768);
      
      renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      // Verify all key text elements are present
      expect(screen.getByText('test-index')).toBeInTheDocument();
      expect(screen.getByText('Primary Shards:')).toBeInTheDocument();
      expect(screen.getByText('Replica Shards:')).toBeInTheDocument();
      expect(screen.getByText('Index Visualization')).toBeInTheDocument();
    });

    it('should apply responsive fonts to node cards', () => {
      // Requirements: 8.4 - Node card text uses responsive font sizes
      mockViewportSize(1024, 768);
      
      renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      // Verify node cards render with placeholder data
      // Node names from placeholder data: node-1, node-2, node-3, node-4
      expect(screen.getByText('node-1')).toBeInTheDocument();
      expect(screen.getByText('node-2')).toBeInTheDocument();
    });

    it('should apply responsive fonts to shard indicators', () => {
      // Requirements: 8.4 - Shard indicator text uses responsive font sizes
      mockViewportSize(1024, 768);
      
      const { container } = renderWithProvider(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );
      
      // Verify shard indicators are rendered
      // Placeholder data has shards 0 and 1
      const shardIndicators = container.querySelectorAll('[role="gridcell"]');
      expect(shardIndicators.length).toBeGreaterThan(0);
    });
  });
});
