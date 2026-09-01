import { describe, expect, it } from 'vitest'

import {
  assertStorageWorkerRequest,
  assertStorageWorkerResponse,
} from '../../src/storage/protocol.ts'

const validBook = {
  metadata: { title: 'Tiny book', authors: [{ name: 'Ada Reader' }] },
  epubBytes: new Uint8Array([1, 2, 3]),
  importedAt: '2026-09-01T12:00:00.000Z',
  provenance: { kind: 'imported', originalFileName: 'tiny.epub' },
} as const

describe('storage worker protocol validation', () => {
  it('accepts the typed import request', () => {
    expect(() =>
      assertStorageWorkerRequest({
        requestId: 'request-1',
        type: 'import-book',
        book: validBook,
      }),
    ).not.toThrow()
  })

  it.each([
    null,
    { requestId: '', type: 'initialize' },
    { requestId: '1', type: 'unknown' },
    { requestId: '1', type: 'get-book', bookId: 42 },
    {
      requestId: '1',
      type: 'import-book',
      book: { ...validBook, epubBytes: [1, 2, 3] },
    },
    {
      requestId: '1',
      type: 'put-reading-state',
      state: { bookId: 'book-without-the-rest' },
    },
  ])('rejects malformed messages %#', (message) => {
    expect(() => assertStorageWorkerRequest(message)).toThrow(TypeError)
  })
})

describe('storage worker response validation', () => {
  it('accepts a complete diagnostics response', () => {
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: {
          type: 'diagnostics',
          diagnostics: {
            mode: 'persistent',
            sqliteVersion: '3.53.0',
            vfsName: 'bookhand-opfs-sahpool',
            schemaVersion: 1,
            connectionOwner: 'dedicated-worker',
            bookCount: 0,
          },
        },
      }),
    ).not.toThrow()
  })

  it('rejects a response whose result only looks typed', () => {
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: { type: 'diagnostics', diagnostics: { mode: 'persistent' } },
      }),
    ).toThrow(TypeError)
  })
})
