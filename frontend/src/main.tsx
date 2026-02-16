import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import './styles/responsive.css';
import { router } from './router';
import { queryClient } from './lib/query-client';
import { configureMonaco } from './lib/monacoConfig';
import { RefreshProvider } from './contexts/RefreshContext';
import { DrawerProvider } from './contexts/DrawerContext';

// Configure Monaco Editor to use bundled files instead of CDN
configureMonaco();

// Create custom theme configuration with responsive design
const theme = createTheme({
  /** Secan theme customization */
  primaryColor: 'blue',
  defaultRadius: 'md',
  
  // Responsive breakpoints
  breakpoints: {
    xs: '36em',    // 576px - Mobile
    sm: '48em',    // 768px - Tablet
    md: '62em',    // 992px - Small laptop
    lg: '75em',    // 1200px - Desktop
    xl: '88em',    // 1408px - Large desktop
  },
  
  // Responsive typography
  fontSizes: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    md: '1rem',      // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
  },
  
  // Responsive spacing
  spacing: {
    xs: '0.625rem',  // 10px
    sm: '0.75rem',   // 12px
    md: '1rem',      // 16px
    lg: '1.25rem',   // 20px
    xl: '1.5rem',    // 24px
  },
  
  // Ensure minimum touch target size (44x44px)
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        root: {
          minHeight: '44px',
          minWidth: '44px',
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        size: 'lg',
      },
      styles: {
        root: {
          minHeight: '44px',
          minWidth: '44px',
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          minHeight: '44px',
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <DrawerProvider>
          <RefreshProvider>
            <Notifications />
            <RouterProvider router={router} />
          </RefreshProvider>
        </DrawerProvider>
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
