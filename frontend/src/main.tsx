import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { router } from './router';
import { queryClient } from './lib/query-client';

// Create custom theme configuration
const theme = createTheme({
  /** Cerebro theme customization will go here */
  primaryColor: 'blue',
  defaultRadius: 'md',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications />
        <RouterProvider router={router} />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
