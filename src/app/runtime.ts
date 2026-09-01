import type { BookMetadata } from '../domain/reader.ts'
import type { ReaderAdapter } from '../domain/reader.ts'
import type { RuntimePorts } from '../runtime/ports.ts'
import { prepareRuntimePortsForBrowser } from '../runtime/test-control-bridge.ts'
import { StorageClient } from '../storage/client.ts'

/**
 * The reader adapter only exists once a reader surface has mounted, but the
 * runtime ports are composed at startup. This bridge lets the composition root
 * publish a stable reader port whose implementation attaches later.
 */
export class ReaderPortBridge {
  #adapter: ReaderAdapter | undefined

  attach(adapter: ReaderAdapter): void {
    this.#adapter = adapter
  }

  detach(adapter: ReaderAdapter): void {
    if (this.#adapter === adapter) this.#adapter = undefined
  }

  get adapter(): ReaderAdapter | undefined {
    return this.#adapter
  }

  private require(): ReaderAdapter {
    if (!this.#adapter) throw new Error('No reader surface is attached')
    return this.#adapter
  }

  openBook = (blob: Blob): Promise<BookMetadata> => this.require().open(blob)

  loadSection = async (sectionIndex: number): Promise<void> => {
    await this.require().navigate({ kind: 'section', sectionIndex })
  }
}

export interface AppRuntime {
  readonly client: StorageClient
  readonly ports: RuntimePorts
  readonly reader: ReaderPortBridge
}

export function createAppRuntime(client: StorageClient = new StorageClient()): AppRuntime {
  const reader = new ReaderPortBridge()
  const ports = prepareRuntimePortsForBrowser({
    persistence: { initialize: () => client.initialize() },
    library: { listBooks: () => client.listBooks() },
    reader: { openBook: reader.openBook, loadSection: reader.loadSection },
  })
  return { client, ports, reader }
}
