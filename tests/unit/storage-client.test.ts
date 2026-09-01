import { describe, expect, it, vi } from 'vitest'

import { StorageClient, StorageClientError } from '../../src/storage/client.ts'
import type { RuntimeClock } from '../../src/runtime/deadlines.ts'

interface FakeWorker {
  readonly posted: { type: string; requestId: string }[]
  terminated: number
  postMessage(message: unknown): void
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  terminate(): void
  fire(type: string, event: Event): void
  listenerCount(type: string): number
  reply(requestId: string, result: unknown): void
}

function fakeWorker(): FakeWorker {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  return {
    posted: [],
    terminated: 0,
    postMessage(message) {
      this.posted.push(message as { type: string; requestId: string })
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    terminate() {
      this.terminated += 1
    },
    fire(type, event) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        ;(listener as EventListener)(event)
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0
    },
    reply(requestId, result) {
      this.fire('message', new MessageEvent('message', { data: { requestId, ok: true, result } }))
    },
  }
}

/** A clock whose timers only fire when the test advances them. */
function manualClock(): RuntimeClock & { advance(): void } {
  const due: (() => void)[] = []
  return {
    now: () => 0,
    setTimeout(callback) {
      due.push(callback)
      return due.length as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout(handle) {
      delete due[(handle as unknown as number) - 1]
    },
    advance() {
      for (const callback of due.splice(0)) callback?.()
    },
  }
}

describe('StorageClient request lifetime', () => {
  it('fails an unanswered request at its deadline instead of hanging', async () => {
    const clock = manualClock()
    const client = new StorageClient(fakeWorker(), { clock, deadlineMs: 5_000 })

    const books = client.listBooks()
    clock.advance()

    await expect(books).rejects.toMatchObject({
      name: 'StorageClientError',
      code: 'storage-request-timed-out',
      retryable: true,
    })
  })

  it('bounds an import separately from a catalog read', async () => {
    const worker = fakeWorker()
    const timers: number[] = []
    const clock: RuntimeClock = {
      now: () => 0,
      setTimeout: (_callback, delayMs) => {
        timers.push(delayMs)
        return 0 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: () => undefined,
    }
    const client = new StorageClient(worker, { clock, deadlineMs: 5_000, importDeadlineMs: 30_000 })

    void client.listBooks()
    void client.importBook({
      metadata: { title: 'Big', authors: [] },
      epubBytes: new Uint8Array([1]),
      importedAt: '2026-09-01T12:00:00.000Z',
      provenance: { kind: 'imported', originalFileName: 'big.epub' },
    })

    expect(timers).toEqual([5_000, 30_000])
  })

  it('rejects new requests once the worker has failed rather than posting into the void', async () => {
    const worker = fakeWorker()
    const client = new StorageClient(worker)

    const inFlight = client.listBooks()
    worker.fire('error', new ErrorEvent('error', { message: 'worker died' }))
    await expect(inFlight).rejects.toMatchObject({ code: 'storage-worker-failed' })

    const postedBefore = worker.posted.length
    await expect(client.listBooks()).rejects.toMatchObject({ code: 'storage-worker-failed' })
    expect(worker.posted).toHaveLength(postedBefore)
  })

  it('does not leak a timed-out request into a later response', async () => {
    const clock = manualClock()
    const worker = fakeWorker()
    const client = new StorageClient(worker, { clock, deadlineMs: 5_000 })

    const books = client.listBooks()
    clock.advance()
    await expect(books).rejects.toMatchObject({ code: 'storage-request-timed-out' })

    const late = worker.posted[0]
    expect(() => worker.reply(late.requestId, { type: 'book-list', books: [] })).not.toThrow()
  })
})

describe('StorageClient disposal', () => {
  it('closes once and detaches its listeners even when disposed concurrently', async () => {
    const worker = fakeWorker()
    const client = new StorageClient(worker)

    const first = client.dispose()
    const second = client.dispose()
    const closeRequest = worker.posted.at(-1)
    expect(closeRequest?.type).toBe('close')
    worker.reply(closeRequest!.requestId, { type: 'closed' })
    await Promise.all([first, second])

    expect(worker.posted.filter((message) => message.type === 'close')).toHaveLength(1)
    expect(worker.terminated).toBe(1)
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
  })

  it('resolves even when the worker cannot acknowledge the close', async () => {
    const worker = fakeWorker()
    const client = new StorageClient(worker)
    const rejection = vi.fn()

    const disposal = client.dispose()
    disposal.catch(rejection)
    worker.fire('error', new ErrorEvent('error', { message: 'died mid-close' }))

    await expect(disposal).resolves.toBeUndefined()
    expect(rejection).not.toHaveBeenCalled()
    expect(worker.terminated).toBe(1)
  })

  it('reports a disposed client to later callers', async () => {
    const worker = fakeWorker()
    const client = new StorageClient(worker)
    const disposal = client.dispose()
    worker.reply(worker.posted.at(-1)!.requestId, { type: 'closed' })
    await disposal

    const error = await client.listBooks().catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(StorageClientError)
    expect(error).toMatchObject({ code: 'storage-client-disposed', retryable: false })
  })
})
