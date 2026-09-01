import type { RuntimePorts } from '../../src/runtime/ports.ts'
import {
  createControlledRuntime,
  TEST_CONTROL_NAMES,
  type ControlledRuntime,
  type TestControlName,
} from './controlled-runtime.ts'

declare global {
  interface Window {
    __BOOKHAND_TEST_CONTROLS__?: {
      readonly names: readonly TestControlName[]
      enable(name: TestControlName): void
      disable(name: TestControlName): void
      releaseStaleOpen(): void
    }
  }
}

let controlledRuntime: ControlledRuntime | undefined

export function prepareRuntimePorts(ports: RuntimePorts): RuntimePorts {
  controlledRuntime = createControlledRuntime(ports)
  window.__BOOKHAND_TEST_CONTROLS__ = {
    names: TEST_CONTROL_NAMES,
    enable: controlledRuntime.controls.enable,
    disable: controlledRuntime.controls.disable,
    releaseStaleOpen: controlledRuntime.controls.releaseStaleOpen,
  }
  return controlledRuntime.ports
}

