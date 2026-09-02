// @vitest-environment node

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type {
  Annotation,
  ImportBookInput,
  ReadingState,
  StudyItem,
  StudyMutation,
} from '../../src/domain/index.ts'
import { OwnershipError } from '../../src/domain/provenance.ts'
import { sha256BookId } from '../../src/storage/hash.ts'
import { LibraryRepository } from '../../src/storage/library-repository.ts'
import { initializeSchema, STORAGE_SCHEMA_VERSION } from '../../src/storage/schema.ts'

const book: ImportBookInput = {
  metadata: {
    title: 'A deterministic book',
    subtitle: 'Storage fixture',
    authors: [{ name: 'Ada Reader', sortAs: 'Reader, Ada' }],
    language: 'en',
    cover: { mediaType: 'image/png', bytes: new Uint8Array([9, 8, 7]) },
  },
  epubBytes: new Uint8Array([1, 3, 3, 7]),
  importedAt: '2026-09-01T12:00:00.000Z',
  provenance: { kind: 'imported', originalFileName: 'fixture.epub' },
}

const readingState: ReadingState = {
  bookId: '',
  location: {
    cfi: 'epubcfi(/6/2!/4/2/1:0)',
    sectionIndex: 0,
    fraction: 0.25,
    chapterLabel: 'One',
    textFingerprint: 'opening words',
  },
  style: {
    fontFamily: 'Source Serif 4',
    fontSizePercent: 112,
    lineHeight: 1.65,
    measureCh: 68,
    paragraphSpacingEm: 0.75,
    theme: 'sepia',
    customCss: 'p { hyphens: auto; }',
  },
  updatedAt: '2026-09-01T12:05:00.000Z',
}

describe('official SQLite library repository', () => {
  let db: Database
  let repository: LibraryRepository

  beforeEach(async () => {
    const sqlite = await sqlite3InitModule()
    db = new sqlite.oo1.DB(':memory:', 'c')
    initializeSchema(db)
    repository = new LibraryRepository(db)
  })

  afterEach(() => db.close())

  it('creates the complete schema on the official artifact', () => {
    expect(db.selectValue('PRAGMA user_version')).toBe(STORAGE_SCHEMA_VERSION)
    expect(db.selectValue('PRAGMA foreign_keys')).toBe(1)
    expect(
      db.selectValues(
        `SELECT name FROM sqlite_schema
         WHERE type IN ('table', 'trigger') ORDER BY name`,
      ),
    ).toEqual(
      expect.arrayContaining([
        'annotations',
        'boards',
        'books',
        'chunks',
        'chunks_ai',
        'chunks_fts',
        'reading_state',
        'study_items',
        'vector_batches',
      ]),
    )
  })

  it('refuses a database written by a newer build instead of downgrading it', async () => {
    const sqlite = await sqlite3InitModule()
    const newer = new sqlite.oo1.DB(':memory:', 'c')
    try {
      newer.exec(`PRAGMA user_version = ${STORAGE_SCHEMA_VERSION + 1}`)
      expect(() => initializeSchema(newer)).toThrow(/newer than this build supports/)
      expect(newer.selectValue('PRAGMA user_version')).toBe(STORAGE_SCHEMA_VERSION + 1)
    } finally {
      newer.close()
    }
  })

  it('round-trips original bytes, flattened metadata, cover, and reading state', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    repository.putReadingState({ ...readingState, bookId })

    expect(repository.getBook(bookId)).toEqual({ ...book, id: bookId })
    expect(repository.getReadingState(bookId)).toEqual({ ...readingState, bookId })
    expect(repository.listBooks()).toEqual([
      {
        id: bookId,
        metadata: book.metadata,
        importedAt: book.importedAt,
        provenance: book.provenance,
        readingState: { ...readingState, bookId },
      },
    ])
  })

  it('persists canonical source excerpts without raw EPUB markup', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    const range = {
      startCfi: 'epubcfi(/6/2!/4/2:0)',
      endCfi: 'epubcfi(/6/2!/4/2:11)',
      sectionIndex: 0,
      textFingerprint: 'fnv1a-canonical',
    }
    const annotation: Annotation = {
      id: 'source-annotation',
      origin: 'user',
      bookId,
      range,
      quote: 'AB and dy/dx',
      source: {
        status: 'resolved',
        ownership: 'derived',
        excerpt: {
          schemaVersion: 1,
          bookId,
          range,
          extractionVersion: 1,
          text: 'AB and dy/dx',
          textFingerprint: range.textFingerprint,
          segments: [
            { kind: 'text', text: 'AB and' },
            { kind: 'math', text: 'dy/dx' },
          ],
          chapterBreadcrumb: ['Chapter X'],
        },
      },
      color: 'accent',
      createdAt: readingState.updatedAt,
      updatedAt: readingState.updatedAt,
    }
    repository.saveAnnotation(annotation)
    expect(repository.listAnnotations(bookId)).toEqual([annotation])
    const stored = String(
      db.selectValue('SELECT source_json FROM annotations WHERE id = ?', [annotation.id]),
    )
    expect(stored).toContain('"extractionVersion":1')
    expect(stored).not.toContain('<math')
    expect(stored).not.toContain('<figure')
  })

  it('deduplicates identical bytes without replacing the original record', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    repository.importBook(bookId, {
      ...book,
      importedAt: '2026-09-02T00:00:00.000Z',
      provenance: { kind: 'imported', originalFileName: 'duplicate.epub' },
    })

    expect(repository.countBooks()).toBe(1)
    expect(repository.getBook(bookId)?.importedAt).toBe(book.importedAt)
    expect(repository.getBook(bookId)?.provenance).toEqual(book.provenance)
  })

  it('rolls back a deliberately failed import with no visible partial book', () => {
    db.exec(`
      CREATE TRIGGER fail_import BEFORE INSERT ON books
      WHEN new.id = 'forced-failure'
      BEGIN
        SELECT RAISE(ABORT, 'injected import failure');
      END;
    `)

    expect(() => repository.importBook('forced-failure', book)).toThrow(
      /injected import failure/,
    )
    expect(repository.countBooks()).toBe(0)
    expect(repository.getBook('forced-failure')).toBeNull()
  })

  it('claims the persistence request once in durable database state', () => {
    expect(repository.claimPersistenceRequest()).toBe(true)
    expect(repository.claimPersistenceRequest()).toBe(false)
  })

  it('rejects reading state for a book that was never committed', () => {
    expect(() =>
      repository.putReadingState({ ...readingState, bookId: 'missing-book' }),
    ).toThrow(/FOREIGN KEY constraint failed/)
    expect(repository.getReadingState('missing-book')).toBeNull()
  })

  it('keeps the external-content FTS index synchronized transactionally', () => {
    const bookId = 'book-for-fts'
    repository.importBook(bookId, book)
    db.exec({
      sql: `INSERT INTO chunks (
        id, book_id, section_index, title_breadcrumb_json, start_cfi,
        end_cfi, sort_order, text, text_hash, index_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [
        'chunk-1',
        bookId,
        0,
        '["One"]',
        'start',
        'end',
        0,
        'infinitesimal calculus',
        'hash',
        1,
      ],
    })
    expect(
      db.selectValue(
        `SELECT count(*) FROM chunks_fts WHERE chunks_fts MATCH 'calculus'`,
      ),
    ).toBe(1)
  })

  it('commits resumable book-scoped index batches and searches only committed chunks', async () => {
    const firstId = await sha256BookId(book.epubBytes)
    const secondBook = { ...book, epubBytes: new Uint8Array([8, 6, 4, 2]) }
    const secondId = await sha256BookId(secondBook.epubBytes)
    repository.importBook(firstId, book)
    repository.importBook(secondId, secondBook)
    const state = repository.beginIndex(firstId, 1, readingState.updatedAt)
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-search' }
    const committed = repository.commitIndexBatch(
      firstId,
      state.epoch,
      state.cursor,
      [{ id: 'search-chunk', bookId: firstId, sectionIndex: 0, sectionTitle: 'Slope', sectionChunkIndex: 0, globalOrder: 0, text: 'The differential coefficient gives the tangent slope.', range }],
      { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 },
      1,
      readingState.updatedAt,
    )
    expect(committed.status).toBe('partial')
    expect(repository.searchBook(firstId, 'tangent slope', 5)).toMatchObject({ availability: 'partial', outcome: 'results', hits: [{ bookId: firstId, sectionTitle: 'Slope' }] })
    expect(repository.searchBook(secondId, 'tangent slope', 5)).toMatchObject({ availability: 'unavailable', hits: [] })
    expect(() => repository.commitIndexBatch(firstId, state.epoch, state.cursor, [], state.cursor, 0, readingState.updatedAt)).toThrow(/cursor is stale/)
    expect(repository.completeIndex(firstId, state.epoch, readingState.updatedAt).status).toBe('complete')
    expect(repository.searchBook(firstId, 'tangent', 1).availability).toBe('ready')
  })

  it('gives every resumed index a new epoch without discarding its committed cursor', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    const first = repository.beginIndex(bookId, 2, readingState.updatedAt)
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-owned' }
    const committed = repository.commitIndexBatch(
      bookId,
      first.epoch,
      first.cursor,
      [{ id: 'owned-chunk', bookId, sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0, globalOrder: 0, text: 'owned committed passage', range }],
      { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 },
      1,
      readingState.updatedAt,
    )

    const resumed = repository.beginIndex(bookId, 2, readingState.updatedAt)
    expect(resumed).toMatchObject({ epoch: first.epoch + 1, cursor: committed.cursor, committedChunks: 1 })
    expect(() => repository.cancelIndex(bookId, first.epoch, readingState.updatedAt)).toThrow(/stale/i)
    expect(() => repository.failIndex(bookId, first.epoch, 'late failure', readingState.updatedAt)).toThrow(/stale/i)
    expect(repository.getIndexState(bookId)).toMatchObject({ epoch: resumed.epoch, status: 'partial', committedChunks: 1 })
  })

  it('rejects index batches that skip or corrupt the exact resume cursor', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    const state = repository.beginIndex(bookId, 2, readingState.updatedAt)
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-cursor' }
    const chunk = { id: 'cursor-chunk', bookId, sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0, globalOrder: 0, text: 'bounded text', range }

    expect(() => repository.commitIndexBatch(
      bookId, state.epoch, state.cursor, [chunk],
      { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 2 }, 1, readingState.updatedAt,
    )).toThrow(/advance the committed cursor exactly/)
    expect(() => repository.commitIndexBatch(
      bookId, state.epoch, state.cursor, [{ ...chunk, range: { ...range, sectionIndex: 1 } }],
      { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 }, 1, readingState.updatedAt,
    )).toThrow(/outside its exact cursor/)
    expect(() => repository.completeIndex(bookId, state.epoch, readingState.updatedAt)).toThrow(/before every section cursor/)
  })

  it('rolls back the whole named-chunk batch and retains only prior committed work', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository = new LibraryRepository(db, {
      beforeIndexChunk: (chunk) => {
        if (chunk.id === 'fail-here') throw new Error('injected before named chunk')
      },
    })
    repository.importBook(bookId, book)
    const first = repository.beginIndex(bookId, 3, readingState.updatedAt)
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-batch' }
    const prior = repository.commitIndexBatch(
      bookId, first.epoch, first.cursor,
      [{ id: 'prior', bookId, sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0, globalOrder: 0, text: 'prior searchable passage', range }],
      { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 }, 1, readingState.updatedAt,
    )
    expect(() => repository.commitIndexBatch(
      bookId, prior.epoch, prior.cursor,
      [
        { id: 'rolled-back', bookId, sectionIndex: 1, sectionTitle: 'Two', sectionChunkIndex: 0, globalOrder: 1, text: 'must not remain', range: { ...range, sectionIndex: 1 } },
        { id: 'fail-here', bookId, sectionIndex: 1, sectionTitle: 'Two', sectionChunkIndex: 1, globalOrder: 2, text: 'failure point', range: { ...range, sectionIndex: 1 } },
      ],
      { sectionIndex: 2, sectionChunkIndex: 0, globalOrder: 3 }, 2, readingState.updatedAt,
    )).toThrow(/injected before named chunk/)

    expect(repository.getIndexState(bookId)).toMatchObject({ cursor: prior.cursor, committedChunks: 1 })
    expect(repository.searchBook(bookId, 'prior', 5).hits).toHaveLength(1)
    expect(repository.searchBook(bookId, 'remain', 5).hits).toHaveLength(0)
  })

  it('completes a genuinely empty book index', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    const state = repository.beginIndex(bookId, 0, readingState.updatedAt)
    expect(repository.completeIndex(bookId, state.epoch, readingState.updatedAt)).toMatchObject({
      status: 'complete', committedChunks: 0, sectionsIndexed: 0, sectionsTotal: 0,
    })
    expect(repository.searchBook(bookId, 'anything', 5)).toMatchObject({ availability: 'ready', hits: [] })
  })

  it('cascades derived chunks and synchronized FTS rows when a book is removed', async () => {
    const bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
    const state = repository.beginIndex(bookId, 1, readingState.updatedAt)
    const range = { startCfi: 'start', endCfi: 'end', sectionIndex: 0, textFingerprint: 'fnv1a-delete' }
    repository.commitIndexBatch(
      bookId, state.epoch, state.cursor,
      [{ id: 'removed-chunk', bookId, sectionIndex: 0, sectionTitle: 'One', sectionChunkIndex: 0, globalOrder: 0, text: 'remove this indexed passage', range }],
      { sectionIndex: 1, sectionChunkIndex: 0, globalOrder: 1 }, 1, readingState.updatedAt,
    )
    db.exec({ sql: 'DELETE FROM books WHERE id = ?', bind: [bookId] })
    expect(db.selectValue('SELECT count(*) FROM chunks WHERE book_id = ?', [bookId])).toBe(0)
    expect(db.selectValue("SELECT count(*) FROM chunks_fts WHERE chunks_fts MATCH 'indexed'")).toBe(0)
    expect(repository.getIndexState(bookId)).toBeNull()
  })

  it('rejects a study item id that already belongs to another book', async () => {
    const firstBookId = await sha256BookId(book.epubBytes)
    const secondBook = { ...book, epubBytes: new Uint8Array([2, 4, 6, 8]) }
    const secondBookId = await sha256BookId(secondBook.epubBytes)
    repository.importBook(firstBookId, book)
    repository.importBook(secondBookId, secondBook)
    const firstBoard = repository.getOrCreateBoard(firstBookId, readingState.updatedAt)
    const secondBoard = repository.getOrCreateBoard(secondBookId, readingState.updatedAt)
    const firstItem: StudyItem = {
      id: 'shared-item-id',
      boardId: firstBoard.id,
      origin: 'user',
      revision: 1,
      payload: { kind: 'prose', text: 'First book content' },
      sortOrder: 0,
      createdAt: readingState.updatedAt,
      updatedAt: readingState.updatedAt,
    }
    repository.commitStudyItem(
      firstItem,
      mutation({ operation: 'create', bookId: firstBookId, actionToken: 'a' }),
      readingState.updatedAt,
    )

    // The message a person sees names the problem without confirming what is on
    // the other book's board; the detail on the Error carries the specifics.
    try {
      repository.commitStudyItem(
        { ...firstItem, boardId: secondBoard.id, payload: { kind: 'prose', text: 'Overwrite' } },
        mutation({ operation: 'create', bookId: secondBookId, actionToken: 'b' }),
        readingState.updatedAt,
      )
      throw new Error('expected a rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(OwnershipError)
      expect((error as OwnershipError).userMessage).toMatch(/already in use/)
    }
    expect(repository.listStudyItems(firstBoard.id)).toEqual([
      { ...firstItem, actionGroupId: 'group' },
    ])
    expect(repository.listStudyItems(secondBoard.id)).toEqual([])
  })
})

function mutation(overrides: Partial<StudyMutation> & { bookId: string }): StudyMutation {
  return {
    operation: 'create',
    origin: 'user',
    actionToken: 'token',
    actionGroupId: 'group',
    ...overrides,
  }
}

describe('SHA-256 book identity', () => {
  it('uses the full byte checksum as a lowercase identifier', async () => {
    expect(await sha256BookId(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
