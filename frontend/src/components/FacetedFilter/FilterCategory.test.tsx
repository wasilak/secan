import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider, Accordion } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { FilterCategory } from './FilterCategory';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Accordion defaultValue={[]}>
        {children}
      </Accordion>
    </MantineProvider>
  );
}

describe('FilterCategory', () => {
  const defaultProps = {
    title: 'Test Category',
    options: [
      { label: 'Option A', value: 'opt-a' },
      { label: 'Option B', value: 'opt-b' },
      { label: 'Option C', value: 'opt-c' },
    ],
    selected: ['opt-a', 'opt-b', 'opt-c'],
    onChange: vi.fn(),
    allValues: ['opt-a', 'opt-b', 'opt-c'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders category title', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} />
      </TestWrapper>
    );
    expect(screen.getByText('Test Category')).toBeInTheDocument();
  });

  it('renders all filter options', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} />
      </TestWrapper>
    );
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('calls onChange when checkbox is clicked', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} />
      </TestWrapper>
    );
    
    const optionA = screen.getByText('Option A').closest('.mantine-Checkbox-root');
    if (optionA) {
      fireEvent.click(optionA);
    }
    
    expect(defaultProps.onChange).toHaveBeenCalled();
  });

  it('shows ONLY button on hover', async () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} />
      </TestWrapper>
    );
    
    const row = screen.getByText('Option A').closest('.mantine-Group-root');
    if (row) {
      fireEvent.mouseEnter(row);
    }
    
    expect(screen.getByText('ONLY')).toBeInTheDocument();
  });

  it('calls onChange with single value when ONLY is clicked', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} />
      </TestWrapper>
    );
    
    const row = screen.getByText('Option A').closest('.mantine-Group-root');
    if (row) {
      fireEvent.mouseEnter(row);
      const onlyButton = screen.getByText('ONLY');
      fireEvent.click(onlyButton);
    }
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(['opt-a']);
  });

  it('does not show reset button when all options are selected', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} />
      </TestWrapper>
    );
    
    expect(screen.queryByTitle('Reset to all')).not.toBeInTheDocument();
  });

  it('shows reset button when selection is modified', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} selected={['opt-a']} />
      </TestWrapper>
    );
    
    expect(screen.getByTitle('Reset to all')).toBeInTheDocument();
  });

  it('calls onChange with all values when reset is clicked', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} selected={['opt-a']} />
      </TestWrapper>
    );
    
    const resetButton = screen.getByTitle('Reset to all');
    fireEvent.click(resetButton);
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(['opt-a', 'opt-b', 'opt-c']);
  });

  it('displays empty state when no options available', () => {
    render(
      <TestWrapper>
        <FilterCategory {...defaultProps} options={[]} />
      </TestWrapper>
    );
    
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });
});
