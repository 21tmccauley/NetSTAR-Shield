import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' assert { type: 'json' }

// Choose UI variant via env, default to 'tabs'. Each variant builds to its own outDir.
const uiVariant = process.env.VITE_UI_VARIANT || 'tabs'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: `dist-${uiVariant}`,
    sourcemap: false,
  },
})
