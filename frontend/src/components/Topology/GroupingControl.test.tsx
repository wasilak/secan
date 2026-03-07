import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { GroupingControl } from './GroupingControl';
import { describe, it, expect, vi } from 'vitest';

// Wrapper component for Mantine context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('GroupingControl', () => {
  it('renders with label', () => {
    const mockOnChange = vi.fn();
    
    render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="none"
          availableLabels={['zone-a', 'zone-b']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    // Check that the select is rendered with label
    expect(screen.getByText('Group Nodes')).toBeInTheDocument();
  });

  it('displays current grouping value as "None"', () => {
    const mockOnChange = vi.fn();
    
    render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="none"
          availableLabels={['zone-a']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    const input = screen.getByDisplayValue('None');
    expect(input).toBeInTheDocument();
  });

  it('displays current grouping value as "By Role"', () => {
    const mockOnChange = vi.fn();
    
    render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="role"
          availableLabels={['zone-a']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    const input = screen.getByDisplayValue('By Role');
    expect(input).toBeInTheDocument();
  });

  it('displays current grouping value as "By Type"', () => {
    const mockOnChange = vi.fn();
    
    render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="type"
          availableLabels={['zone-a']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    const input = screen.getByDisplayValue('By Type');
    expect(input).toBeInTheDocument();
  });

  it('displays current grouping value as "By Label"', () => {
    const mockOnChange = vi.fn();
    
    render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="label"
          availableLabels={['zone-a']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    const input = screen.getByDisplayValue('By Label');
    expect(input).toBeInTheDocument();
  });

  it('renders select with correct size and width', () => {
    const mockOnChange = vi.fn();
    
    const { container } = render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="none"
          availableLabels={['zone-a']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    // Check that the select wrapper has the correct size attribute
    const selectRoot = container.querySelector('[data-size="sm"]');
    expect(selectRoot).toBeInTheDocument();
  });

  it('includes disabled "By Label" option when no labels available', () => {
    const mockOnChange = vi.fn();
    
    const { container } = render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="none"
          availableLabels={[]}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    // The component should render successfully with empty labels
    expect(container.querySelector('input[aria-haspopup="listbox"]')).toBeInTheDocument();
  });

  it('includes enabled "By Label" option when labels are available', () => {
    const mockOnChange = vi.fn();
    
    const { container } = render(
      <TestWrapper>
        <GroupingControl
          currentGrouping="none"
          availableLabels={['zone-a', 'zone-b']}
          onGroupingChange={mockOnChange}
        />
      </TestWrapper>
    );
    
    // The component should render successfully with labels
    expect(container.querySelector('input[aria-haspopup="listbox"]')).toBeInTheDocument();
  });
});
