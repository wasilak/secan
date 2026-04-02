import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // When embedding the frontend in the Rust backend for dev/native debugging
    // we may need a non-minified build so React shows full errors (not minified codes).
    // Toggle via environment variable VITE_UNMINIFIED=true
    minify: process.env.VITE_UNMINIFIED === 'true' ? false : undefined,
    sourcemap: process.env.VITE_UNMINIFIED === 'true' ? true : false,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress eval warning from @protobufjs dependency (not our code)
        if (warning.message && warning.message.includes('eval')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: (id) => {
          // Vendor chunk: React ecosystem
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor';
          }
          // Mantine chunk: UI components
          if (id.includes('@mantine/core') || id.includes('@mantine/hooks') || 
              id.includes('@mantine/notifications') || id.includes('@mantine/spotlight')) {
            return 'mantine';
          }
          // Tabler chunk: Icons
          if (id.includes('@tabler/icons-react')) {
            return 'tabler';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
