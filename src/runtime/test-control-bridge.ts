import type { RuntimePorts } from './ports.ts'
import { prepareRuntimePorts } from 'virtual:bookhand-test-controls'
import { prepareStorageClient } from 'virtual:bookhand-test-controls'
import type { StorageClient } from '../storage/client.ts'

/**
 * Composition-root seam for browser validation builds. The production virtual
 * module returns the original ports unchanged. Only `--mode test-harness`
 * resolves the implementation that installs fault controls.
 */
export function prepareRuntimePortsForBrowser(ports: RuntimePorts): RuntimePorts {
  return prepareRuntimePorts(ports)
}

export function prepareStorageClientForBrowser(client: StorageClient): StorageClient {
  return prepareStorageClient(client)
}
