import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>
    );
    
    expect(screen.getByText('Cerebro')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>
    );
    
    expect(screen.getByText('Elasticsearch Web Administration Tool')).toBeInTheDocument();
  });
});
