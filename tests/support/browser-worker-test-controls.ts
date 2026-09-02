import type { IndexChunk } from '../../src/domain/search.ts'
import type { StorageRuntimeHooks } from '../../src/storage/worker-runtime.ts'

const FAIL_MARKER = '__bookhand_index_fail_before_chunk__'
const PAUSE_MARKER = '__bookhand_index_pause_after_batch__'

type MarkedChunk = IndexChunk & {
  readonly [FAIL_MARKER]?: boolean
  readonly [PAUSE_MARKER]?: boolean
}

export function createStorageRuntimeHooks(): StorageRuntimeHooks {
  let release: (() => void) | undefined
  let releaseRequested = false

  return {
    beforeIndexChunk(chunk) {
      if ((chunk as MarkedChunk)[FAIL_MARKER]) {
        throw new Error(`Injected index failure before chunk ${chunk.id}`)
      }
    },
    afterIndexBatch(request) {
      if (!request.chunks.some((chunk) => (chunk as MarkedChunk)[PAUSE_MARKER])) return
      if (releaseRequested) {
        releaseRequested = false
        return
      }
      return new Promise<void>((resolve) => {
        release = resolve
      })
    },
    beforeIndexCancel() {
      if (release) {
        const resume = release
        release = undefined
        resume()
      } else {
        releaseRequested = true
      }
    },
  }
}
