/// <reference types="vite/client" />

declare module 'virtual:bookhand-test-controls' {
  import type { RuntimePorts } from './runtime/ports.ts'

  export function prepareRuntimePorts(ports: RuntimePorts): RuntimePorts
}


declare module 'virtual:bookhand-design-context' {
  /** The exact text between the agent-design-context markers in DESIGN.md. */
  export const CANONICAL_GUIDANCE: string
  export const CAPABILITY_MANIFEST: {
    readonly schemaVersion: number
    readonly scopes: Record<string, boolean>
    readonly reversals: Record<string, readonly string[]>
    readonly study: {
      readonly agentObservabilityInStudy: boolean
      readonly nativePrimitives: readonly string[]
    }
  }
  /** Digest of canonical guidance plus canonical capability JSON. */
  export const DESIGN_CONTEXT_VERSION: string
}
