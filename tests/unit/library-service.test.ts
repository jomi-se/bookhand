import { describe, expect, it, vi } from 'vitest'

import type { BookCatalogEntry } from '../../src/domain/index.ts'
import { BookUnreadableError } from '../../src/reader/metadata.ts'
import type { StorageClient } from '../../src/storage/client.ts'
import type { BundledBookRegistration } from '../../src/library/bundled-books.ts'
import {
  bootstrapBundledBooks,
  BundledBookError,
  importEpubFile,
  ImportRejectedError,
} from '../../src/library/library-service.ts'

const metadata = { title: 'A Book', authors: [{ name: 'An Author' }] }

function fakeClient() {
  return {
    importBook: vi.fn().mockResolvedValue('stored-id'),
    getDiagnostics: vi.fn().mockResolvedValue({ mode: 'session-only' }),
    claimPersistenceRequest: vi.fn(),
  } as unknown as StorageClient
}

function epubFile(name: string, bytes = new Uint8Array([1, 2, 3])) {
  return new File([bytes as unknown as BlobPart], name, { type: 'application/epub+zip' })
}

describe('importing a person’s own EPUB', () => {
  it('stores the file with its real metadata and original file name', async () => {
    const client = fakeClient()
    await importEpubFile(client, epubFile('slopes.epub'), {
      now: () => new Date('2026-09-01T12:00:00.000Z'),
      readMetadata: async () => metadata,
    })

    expect(client.importBook).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata,
        importedAt: '2026-09-01T12:00:00.000Z',
        provenance: { kind: 'imported', originalFileName: 'slopes.epub' },
      }),
    )
  })

  it('requests durable storage through the real file-import path', async () => {
    const client = {
      importBook: vi.fn().mockResolvedValue('stored-id'),
      getDiagnostics: vi.fn().mockResolvedValue({ mode: 'persistent' }),
      claimPersistenceRequest: vi.fn().mockResolvedValue(true),
    } as unknown as StorageClient
    const persist = vi.fn().mockResolvedValue(true)

    await importEpubFile(client, epubFile('durable.epub'), {
      readMetadata: async () => metadata,
      persistenceManager: { persist },
    })

    expect(persist).toHaveBeenCalledOnce()
  })

  it.each([
    ['an empty file', new Uint8Array(), 'empty'],
  ] as const)('rejects %s without storing anything', async (_label, bytes, reason) => {
    const client = fakeClient()
    const failure = await importEpubFile(client, epubFile('broken.epub', bytes), {
      readMetadata: async () => metadata,
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ImportRejectedError)
    expect(failure).toMatchObject({ reason })
    expect(client.importBook).not.toHaveBeenCalled()
  })

  it('reports an unreadable file as a rejection naming the file, not a crash', async () => {
    const client = fakeClient()
    const failure = await importEpubFile(client, epubFile('notes.txt'), {
      readMetadata: async () => {
        throw new BookUnreadableError()
      },
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ImportRejectedError)
    expect(failure).toMatchObject({ reason: 'unreadable' })
    expect((failure as Error).message).toContain('notes.txt')
    expect(client.importBook).not.toHaveBeenCalled()
  })
})

describe('bundled book bootstrap', () => {
  const registration: BundledBookRegistration = {
    path: 'books/tiny.epub',
    // SHA-256 of the three bytes below.
    sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    byteLength: 3,
    sourceUrl: 'https://example.invalid/tiny',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    removeAfterJudging: true,
  }
  const bytes = new Uint8Array([1, 2, 3])
  const respond = () =>
    vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer })

  it('registers a pinned book that is not stored yet', async () => {
    const client = fakeClient()
    const fetchResource = respond()

    const added = await bootstrapBundledBooks(client, [registration], [], {
      fetch: fetchResource as unknown as typeof fetch,
      baseUrl: '/',
      readMetadata: async () => metadata,
    })

    expect(added).toBe(1)
    expect(fetchResource).toHaveBeenCalledWith('/books/tiny.epub')
    expect(client.importBook).toHaveBeenCalledWith(
      expect.objectContaining({
        provenance: expect.objectContaining({ kind: 'bundled', removeAfterJudging: true }),
      }),
    )
  })

  it('never re-fetches a book the library already holds', async () => {
    const client = fakeClient()
    const fetchResource = respond()
    const stored = [{ id: registration.sha256 }] as unknown as BookCatalogEntry[]

    const added = await bootstrapBundledBooks(client, [registration], stored, {
      fetch: fetchResource as unknown as typeof fetch,
      readMetadata: async () => metadata,
    })

    expect(added).toBe(0)
    expect(fetchResource).not.toHaveBeenCalled()
    expect(client.importBook).not.toHaveBeenCalled()
  })

  it('refuses to store a bundled book whose bytes fail the pinned checksum', async () => {
    const client = fakeClient()
    const tampered = { ...registration, sha256: '0'.repeat(64) }

    await expect(
      bootstrapBundledBooks(client, [tampered], [], {
        fetch: respond() as unknown as typeof fetch,
        readMetadata: async () => metadata,
      }),
    ).rejects.toBeInstanceOf(BundledBookError)
    expect(client.importBook).not.toHaveBeenCalled()
  })

  it('registers nothing when no book is bundled, leaving the ordinary empty library', async () => {
    const client = fakeClient()
    const fetchResource = respond()

    const added = await bootstrapBundledBooks(client, [], [], {
      fetch: fetchResource as unknown as typeof fetch,
    })

    expect(added).toBe(0)
    expect(fetchResource).not.toHaveBeenCalled()
  })
})
