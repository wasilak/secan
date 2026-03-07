/**
 * Unit tests for GroupingErrorBoundary component
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { GroupingErrorBoundary } from './GroupingErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

// Wrapper component with MantineProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('GroupingErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error occurs', () => {
    render(
      <TestWrapper>
        <GroupingErrorBoundary>
          <div>Test content</div>
        </GroupingErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render default fallback UI when error occurs', () => {
    render(
      <TestWrapper>
        <GroupingErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GroupingErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Grouping Error')).toBeInTheDocument();
    expect(
      screen.getByText(/An error occurred while rendering the grouping controls/)
    ).toBeInTheDocument();
  });

  it('should display error message in fallback UI', () => {
    render(
      <TestWrapper>
        <GroupingErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GroupingErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <TestWrapper>
        <GroupingErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </GroupingErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Grouping Error')).not.toBeInTheDocument();
  });

  it('should not render fallback when no error', () => {
    render(
      <TestWrapper>
        <GroupingErrorBoundary>
          <ThrowError shouldThrow={false} />
        </GroupingErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Grouping Error')).not.toBeInTheDocument();
  });

  it('should log error to console', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    render(
      <TestWrapper>
        <GroupingErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GroupingErrorBoundary>
      </TestWrapper>
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

