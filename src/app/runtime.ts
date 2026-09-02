import type { RuntimePorts } from '../runtime/ports.ts'
import { prepareRuntimePortsForBrowser } from '../runtime/test-control-bridge.ts'
import { StorageClient } from '../storage/client.ts'
import { DEFAULT_READER_STYLE } from '../reader/FoliateReaderAdapter.ts'
import { DesignStateStore } from './design-state.ts'
import { PresentationStore } from './presentation.ts'
import { SurfaceStore } from './surface.ts'
import { ReaderPortBridge } from './reader-bridge.ts'

export { ReaderPortBridge } from './reader-bridge.ts'

export interface AppRuntime {
  readonly client: StorageClient
  readonly ports: RuntimePorts
  readonly reader: ReaderPortBridge
  /** What surface is showing, read by `get_design_context` at call time. */
  readonly designState: DesignStateStore
  /** The single owner of the reading presentation, written by UI and tools alike. */
  readonly presentation: PresentationStore
  /** Which panel is open, written by UI and tools alike. */
  readonly surface: SurfaceStore
}

export function createAppRuntime(client: StorageClient = new StorageClient()): AppRuntime {
  const reader = new ReaderPortBridge()
  const ports = prepareRuntimePortsForBrowser({
    persistence: { initialize: () => client.initialize() },
    library: { listBooks: () => client.listBooks() },
    reader: { openBook: reader.openBook, loadSection: reader.loadSection },
  })
  return {
    client,
    ports,
    reader,
    designState: new DesignStateStore(),
    presentation: new PresentationStore(DEFAULT_READER_STYLE),
    surface: new SurfaceStore(),
  }
}
