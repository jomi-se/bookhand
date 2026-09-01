import type { RuntimePorts } from '../../src/runtime/ports.ts'

const never = new Promise<never>(() => undefined)

export const TEST_CONTROL_NAMES = [
  'force-opfs-initialization-failure',
  'delay-stale-open',
  'leave-book-open-unresolved',
  'leave-library-list-unresolved',
  'fail-library-list-immediately',
  'fail-section-load',
  'dump-raw-state',
] as const

export type TestControlName = (typeof TEST_CONTROL_NAMES)[number]

export interface RawStateDiagnosticsPort {
  dumpRawState(): Promise<unknown>
}

export interface ControlledRuntime {
  readonly ports: RuntimePorts
  readonly controls: {
    enable(name: TestControlName): void
    disable(name: TestControlName): void
    releaseStaleOpen(): void
    dumpRawState(): Promise<unknown>
  }
}

export function createControlledRuntime(
  base: RuntimePorts,
  diagnostics?: RawStateDiagnosticsPort,
): ControlledRuntime {
  const enabled = new Set<TestControlName>()
  let releaseOpen: (() => void) | undefined

  const waitForStaleOpenRelease = () =>
    new Promise<void>((resolve) => {
      releaseOpen = resolve
    })

  const ports: RuntimePorts = {
    persistence: {
      async initialize() {
        if (enabled.has('force-opfs-initialization-failure')) {
          throw new Error('Injected OPFS initialization failure')
        }
        return base.persistence.initialize()
      },
    },
    library: {
      async listBooks() {
        if (enabled.has('fail-library-list-immediately')) {
          throw new Error('Injected library-list failure')
        }
        if (enabled.has('leave-library-list-unresolved')) return never
        return base.library.listBooks()
      },
    },
    reader: {
      async openBook(blob) {
        if (enabled.has('leave-book-open-unresolved')) return never
        if (enabled.has('delay-stale-open')) await waitForStaleOpenRelease()
        return base.reader.openBook(blob)
      },
      async loadSection(sectionIndex) {
        if (enabled.has('fail-section-load')) {
          throw new Error('Injected section-load failure')
        }
        return base.reader.loadSection(sectionIndex)
      },
    },
  }

  return {
    ports,
    controls: {
      enable: (name) => enabled.add(name),
      disable: (name) => enabled.delete(name),
      releaseStaleOpen: () => {
        releaseOpen?.()
        releaseOpen = undefined
      },
      async dumpRawState() {
        if (!enabled.has('dump-raw-state')) {
          throw new Error('Raw state diagnostics are disabled')
        }
        if (!diagnostics) throw new Error('No raw state diagnostics port supplied')
        return diagnostics.dumpRawState()
      },
    },
  }
}

