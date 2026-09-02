// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ReaderAdapter } from '../../src/domain/reader.ts'
import type { IndexState } from '../../src/domain/search.ts'
import { ReaderPortBridge } from '../../src/app/reader-bridge.ts'
import type { StorageClient } from '../../src/storage/client.ts'
import { useBookIndex } from '../../src/reader/useBookIndex.ts'

function indexState(epoch = 1): IndexState {
  return {
    bookId: 'book-1', status: 'partial', epoch,
    extractionVersion: 1, chunkVersion: 1, tokenizerVersion: 1,
    cursor: { sectionIndex: 0, sectionChunkIndex: 0, globalOrder: 0 },
    sectionsIndexed: 0, sectionsTotal: 1, committedChunks: 0,
    updatedAt: '2026-09-02T00:00:00.000Z',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('book index lifecycle controller', () => {
  it('records lifecycle cancellation as partial when extraction rejects after unmount', async () => {
    const extraction = deferred<readonly never[]>()
    const adapter = {
      listSections: () => [{ index: 0, href: 'one.xhtml', linear: true }],
      getSectionChunks: () => extraction.promise,
    } as unknown as ReaderAdapter
    const bridge = new ReaderPortBridge()
    bridge.attach(adapter)
    const client = {
      getIndexState: vi.fn().mockResolvedValue(null),
      beginIndex: vi.fn().mockResolvedValue(indexState()),
      cancelIndex: vi.fn().mockResolvedValue(indexState()),
      failIndex: vi.fn(),
    } as unknown as StorageClient

    const hook = renderHook(() => useBookIndex({ bookId: 'book-1', phase: 'reading', client, bridge }))
    await waitFor(() => expect(client.beginIndex).toHaveBeenCalledOnce())
    hook.unmount()
    extraction.reject(new Error('adapter closed'))

    await waitFor(() => expect(client.cancelIndex).toHaveBeenCalledWith('book-1', 1))
    expect(client.failIndex).not.toHaveBeenCalled()
  })

  it('coalesces repeated retry calls while one mounted job is active', async () => {
    const begun = deferred<IndexState>()
    const adapter = { listSections: () => [] } as unknown as ReaderAdapter
    const bridge = new ReaderPortBridge()
    bridge.attach(adapter)
    const client = {
      getIndexState: vi.fn().mockResolvedValue(null),
      beginIndex: vi.fn(() => begun.promise),
      completeIndex: vi.fn().mockResolvedValue({ ...indexState(), status: 'complete' }),
    } as unknown as StorageClient
    const { result, unmount } = renderHook(() => useBookIndex({ bookId: 'book-1', phase: 'loading', client, bridge }))

    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    act(() => {
      first = result.current.retry()
      second = result.current.retry()
    })
    expect(first).toBe(second)
    expect(client.beginIndex).toHaveBeenCalledOnce()

    begun.resolve({ ...indexState(), sectionsTotal: 0 })
    await act(async () => { await first })
    unmount()
  })

  it('sends cancellation to the worker while a committed batch response is paused', async () => {
    const committed = deferred<IndexState>()
    const state = indexState()
    const range = {
      startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-test',
    }
    const adapter = {
      listSections: () => [{ index: 0, href: 'one.xhtml', linear: true }],
      getSectionChunks: vi.fn().mockResolvedValue([{
        sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0,
        text: 'A searchable passage.', range,
      }]),
    } as unknown as ReaderAdapter
    const bridge = new ReaderPortBridge()
    bridge.attach(adapter)
    const client = {
      getIndexState: vi.fn().mockResolvedValue(null),
      beginIndex: vi.fn().mockResolvedValue(state),
      commitIndexBatch: vi.fn(() => committed.promise),
      cancelIndex: vi.fn().mockResolvedValue(state),
      failIndex: vi.fn(),
    } as unknown as StorageClient

    const hook = renderHook(() => useBookIndex({ bookId: 'book-1', phase: 'reading', client, bridge }))
    await waitFor(() => expect(client.commitIndexBatch).toHaveBeenCalledOnce())
    act(() => hook.result.current.cancel())
    await waitFor(() => expect(client.cancelIndex).toHaveBeenCalledWith('book-1', 1))

    committed.resolve({
      ...state,
      cursor: { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 },
      sectionsIndexed: 1,
      committedChunks: 1,
    })
    await waitFor(() => expect(hook.result.current.running).toBe(false))
    expect(client.failIndex).not.toHaveBeenCalled()
    hook.unmount()
  })
})
