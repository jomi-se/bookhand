/// <reference types="vite/client" />

declare module 'virtual:bookhand-test-controls' {
  import type { RuntimePorts } from './runtime/ports.ts'

  export function prepareRuntimePorts(ports: RuntimePorts): RuntimePorts
}


declare module 'virtual:bookhand-design-context' {
  /** The exact text between the agent-design-context markers in DESIGN.md. */
  export const CANONICAL_GUIDANCE: string
  /** `sha256:<64 lowercase hex>` over the UTF-8 bytes of CANONICAL_GUIDANCE. */
  export const DESIGN_CONTEXT_VERSION: string
}
