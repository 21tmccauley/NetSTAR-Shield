import { defineConfig } from 'vite'

// Standalone Vite config for the mockups website (kept separate from the CRX build)
export default defineConfig({
  root: 'mockups',
  build: {
    outDir: '../dist-mockups',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})


