import { defineConfig } from 'vite';

// Relative base so the build works from any GitHub Pages sub-path (/<repo>/) or from the domain root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
});
