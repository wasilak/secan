import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect } from 'vitest';
import { MasterIndicator } from './MasterIndicator';

// Wrapper component for Mantine context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('MasterIndicator', () => {
  it('renders filled crown for master node', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={true} isMasterEligible={true} showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByText('♛');
    expect(indicator).toBeInTheDocument();
  });

  it('renders hollow crown for master-eligible node', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={false} isMasterEligible={true} showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByText('♔');
    expect(indicator).toBeInTheDocument();
  });

  it('renders nothing for non-master, non-eligible node', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={false} isMasterEligible={false} showTooltip={false} />
      </TestWrapper>
    );
    
    // Should not render any crown indicators
    expect(screen.queryByText('♛')).not.toBeInTheDocument();
    expect(screen.queryByText('♔')).not.toBeInTheDocument();
  });

  it('applies correct aria-label for master node', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={true} isMasterEligible={true} showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByLabelText('Current Master');
    expect(indicator).toBeInTheDocument();
  });

  it('applies correct aria-label for master-eligible node', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={false} isMasterEligible={true} showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByLabelText('Master Eligible');
    expect(indicator).toBeInTheDocument();
  });

  it('renders with small size', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={true} isMasterEligible={true} size="sm" showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByText('♛');
    expect(indicator).toHaveStyle({ fontSize: '14px' });
  });

  it('renders with medium size by default', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={true} isMasterEligible={true} showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByText('♛');
    expect(indicator).toHaveStyle({ fontSize: '18px' });
  });

  it('renders with large size', () => {
    render(
      <TestWrapper>
        <MasterIndicator isMaster={true} isMasterEligible={true} size="lg" showTooltip={false} />
      </TestWrapper>
    );
    
    const indicator = screen.getByText('♛');
    expect(indicator).toHaveStyle({ fontSize: '24px' });
  });
});
