import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * The three libraries that are most of the bundle, split off from it.
 *
 * Measured, not guessed: building with every package in its own chunk put
 * react-dom at 130 kB, framer-motion at 124 kB and react-router at 40 kB —
 * about 390 kB of the 507 kB entry chunk Vercel's build log was warning
 * about, against roughly 115 kB of our own code.
 *
 * Splitting them is worth doing for the CACHING rather than for the warning.
 * These change when a dependency is upgraded, which is rarely; the app code
 * changes on every deploy. Bundled together, one copy edit invalidates half a
 * megabyte in every returning visitor's cache. Apart, it invalidates the
 * small chunk and leaves the large ones alone.
 *
 * Raising `chunkSizeWarningLimit` would also have removed the warning. It
 * would not have removed the download.
 */
const VENDOR_CHUNKS: Record<string, string> = {
  react: 'react',
  'react-dom': 'react',
  scheduler: 'react',
  'react-router': 'react',
  'react-router-dom': 'react',
  'framer-motion': 'motion',
  'motion-dom': 'motion',
  'motion-utils': 'motion',
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // The package name, matched on a path boundary. A loose
          // `includes('react')` would have swept up `react-router-dom` and
          // `@radix-ui/react-accordion` along with it.
          const match = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/.exec(id);
          return match ? VENDOR_CHUNKS[match[1]] : undefined;
        },
      },
    },
  },
});
