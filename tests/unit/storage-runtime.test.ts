// @vitest-environment node

import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImportBookInput, ReadingState } from '../../src/domain/index.ts'
import {
  isLockError,
  StorageWorkerRuntime,
} from '../../src/storage/worker-runtime.ts'

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
        schemaVersion: 1,
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
