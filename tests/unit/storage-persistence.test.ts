import { describe, expect, it, vi } from 'vitest'

import type { ImportBookInput } from '../../src/domain/index.ts'
import { importBookAndRequestPersistence } from '../../src/storage/persistence.ts'
import type { StorageClient } from '../../src/storage/client.ts'

const importedBook: ImportBookInput = {
  metadata: { title: 'Imported', authors: [] },
  epubBytes: new Uint8Array([1]),
  importedAt: '2026-09-01T12:00:00.000Z',
  provenance: { kind: 'imported', originalFileName: 'imported.epub' },
}

function fakeClient(mode: 'persistent' | 'session-only', claims: boolean[]) {
  return {
    importBook: vi.fn().mockResolvedValue('book-id'),
    getDiagnostics: vi.fn().mockResolvedValue({ mode }),
    claimPersistenceRequest: vi.fn().mockImplementation(async () => claims.shift() ?? false),
  } as unknown as StorageClient
}

describe('durable storage request orchestration', () => {
  it.each([
    [true, 'granted'],
    [false, 'denied'],
  ] as const)('reports the browser result without changing the import (%s)', async (granted, expected) => {
    const client = fakeClient('persistent', [true])
    const persist = vi.fn().mockResolvedValue(granted)

    await expect(
      importBookAndRequestPersistence(client, importedBook, { persist }),
    ).resolves.toEqual({ bookId: 'book-id', persistence: expected })
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not spam the browser request after the durable claim is consumed', async () => {
    const client = fakeClient('persistent', [true, false])
    const persist = vi.fn().mockResolvedValue(true)

    await importBookAndRequestPersistence(client, importedBook, { persist })
    await importBookAndRequestPersistence(client, importedBook, { persist })

    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not claim persistence for a session-only import', async () => {
    const client = fakeClient('session-only', [true])
    const persist = vi.fn().mockResolvedValue(true)

    await expect(
      importBookAndRequestPersistence(client, importedBook, { persist }),
    ).resolves.toEqual({ bookId: 'book-id', persistence: 'not-requested' })
    expect(client.claimPersistenceRequest).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })

  it('imports the book anyway when the browser has no persist API at all', async () => {
    const client = fakeClient('persistent', [true])
    // Some in-app browsers expose no storage manager. That is a fact to report,
    // not a reason to fail an import the person asked for.
    await expect(importBookAndRequestPersistence(client, importedBook, {})).resolves.toEqual({
      bookId: 'book-id',
      persistence: 'unsupported',
    })
    expect(client.importBook).toHaveBeenCalledOnce()
  })

  it('imports the book anyway when the browser refuses', async () => {
    const client = fakeClient('persistent', [true])
    const persist = vi.fn().mockResolvedValue(false)
    const outcome = await importBookAndRequestPersistence(client, importedBook, { persist })
    expect(outcome).toEqual({ bookId: 'book-id', persistence: 'denied' })
    expect(client.importBook).toHaveBeenCalledOnce()
  })

  it('never asks during a passive bundled-book bootstrap', async () => {
    // Opening the app must not produce a browser permission prompt nobody
    // asked for. Only an import the person started may spend the one request.
    const client = fakeClient('persistent', [true])
    const persist = vi.fn().mockResolvedValue(true)
    const bundled: ImportBookInput = {
      ...importedBook,
      provenance: {
        kind: 'bundled',
        sourceUrl: 'https://example.invalid/book.epub',
        retrievedAt: '2026-09-01T12:00:00.000Z',
        removeAfterJudging: true,
      },
    }
    await expect(importBookAndRequestPersistence(client, bundled, { persist })).resolves.toEqual({
      bookId: 'book-id',
      persistence: 'not-requested',
    })
    expect(persist).not.toHaveBeenCalled()
    expect(client.claimPersistenceRequest).not.toHaveBeenCalled()
  })
})
