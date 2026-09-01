import type { RuntimePorts } from './ports.ts'
import { prepareRuntimePorts } from 'virtual:bookhand-test-controls'

/**
 * Composition-root seam for browser validation builds. The production virtual
 * module returns the original ports unchanged. Only `--mode test-harness`
 * resolves the implementation that installs fault controls.
 */
export function prepareRuntimePortsForBrowser(ports: RuntimePorts): RuntimePorts {
  return prepareRuntimePorts(ports)
}

