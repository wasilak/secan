import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { IndexVisualization } from './IndexVisualization';

/**
 * Test wrapper with Mantine provider
 */
function renderWithMantine(component: React.ReactElement) {
  return render(<MantineProvider>{component}</MantineProvider>);
}

describe('IndexVisualization', () => {
  describe('Task 4.1: Center Index Element', () => {
    it('should render center index card with index name', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Verify index name is displayed
      expect(screen.getByText('test-index')).toBeInTheDocument();
    });

    it('should display health status with color coding', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Verify health status badge is displayed
      // Using placeholder data (green health)
      expect(screen.getByText('GREEN')).toBeInTheDocument();
    });

    it('should display total primary shard count', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Verify primary shards label and count are displayed
      expect(screen.getByText('Primary Shards:')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Placeholder value
    });

    it('should display total replica shard count', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Verify replica shards label and count are displayed
      expect(screen.getByText('Replica Shards:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Placeholder value
    });

    it('should render center card with proper styling', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="my-index"
        />
      );

      // Verify the card structure exists
      const cards = container.querySelectorAll('.mantine-Card-root');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should display index name with different values', () => {
      const { rerender } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="index-1"
        />
      );

      expect(screen.getByText('index-1')).toBeInTheDocument();

      // Rerender with different index name
      rerender(
        <MantineProvider>
          <IndexVisualization
            clusterId="test-cluster"
            indexName="index-2"
          />
        </MantineProvider>
      );

      expect(screen.getByText('index-2')).toBeInTheDocument();
    });
  });
});
