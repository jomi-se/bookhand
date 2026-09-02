// @vitest-environment node

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type {
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
