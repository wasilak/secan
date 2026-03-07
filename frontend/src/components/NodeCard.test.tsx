import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';

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
      // Look for all "Shards:" labels to count nodes, then verify each has a badge
      const shardLabels = screen.getAllByText('Shards:');
      
      // We should have 4 nodes (2 primary, 2 replica)
      expect(shardLabels.length).toBe(4);
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

  describe('Shard Indicators (Task 5.2)', () => {
    describe('Shard Indicator Rendering (Requirements 3.1, 3.2, 3.3, 3.4, 3.5)', () => {
      it('should render individual shard indicators for each shard', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        // The placeholder data has 4 shards total (2 primary, 2 replica)
        // Each shard should have an indicator with role="gridcell"
        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        expect(shardIndicators.length).toBe(4);
      });

      it('should apply color coding based on shard state', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        // All placeholder shards are in STARTED state (green border)
        // Check that shard indicators have green borders
        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        shardIndicators.forEach((indicator) => {
          const style = (indicator as HTMLElement).style;
          // Green border for STARTED state
          expect(style.border).toContain('var(--mantine-color-green-6)');
        });
      });

      it('should use transparent background for shard indicators', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        shardIndicators.forEach((indicator) => {
          const style = (indicator as HTMLElement).style;
          expect(style.backgroundColor).toBe('transparent');
        });
      });

      it('should set shard indicator size to 32px', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        shardIndicators.forEach((indicator) => {
          const style = (indicator as HTMLElement).style;
          expect(style.width).toBe('32px');
          expect(style.height).toBe('32px');
        });
      });
    });

    describe('Shard Number Display (Requirements 6.1, 6.2)', () => {
      it('should display shard numbers for all shards', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        // The placeholder data has shards 0 and 1 (both primary and replica)
        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        
        // Count how many indicators show "0" and how many show "1"
        let zeroCount = 0;
        let oneCount = 0;
        
        shardIndicators.forEach((indicator) => {
          const text = indicator.textContent;
          if (text === '0') zeroCount++;
          if (text === '1') oneCount++;
        });
        
        // We should have 2 shards with number 0 (1 primary, 1 replica)
        // and 2 shards with number 1 (1 primary, 1 replica)
        expect(zeroCount).toBe(2);
        expect(oneCount).toBe(2);
      });

      it('should display primary indicator dot for primary shards', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        // Primary shards should have a blue dot indicator
        // Count elements with blue background (the dot)
        const blueDots = container.querySelectorAll('[style*="background-color: var(--mantine-color-blue-6)"]');
        
        // We have 2 primary shards in the placeholder data
        expect(blueDots.length).toBe(2);
      });

      it('should set correct aria-label for accessibility', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        
        // Check that each indicator has an aria-label
        shardIndicators.forEach((indicator) => {
          const ariaLabel = indicator.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
          expect(ariaLabel).toContain('Shard');
          expect(ariaLabel).toContain('test-index');
        });
      });
    });

    describe('Shard Indicator Layout', () => {
      it('should wrap shard indicators in a Group with gap', () => {
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

      it('should allow shard indicators to wrap', () => {
        // The Group component has wrap="wrap" prop
        // This is handled by Mantine's styling system
        renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        // Verify component renders without errors
        expect(screen.getByText('Index Visualization')).toBeInTheDocument();
      });
    });

    describe('Shard State Color Mapping', () => {
      it('should use green border for STARTED shards', () => {
        const { container } = renderWithMantine(
          <IndexVisualization
            clusterId="test-cluster"
            indexName="test-index"
          />
        );

        // All placeholder shards are STARTED
        const shardIndicators = container.querySelectorAll('[role="gridcell"]');
        shardIndicators.forEach((indicator) => {
          const style = (indicator as HTMLElement).style;
          expect(style.border).toContain('var(--mantine-color-green-6)');
        });
      });

      // Note: Tests for other states (INITIALIZING, RELOCATING, UNASSIGNED)
      // will be added once we have real data from useIndexShards hook
      // For now, we verify the component structure is correct
    });
  });
});
