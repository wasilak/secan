import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { FullWidthContainer } from './FullWidthContainer';
import { DrawerProvider } from '../contexts/DrawerContext';

describe('FullWidthContainer', () => {
  it('renders children correctly', () => {
    render(
      <MantineProvider>
        <DrawerProvider>
          <FullWidthContainer>
            <div>Test Content</div>
          </FullWidthContainer>
        </DrawerProvider>
      </MantineProvider>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies full width style', () => {
    const { container } = render(
      <MantineProvider>
        <DrawerProvider>
          <FullWidthContainer>
            <div>Test Content</div>
          </FullWidthContainer>
        </DrawerProvider>
      </MantineProvider>
    );

    const box = container.firstChild as HTMLElement;
    expect(box).toHaveStyle({ width: '100%' });
  });

  it('applies custom padding when provided', () => {
    render(
      <MantineProvider>
        <DrawerProvider>
          <FullWidthContainer padding="2rem">
            <div>Test Content</div>
          </FullWidthContainer>
        </DrawerProvider>
      </MantineProvider>
    );

    const box = screen.getByText('Test Content').parentElement;
    expect(box).toHaveStyle({ padding: '2rem' });
  });

  it('applies custom styles', () => {
    render(
      <MantineProvider>
        <DrawerProvider>
          <FullWidthContainer style={{ backgroundColor: 'red' }}>
            <div>Test Content</div>
          </FullWidthContainer>
        </DrawerProvider>
      </MantineProvider>
    );

    const box = screen.getByText('Test Content').parentElement;
    expect(box).toHaveStyle({ backgroundColor: 'red' });
  });

  it('forwards additional Box props', () => {
    render(
      <MantineProvider>
        <DrawerProvider>
          <FullWidthContainer data-testid="custom-container">
            <div>Test Content</div>
          </FullWidthContainer>
        </DrawerProvider>
      </MantineProvider>
    );

    expect(screen.getByTestId('custom-container')).toBeInTheDocument();
  });
});
