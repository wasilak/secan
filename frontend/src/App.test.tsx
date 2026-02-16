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
    
    expect(screen.getByText('Secan')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>
    );
    
    expect(screen.getByText('Elasticsearch Cluster Management Tool')).toBeInTheDocument();
  });
});
