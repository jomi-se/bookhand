import type { RuntimePorts } from '../../src/runtime/ports.ts'
import type { IndexChunk, IndexCursor, IndexState } from '../../src/domain/search.ts'
import type { StorageClient } from '../../src/storage/client.ts'
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
      indexPauseAfterCommittedBatch(): void
      indexFailBeforeChunk(chunkId?: string): void
    }
  }
}

let controlledRuntime: ControlledRuntime | undefined
let pauseAfterBatch = false
let failBeforeChunk: string | undefined | null = null

const FAIL_MARKER = '__bookhand_index_fail_before_chunk__'
const PAUSE_MARKER = '__bookhand_index_pause_after_batch__'

export function prepareStorageClient(client: StorageClient): StorageClient {
  return new Proxy(client, {
    get(target, property) {
      if (property === 'commitIndexBatch') {
        return async (bookId: string, epoch: number, expected: IndexCursor, chunks: readonly IndexChunk[], next: IndexCursor, sectionsIndexed: number): Promise<IndexState> => {
          let sent: readonly IndexChunk[] = chunks
          const targetChunk = failBeforeChunk === null ? undefined : chunks.find((chunk) => failBeforeChunk === undefined || chunk.id === failBeforeChunk)
          if (targetChunk) {
            failBeforeChunk = null
            sent = chunks.map((chunk) => chunk === targetChunk
              ? { ...chunk, [FAIL_MARKER]: true }
              : chunk)
          }
          if (pauseAfterBatch && sent.length > 0) {
            pauseAfterBatch = false
            sent = sent.map((chunk, index) => index === 0
              ? { ...chunk, [PAUSE_MARKER]: true }
              : chunk)
          }
          return target.commitIndexBatch(bookId, epoch, expected, sent, next, sectionsIndexed)
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export function prepareRuntimePorts(ports: RuntimePorts): RuntimePorts {
  controlledRuntime = createControlledRuntime(ports)
  window.__BOOKHAND_TEST_CONTROLS__ = {
    names: TEST_CONTROL_NAMES,
    enable: controlledRuntime.controls.enable,
    disable: controlledRuntime.controls.disable,
    releaseStaleOpen: controlledRuntime.controls.releaseStaleOpen,
    indexPauseAfterCommittedBatch: () => { pauseAfterBatch = true },
    indexFailBeforeChunk: (chunkId) => { failBeforeChunk = chunkId },
  }
  return controlledRuntime.ports
}
