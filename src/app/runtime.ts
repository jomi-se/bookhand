import type { RuntimePorts } from '../runtime/ports.ts'
import { prepareRuntimePortsForBrowser } from '../runtime/test-control-bridge.ts'
import { StorageClient } from '../storage/client.ts'
import { ReaderPortBridge } from './reader-bridge.ts'

export { ReaderPortBridge } from './reader-bridge.ts'

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
