import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { IndexVisualization } from './IndexVisualization';
import * as useIndexShardsModule from '../hooks/useIndexShards';

/**
 * Test suite for IndexVisualization error handling
 * 
 * Requirements: 9.3 - Handle API errors with retry functionality
 * 
 * Tests:
 * - Display error alert when API fails
 * - Show retry button in error state
 * - Trigger refetch when retry button is clicked
 * - Handle empty shard arrays gracefully
 */
describe('IndexVisualization - Error Handling (Task 12.1)', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    
    return ({ children }: { children: React.ReactNode }) => (
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MantineProvider>
    );
  };
  
  describe('API Error Handling', () => {
    it('should display error alert when shard data fetch fails', () => {
      // Mock useIndexShards to return an error
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch shard data'),
        isFetching: false,
        refetch: vi.fn(),
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Verify error alert is displayed
      expect(screen.getByText('Failed to Load Visualization')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch shard data')).toBeInTheDocument();
    });
    
    it('should display retry button in error state', () => {
      // Mock useIndexShards to return an error
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        isFetching: false,
        refetch: vi.fn(),
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Verify retry button is displayed
      expect(screen.getByLabelText('Retry loading visualization')).toBeInTheDocument();
      expect(screen.getByText('Click to retry')).toBeInTheDocument();
    });
    
    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();
      
      // Mock useIndexShards to return an error with refetch function
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        isFetching: false,
        refetch: mockRefetch,
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Click the retry button
      const retryButton = screen.getByLabelText('Retry loading visualization');
      await user.click(retryButton);
      
      // Verify refetch was called
      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalledTimes(1);
      });
    });
  });
  
  describe('Empty State Handling', () => {
    it('should display empty state message when no shards exist', () => {
      // Mock useIndexShards to return empty array
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Verify empty state alert is displayed
      expect(screen.getByText('No Shards Found')).toBeInTheDocument();
      expect(screen.getByText(/No shard data available for index "test-index"/)).toBeInTheDocument();
    });
    
    it('should display empty state message when shards is undefined', () => {
      // Mock useIndexShards to return undefined data
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Verify empty state alert is displayed
      expect(screen.getByText('No Shards Found')).toBeInTheDocument();
    });
  });
  
  describe('Error Message Formatting', () => {
    it('should display custom error message from Error object', () => {
      // Mock useIndexShards to return a custom error
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Connection timeout after 30 seconds'),
        isFetching: false,
        refetch: vi.fn(),
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Verify custom error message is displayed
      expect(screen.getByText('Connection timeout after 30 seconds')).toBeInTheDocument();
    });
    
    it('should display generic error message for non-Error objects', () => {
      // Mock useIndexShards to return a non-Error object
      vi.spyOn(useIndexShardsModule, 'useIndexShards').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: 'String error',
        isFetching: false,
        refetch: vi.fn(),
      } as any);
      
      render(
        <IndexVisualization
          clusterId="test-cluster"
          indexName="test-index"
        />,
        { wrapper: createWrapper() }
      );
      
      // Verify generic error message is displayed
      expect(screen.getByText('An error occurred while loading shard data')).toBeInTheDocument();
    });
  });
});
