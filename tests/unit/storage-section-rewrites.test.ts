// @vitest-environment node

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ImportBookInput } from '../../src/domain/index.ts'
import type { SectionRewriteVersion } from '../../src/domain/remaster.ts'
import {
  LibraryRepository,
  SECTION_REWRITE_HISTORY_LIMIT,
} from '../../src/storage/library-repository.ts'
import { sha256BookId } from '../../src/storage/hash.ts'
import { initializeSchema, STORAGE_SCHEMA_VERSION } from '../../src/storage/schema.ts'

const book: ImportBookInput = {
  metadata: {
    title: 'Calculus Made Easy',
    authors: [{ name: 'Silvanus P. Thompson' }],
    language: 'en',
  },
  epubBytes: new Uint8Array([1, 3, 3, 7]),
  importedAt: '2026-09-01T12:00:00.000Z',
  provenance: { kind: 'imported', originalFileName: 'calculus.epub' },
}

function version(overrides: Partial<SectionRewriteVersion> = {}): SectionRewriteVersion {
  return {
    html: '<h2>Chapter III</h2><p>The ratio <math><mi>x</mi></math> matters.</p>',
    at: Date.parse('2026-09-02T10:00:00.000Z'),
    ...overrides,
  }
}

describe('saved section rewrites', () => {
  let db: Database
  let repository: LibraryRepository
  let bookId: string

  beforeEach(async () => {
    const sqlite = await sqlite3InitModule()
    db = new sqlite.oo1.DB(':memory:', 'c')
    initializeSchema(db)
    repository = new LibraryRepository(db)
    bookId = await sha256BookId(book.epubBytes)
    repository.importBook(bookId, book)
  })

  afterEach(() => db.close())

  it('creates the version 5 table', () => {
    expect(db.selectValue('PRAGMA user_version')).toBe(STORAGE_SCHEMA_VERSION)
    expect(STORAGE_SCHEMA_VERSION).toBe(5)
    expect(
      db.selectValue(`SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, [
        'section_rewrites',
      ]),
    ).toBe(1)
  })

  it('has nothing saved for a book nobody has rewritten', () => {
    expect(repository.listSectionRewrites(bookId)).toEqual([])
  })

  it('saves a revision and reads it back whole', () => {
    repository.appendSectionRewrite(bookId, 10, version({ css: '.a { color: red; }', summary: 'Set the derivative as MathML' }))

    expect(repository.listSectionRewrites(bookId)).toEqual([
      {
        sectionIndex: 10,
        versions: [
          {
            html: '<h2>Chapter III</h2><p>The ratio <math><mi>x</mi></math> matters.</p>',
            css: '.a { color: red; }',
            summary: 'Set the derivative as MathML',
            at: Date.parse('2026-09-02T10:00:00.000Z'),
          },
        ],
      },
    ])
  })

  it('keeps revisions in the order they were written', () => {
    repository.appendSectionRewrite(bookId, 10, version({ html: '<p>first</p>' }))
    repository.appendSectionRewrite(bookId, 10, version({ html: '<p>second</p>' }))
    repository.appendSectionRewrite(bookId, 10, version({ html: '<p>third</p>' }))

    const [saved] = repository.listSectionRewrites(bookId)
    expect(saved?.versions.map((entry) => entry.html)).toEqual([
      '<p>first</p>',
      '<p>second</p>',
      '<p>third</p>',
    ])
  })

  it('keeps sections apart', () => {
    repository.appendSectionRewrite(bookId, 3, version({ html: '<p>three</p>' }))
    repository.appendSectionRewrite(bookId, 10, version({ html: '<p>ten</p>' }))

    expect(repository.listSectionRewrites(bookId).map((entry) => entry.sectionIndex)).toEqual([
      3, 10,
    ])
  })

  it('keeps books apart', async () => {
    const otherBook = { ...book, epubBytes: new Uint8Array([4, 2]) }
    const other = await sha256BookId(otherBook.epubBytes)
    repository.importBook(other, otherBook)
    repository.appendSectionRewrite(bookId, 10, version())

    expect(repository.listSectionRewrites(other)).toEqual([])
  })

  describe('undo', () => {
    it('drops only the newest revision', () => {
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>first</p>' }))
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>second</p>' }))

      expect(repository.undoSectionRewrite(bookId, 10)).toBe(1)
      expect(repository.listSectionRewrites(bookId)[0]?.versions.map((v) => v.html)).toEqual([
        '<p>first</p>',
      ])
    })

    it('leaves the section with nothing saved once the last one goes', () => {
      repository.appendSectionRewrite(bookId, 10, version())
      expect(repository.undoSectionRewrite(bookId, 10)).toBe(0)
      expect(repository.listSectionRewrites(bookId)).toEqual([])
    })

    it('is harmless on a section nobody has rewritten', () => {
      expect(repository.undoSectionRewrite(bookId, 4)).toBe(0)
    })

    it('does not renumber, so a later save still lands on top', () => {
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>first</p>' }))
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>second</p>' }))
      repository.undoSectionRewrite(bookId, 10)
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>third</p>' }))

      expect(repository.listSectionRewrites(bookId)[0]?.versions.map((v) => v.html)).toEqual([
        '<p>first</p>',
        '<p>third</p>',
      ])
    })
  })

  describe('reset', () => {
    it('forgets every revision of one section and no others', () => {
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>a</p>' }))
      repository.appendSectionRewrite(bookId, 10, version({ html: '<p>b</p>' }))
      repository.appendSectionRewrite(bookId, 3, version({ html: '<p>kept</p>' }))

      repository.clearSectionRewrites(bookId, 10)

      expect(repository.listSectionRewrites(bookId)).toEqual([
        { sectionIndex: 3, versions: [{ html: '<p>kept</p>', at: expect.any(Number) }] },
      ])
    })

    it('leaves the imported book exactly as it was', () => {
      // The publisher's bytes are the thing a person actually owns. Nothing in
      // this feature is allowed to touch them.
      const before = repository.getBook(bookId)?.epubBytes
      repository.appendSectionRewrite(bookId, 10, version())
      repository.clearSectionRewrites(bookId, 10)

      expect(repository.getBook(bookId)?.epubBytes).toEqual(before)
    })
  })

  describe('bounded history', () => {
    it('keeps the most recent revisions and drops the oldest', () => {
      for (let revision = 0; revision < SECTION_REWRITE_HISTORY_LIMIT + 5; revision += 1) {
        repository.appendSectionRewrite(bookId, 10, version({ html: `<p>${revision}</p>` }))
      }

      const saved = repository.listSectionRewrites(bookId)[0]?.versions ?? []
      expect(saved).toHaveLength(SECTION_REWRITE_HISTORY_LIMIT)
      expect(saved.at(-1)?.html).toBe(`<p>${SECTION_REWRITE_HISTORY_LIMIT + 4}</p>`)
      expect(saved[0]?.html).toBe('<p>5</p>')
    })

    it('reports the depth the caller can actually rely on', () => {
      for (let revision = 0; revision < SECTION_REWRITE_HISTORY_LIMIT + 2; revision += 1) {
        const depth = repository.appendSectionRewrite(bookId, 10, version())
        expect(depth).toBe(Math.min(revision + 1, SECTION_REWRITE_HISTORY_LIMIT))
      }
    })
  })

  it('goes with the book when the book is deleted', () => {
    repository.appendSectionRewrite(bookId, 10, version())
    db.exec({ sql: 'DELETE FROM books WHERE id = ?', bind: [bookId] })

    expect(db.selectValue('SELECT count(*) FROM section_rewrites')).toBe(0)
  })
})

describe('migrating a library that predates saved rewrites', () => {
  let db: Database

  beforeEach(async () => {
    const sqlite = await sqlite3InitModule()
    db = new sqlite.oo1.DB(':memory:', 'c')
  })

  afterEach(() => db.close())

  it('adds the table to a version 4 database without disturbing its books', async () => {
    initializeSchema(db)
    const repository = new LibraryRepository(db)
    const existing = await sha256BookId(book.epubBytes)
    repository.importBook(existing, book)
    // Pretend this library was written by the build before this feature.
    db.exec('DROP TABLE section_rewrites')
    db.exec('PRAGMA user_version = 4')

    initializeSchema(db)

    expect(db.selectValue('PRAGMA user_version')).toBe(5)
    expect(new LibraryRepository(db).listSectionRewrites(existing)).toEqual([])
    expect(repository.getBook(existing)?.metadata.title).toBe('Calculus Made Easy')
  })

  it('refuses a library written by a newer build rather than guessing', () => {
    initializeSchema(db)
    db.exec('PRAGMA user_version = 99')
    expect(() => initializeSchema(db)).toThrowError(/newer than this build supports/)
  })
})
