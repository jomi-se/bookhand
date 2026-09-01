/// <reference lib="webworker" />

import type { StorageWorkerResponse } from '../domain/index.ts'
import { StorageWorkerRuntime, storageWorkerError } from './worker-runtime.ts'

const runtime = new StorageWorkerRuntime()

self.addEventListener('message', async (event: MessageEvent<unknown>) => {
  const requestId =
    typeof event.data === 'object' &&
    event.data !== null &&
    'requestId' in event.data &&
    typeof event.data.requestId === 'string'
      ? event.data.requestId
      : 'invalid-request'
  let response: StorageWorkerResponse
  try {
    response = {
      requestId,
      ok: true,
      result: await runtime.handle(event.data),
    }
  } catch (error) {
    response = { requestId, ok: false, error: storageWorkerError(error) }
  }
  self.postMessage(response)
})

