import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, normalizePath, type Plugin } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' blob: data:",
  "font-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

const testControlModuleId = 'virtual:bookhand-test-controls'
const resolvedTestControlModuleId = `\0${testControlModuleId}`

function testControlBoundary(mode: string): Plugin {
  return {
    name: 'bookhand-test-control-boundary',
    resolveId(id) {
      if (id === testControlModuleId) return resolvedTestControlModuleId
    },
    load(id) {
      if (id !== resolvedTestControlModuleId) return
      if (mode !== 'test-harness') {
        return 'export const prepareRuntimePorts = ports => ports'
      }

      const implementation = normalizePath(
        resolve('tests/support/browser-test-controls.ts'),
      )
      return `export { prepareRuntimePorts } from ${JSON.stringify(`/@fs/${implementation}`)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    testControlBoundary(mode),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm',
          dest: 'assets',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3-opfs-async-proxy.js',
          dest: 'assets',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  server: { headers: { 'Content-Security-Policy': contentSecurityPolicy } },
  preview: { headers: { 'Content-Security-Policy': contentSecurityPolicy } },
}))
