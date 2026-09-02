import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
// @ts-expect-error -- build-time only, shared with the app build.
import { designContextSource } from './scripts/vite-design-context-plugin.mjs'

export default defineConfig({
  plugins: [react(), designContextSource()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
})

