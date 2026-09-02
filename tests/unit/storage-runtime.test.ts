// @vitest-environment node

import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImportBookInput, ReadingState } from '../../src/domain/index.ts'
import {
  isLockError,
  StorageWorkerRuntime,
} from '../../src/storage/worker-runtime.ts'
import { STORAGE_SCHEMA_VERSION } from '../../src/storage/schema.ts'

const input: ImportBookInput = {
  metadata: { title: 'Protocol book', authors: [{ name: 'Ada Reader' }] },
  epubBytes: new TextEncoder().encode('deterministic EPUB stand-in bytes'),
  importedAt: '2026-09-01T12:00:00.000Z',
  provenance: { kind: 'imported', originalFileName: 'protocol.epub' },
}

describe('storage worker runtime over the official SQLite artifact', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses an honest in-memory fallback and loses it on true runtime reset', async () => {
    const runtime = new StorageWorkerRuntime(() => sqlite3InitModule())
    const initialized = await runtime.handle({ requestId: '1', type: 'initialize' })
    expect(initialized).toMatchObject({
      type: 'initialized',
      diagnostics: {
        mode: 'session-only',
        vfsName: 'memory',
        sqliteVersion: '3.53.0',
        schemaVersion: STORAGE_SCHEMA_VERSION,
        connectionOwner: 'dedicated-worker',
        bookCount: 0,
      },
    })

    const written = await runtime.handle({
      requestId: '2',
      type: 'import-book',
      book: input,
    })
    expect(written.type).toBe('book-written')
    if (written.type !== 'book-written') throw new Error('Expected imported book')

    const state: ReadingState = {
      bookId: written.bookId,
      location: { cfi: 'epubcfi(/6/2)', sectionIndex: 0, fraction: 0.5 },
      style: {
        fontSizePercent: 100,
        lineHeight: 1.5,
        measureCh: 66,
        paragraphSpacingEm: 0.5,
        theme: 'light',
      },
      updatedAt: '2026-09-01T12:10:00.000Z',
    }
    await runtime.handle({ requestId: '3', type: 'put-reading-state', state })
    expect(
      await runtime.handle({
        requestId: '4',
        type: 'get-reading-state',
        bookId: written.bookId,
      }),
    ).toEqual({ type: 'reading-state', state })
    expect(
      await runtime.handle({ requestId: '5', type: 'get-diagnostics' }),
    ).toMatchObject({ type: 'diagnostics', diagnostics: { bookCount: 1 } })
    runtime.close()

    const newSession = new StorageWorkerRuntime(() => sqlite3InitModule())
    await newSession.handle({ requestId: '6', type: 'initialize' })
    expect(
      await newSession.handle({ requestId: '7', type: 'list-books' }),
    ).toEqual({ type: 'book-list', books: [] })
    newSession.close()
  })

  it('runtime-validates messages before they reach SQLite', async () => {
    const runtime = new StorageWorkerRuntime(() => sqlite3InitModule())
    await expect(
      runtime.handle({ requestId: 'bad', type: 'import-book', book: input.metadata }),
    ).rejects.toThrow(TypeError)
  })

  it('drives named-chunk rollback through the real runtime protocol', async () => {
    const runtime = new StorageWorkerRuntime(
      () => sqlite3InitModule(),
      { beforeIndexChunk: (chunk) => {
        if (chunk.id === 'fail-here') throw new Error('Injected before named chunk')
      } },
    )
    await runtime.handle({ requestId: '1', type: 'initialize' })
    const written = await runtime.handle({ requestId: '2', type: 'import-book', book: input })
    if (written.type !== 'book-written') throw new Error('Expected imported book')
    const begun = await runtime.handle({ requestId: '3', type: 'begin-index', bookId: written.bookId, sectionsTotal: 2 })
    if (begun.type !== 'index-state' || !begun.state) throw new Error('Expected index state')
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-runtime' }
    const prior = await runtime.handle({
      requestId: '4', type: 'commit-index-batch', bookId: written.bookId,
      epoch: begun.state.epoch, expected: begun.state.cursor,
      chunks: [{ id: 'prior', bookId: written.bookId, sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0, globalOrder: 0, text: 'prior searchable passage', range }],
      next: { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 }, sectionsIndexed: 1,
    })
    if (prior.type !== 'index-state' || !prior.state) throw new Error('Expected committed state')

    await expect(runtime.handle({
      requestId: '5', type: 'commit-index-batch', bookId: written.bookId,
      epoch: prior.state.epoch, expected: prior.state.cursor,
      chunks: [
        { id: 'rolled-back', bookId: written.bookId, sectionIndex: 1, sectionTitle: 'Two', sectionChunkIndex: 0, globalOrder: 1, text: 'must not remain', range: { ...range, sectionIndex: 1 } },
        { id: 'fail-here', bookId: written.bookId, sectionIndex: 1, sectionTitle: 'Two', sectionChunkIndex: 1, globalOrder: 2, text: 'failure point', range: { ...range, sectionIndex: 1 } },
      ],
      next: { sectionIndex: 2, sectionChunkIndex: 0, globalOrder: 3 }, sectionsIndexed: 2,
    })).rejects.toThrow(/Injected before named chunk/)
    await expect(runtime.handle({ requestId: '6', type: 'search-book', bookId: written.bookId, query: 'prior', limit: 5 })).resolves.toMatchObject({
      type: 'search-results', result: { availability: 'partial', hits: [{ id: 'prior' }] },
    })
    await expect(runtime.handle({ requestId: '7', type: 'search-book', bookId: written.bookId, query: 'remain', limit: 5 })).resolves.toMatchObject({
      type: 'search-results', result: { hits: [] },
    })
    runtime.close()
  })

  it('can cancel at the genuine post-commit worker boundary before another batch starts', async () => {
    let release!: () => void
    let paused!: () => void
    const reachedPause = new Promise<void>((resolve) => { paused = resolve })
    const runtime = new StorageWorkerRuntime(
      () => sqlite3InitModule(),
      {
        afterIndexBatch: () => {
          paused()
          return new Promise<void>((resolve) => { release = resolve })
        },
        beforeIndexCancel: () => release(),
      },
    )
    await runtime.handle({ requestId: '1', type: 'initialize' })
    const written = await runtime.handle({ requestId: '2', type: 'import-book', book: input })
    if (written.type !== 'book-written') throw new Error('Expected imported book')
    const begun = await runtime.handle({ requestId: '3', type: 'begin-index', bookId: written.bookId, sectionsTotal: 2 })
    if (begun.type !== 'index-state' || !begun.state) throw new Error('Expected index state')
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-pause' }
    const commit = runtime.handle({
      requestId: '4', type: 'commit-index-batch', bookId: written.bookId,
      epoch: begun.state.epoch, expected: begun.state.cursor,
      chunks: [{ id: 'paused', bookId: written.bookId, sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0, globalOrder: 0, text: 'committed before pause', range }],
      next: { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 }, sectionsIndexed: 1,
    })
    await reachedPause
    const cancelled = await runtime.handle({ requestId: '5', type: 'cancel-index', bookId: written.bookId, epoch: begun.state.epoch })
    await expect(commit).resolves.toMatchObject({ type: 'index-state', state: { committedChunks: 1 } })
    expect(cancelled).toMatchObject({ type: 'index-state', state: { status: 'partial', committedChunks: 1 } })
    runtime.close()
  })

  it('does not disguise a sahpool ownership failure as session storage', async () => {
    class MockFileHandle {
      createSyncAccessHandle() {}
    }
    vi.stubGlobal('FileSystemHandle', class {})
    vi.stubGlobal('FileSystemDirectoryHandle', class {})
    vi.stubGlobal('FileSystemFileHandle', MockFileHandle)
    vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn() } })

    const sqlite = await sqlite3InitModule()
    const install = vi
      .fn()
      .mockRejectedValue(
        new DOMException(
          'There is another open access handle for this file',
          'NoModificationAllowedError',
        ),
      )
    const lockedSqlite = new Proxy(sqlite, {
      get(target, property, receiver) {
        return property === 'installOpfsSAHPoolVfs'
          ? install
          : Reflect.get(target, property, receiver)
      },
    }) as Sqlite3Static
    const runtime = new StorageWorkerRuntime(async () => lockedSqlite)

    await expect(
      runtime.handle({ requestId: '1', type: 'initialize' }),
    ).resolves.toMatchObject({
      type: 'initialized',
      diagnostics: { mode: 'locked', bookCount: 0 },
    })
    expect(install).toHaveBeenCalledTimes(2)
    await expect(
      runtime.handle({ requestId: '2', type: 'list-books' }),
    ).rejects.toMatchObject({ code: 'library-locked', retryable: true })
    await expect(
      runtime.handle({ requestId: '3', type: 'retry-persistence' }),
    ).rejects.toMatchObject({ code: 'library-locked', retryable: true })
    expect(install).toHaveBeenCalledTimes(4)
  })

  it('does not misreport an unknown initialization failure as a tab lock', async () => {
    class MockFileHandle {
      createSyncAccessHandle() {}
    }
    vi.stubGlobal('FileSystemHandle', class {})
    vi.stubGlobal('FileSystemDirectoryHandle', class {})
    vi.stubGlobal('FileSystemFileHandle', MockFileHandle)
    vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn() } })

    const sqlite = await sqlite3InitModule()
    const install = vi.fn().mockRejectedValue(new Error('schema migration exploded'))
    const brokenSqlite = new Proxy(sqlite, {
      get(target, property, receiver) {
        return property === 'installOpfsSAHPoolVfs'
          ? install
          : Reflect.get(target, property, receiver)
      },
    }) as Sqlite3Static
    const runtime = new StorageWorkerRuntime(async () => brokenSqlite)

    await expect(
      runtime.handle({ requestId: '1', type: 'initialize' }),
    ).rejects.toMatchObject({
      code: 'storage-initialization-failed',
      retryable: false,
      message: expect.stringContaining('schema migration exploded'),
    })
    expect(install).toHaveBeenCalledTimes(2)
  })

  it('recognizes only explicit access-handle ownership failures as locks', () => {
    expect(
      isLockError(
        new DOMException('Unable to acquire the lock', 'NoModificationAllowedError'),
      ),
    ).toBe(true)
    expect(isLockError(new Error('Access handle is already open elsewhere'))).toBe(true)
    expect(isLockError(new Error('database schema is malformed'))).toBe(false)
    expect(isLockError(new Error('OPFS quota exceeded'))).toBe(false)
  })

  it('falls back only when OPFS is explicitly unavailable', async () => {
    class MockFileHandle {
      createSyncAccessHandle() {}
    }
    vi.stubGlobal('FileSystemHandle', class {})
    vi.stubGlobal('FileSystemDirectoryHandle', class {})
    vi.stubGlobal('FileSystemFileHandle', MockFileHandle)
    vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn() } })

    const sqlite = await sqlite3InitModule()
    const unavailableSqlite = new Proxy(sqlite, {
      get(target, property, receiver) {
        return property === 'installOpfsSAHPoolVfs'
          ? vi.fn().mockRejectedValue(
              new DOMException('OPFS permission denied', 'NotAllowedError'),
            )
          : Reflect.get(target, property, receiver)
      },
    }) as Sqlite3Static
    const runtime = new StorageWorkerRuntime(async () => unavailableSqlite)

    await expect(
      runtime.handle({ requestId: '1', type: 'initialize' }),
    ).resolves.toMatchObject({
      type: 'initialized',
      diagnostics: { mode: 'session-only', vfsName: 'memory' },
    })
    runtime.close()
  })
})
