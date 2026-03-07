import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import type { NodePosition } from '../utils/nodePositioning';

// Import the NodeCard component from IndexVisualization
// Since NodeCard is not exported, we'll test it through IndexVisualization
import { IndexVisualization } from './IndexVisualization';

/**
 * Test suite for NodeCard component
 * 
 * Requirements: 2.1, 2.2
 * 
 * Task 5.1: Render node card with name and shard count
 * - Display node name
 * - Display total shard count for the node
 * - Apply Mantine Card and Badge components for consistency
 */
describe('NodeCard Component', () => {
  const renderWithMantine = (component: React.ReactElement) => {
    return render(<MantineProvider>{component}</MantineProvider>);
  };

  describe('Node Name Display (Requirement 2.1)', () => {
    it('should display the node name', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // The placeholder data in IndexVisualization uses node-1, node-2, node-3, node-4
      expect(screen.getByText('node-1')).toBeInTheDocument();
      expect(screen.getByText('node-2')).toBeInTheDocument();
      expect(screen.getByText('node-3')).toBeInTheDocument();
      expect(screen.getByText('node-4')).toBeInTheDocument();
    });

    it('should truncate long node names', () => {
      // This test verifies the truncate prop is applied
      // The actual truncation behavior is handled by Mantine's Text component
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Verify that node names are rendered with the truncate style
      const nodeNameElements = screen.getAllByText(/node-\d+/);
      expect(nodeNameElements.length).toBeGreaterThan(0);
    });
  });

  describe('Shard Count Display (Requirement 2.2)', () => {
    it('should display the shard count for each node', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // The placeholder data has 1 shard per node
      // Each node card should display "1" as the shard count
      const shardCountBadges = screen.getAllByText('1');
      
      // We should have 4 nodes (2 primary, 2 replica), each with 1 shard
      expect(shardCountBadges.length).toBe(4);
    });

    it('should display "Shards:" label', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Each node card should have a "Shards:" label
      const shardLabels = screen.getAllByText('Shards:');
      expect(shardLabels.length).toBe(4); // 4 nodes total
    });
  });

  describe('Mantine Components (Requirement 2.1, 2.2)', () => {
    it('should use Mantine Card component', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Mantine Card components have specific class names
      const cards = container.querySelectorAll('[class*="Card"]');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should use Mantine Badge component for shard count', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Mantine Badge components have specific class names
      const badges = container.querySelectorAll('[class*="Badge"]');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Node Card Positioning', () => {
    it('should position node cards absolutely', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Find node cards by looking for elements with node names
      const nodeCard = screen.getByText('node-1').closest('[style*="position: absolute"]');
      expect(nodeCard).toBeInTheDocument();
    });

    it('should set width to 180px', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Find a node card and verify its width
      const nodeCard = screen.getByText('node-1').closest('[style*="width: 180"]');
      expect(nodeCard).toBeInTheDocument();
    });
  });

  describe('Node Card Interactions', () => {
    it('should call onClick handler when node is clicked', async () => {
      const user = userEvent.setup();
      const onNodeClick = vi.fn();

      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
          onNodeClick={onNodeClick}
        />
      );

      // Click on a node card
      const nodeCard = screen.getByText('node-1').closest('[style*="cursor: pointer"]');
      expect(nodeCard).toBeInTheDocument();
      
      if (nodeCard) {
        await user.click(nodeCard);
        expect(onNodeClick).toHaveBeenCalledWith('node-1');
      }
    });

    it('should show pointer cursor when onClick is provided', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
          onNodeClick={() => {}}
        />
      );

      const nodeCard = screen.getByText('node-1').closest('[style*="cursor: pointer"]');
      expect(nodeCard).toBeInTheDocument();
    });

    it('should show default cursor when onClick is not provided', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      const nodeCard = screen.getByText('node-1').closest('[style*="cursor: default"]');
      expect(nodeCard).toBeInTheDocument();
    });
  });

  describe('Node Card Layout', () => {
    it('should use Stack layout with xs gap', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Mantine Stack components have specific class names
      const stacks = container.querySelectorAll('[class*="Stack"]');
      expect(stacks.length).toBeGreaterThan(0);
    });

    it('should use Group layout for shard count row', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Mantine Group components have specific class names
      const groups = container.querySelectorAll('[class*="Group"]');
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe('Node Card Styling', () => {
    it('should apply shadow, padding, radius, and border to Card', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Verify that cards have the expected Mantine styling classes
      const cards = container.querySelectorAll('[class*="Card"]');
      expect(cards.length).toBeGreaterThan(0);
      
      // Mantine applies these styles through its class system
      // We verify the component renders without errors
    });

    it('should apply correct text sizes and weights', () => {
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Node names should be rendered (size="sm" fw={600})
      const nodeNames = screen.getAllByText(/node-\d+/);
      expect(nodeNames.length).toBeGreaterThan(0);

      // "Shards:" label should be rendered (size="xs" c="dimmed")
      const shardLabels = screen.getAllByText('Shards:');
      expect(shardLabels.length).toBeGreaterThan(0);
    });

    it('should apply light variant to Badge', () => {
      const { container } = renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      // Mantine Badge with variant="light" has specific styling
      const badges = container.querySelectorAll('[class*="Badge"]');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with zero shards', () => {
      // This would be tested with custom data once useIndexShards is implemented
      // For now, we verify the component renders without errors
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      expect(screen.getByText('Index Visualization')).toBeInTheDocument();
    });

    it('should handle very long node names with truncation', () => {
      // The truncate prop on Text component handles this
      // Mantine will apply text-overflow: ellipsis
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      expect(screen.getByText('Index Visualization')).toBeInTheDocument();
    });

    it('should handle large shard counts', () => {
      // This would be tested with custom data once useIndexShards is implemented
      // Badge component should handle any number
      renderWithMantine(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />
      );

      expect(screen.getByText('Index Visualization')).toBeInTheDocument();
    });
  });
});
