import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * `docs/` rather than `dist/` because GitHub Pages can serve a repo's docs
 * folder directly from main — no deploy workflow, no gh-pages branch.
 * The base path matches the repository name so asset URLs resolve there.
 */
export default defineConfig({
  plugins: [react()],
  // Project sites live at /<repo>/, so assets must resolve from there. Set
  // PAGES=0 for a build you intend to serve from a domain root.
  base: process.env.PAGES === '0' ? '/' : '/throughline/',
  resolve: {
    alias: ['domain', 'billing', 'adherence', 'documentation'].map((name) => ({
      find: `@throughline/${name}`,
      replacement: fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url)),
    })),
  },
  // docs/ holds BOTH the built demo and the written documentation, so the
  // build must not empty it. `npm run build` clears docs/assets first.
  build: { outDir: '../../docs', emptyOutDir: false },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
})
