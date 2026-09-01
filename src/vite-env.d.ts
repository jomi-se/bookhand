/// <reference types="vite/client" />

declare module 'virtual:bookhand-test-controls' {
  import type { RuntimePorts } from './runtime/ports.ts'

  export function prepareRuntimePorts(ports: RuntimePorts): RuntimePorts
}

