import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Short commit id shown on the title screen, so a phone can tell whether it has the newest deploy.
const build = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD').toString(); } catch { return 'dev'; } })()).trim().slice(0, 7);

// Relative base so the build works from any GitHub Pages sub-path (/<repo>/) or from the domain root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
  define: { __BUILD__: JSON.stringify(build) },
});
