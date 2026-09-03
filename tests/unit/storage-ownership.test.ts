// @vitest-environment node

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ImportBookInput, StudyExperience, StudyItem, StudyMutation } from '../../src/domain/index.ts'
import { OwnershipError } from '../../src/domain/provenance.ts'
import { fingerprintText } from '../../src/reader/text.ts'
import { LibraryRepository } from '../../src/storage/library-repository.ts'
import { initializeSchema, STORAGE_SCHEMA_VERSION } from '../../src/storage/schema.ts'

const NOW = '2026-09-02T12:00:00.000Z'

function bookInput(seed: number): ImportBookInput {
  return {
    metadata: { title: `Book ${seed}`, authors: [{ name: 'Ada Reader' }] },
    epubBytes: new Uint8Array([seed, seed, seed]),
    importedAt: NOW,
    provenance: { kind: 'imported', originalFileName: `book-${seed}.epub` },
  }
}

describe('who may write to a study board', () => {
  let db: Database
  let repository: LibraryRepository
  let bookId: string
  let otherBookId: string
  let boardId: string
  let otherBoardId: string

  beforeEach(async () => {
    const sqlite3 = await sqlite3InitModule()
    db = new sqlite3.oo1.DB(':memory:')
    initializeSchema(db)
    repository = new LibraryRepository(db)
    bookId = 'book-1'
    otherBookId = 'book-2'
    repository.importBook(bookId, bookInput(1))
    repository.importBook(otherBookId, bookInput(2))
    boardId = repository.getOrCreateBoard(bookId, NOW).id
    otherBoardId = repository.getOrCreateBoard(otherBookId, NOW).id
  })

  afterEach(() => db.close())

  function item(overrides: Partial<StudyItem> = {}): StudyItem {
    return {
      id: 'item-1',
      boardId,
      origin: 'user',
      revision: 1,
      payload: { kind: 'prose', text: 'The slope at a point' },
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  function mutation(overrides: Partial<StudyMutation> = {}): StudyMutation {
    return {
      operation: 'create',
      origin: 'user',
      bookId,
      actionToken: `token-${Math.random()}`,
      actionGroupId: 'group-1',
      ...overrides,
    }
  }

  function rejection(run: () => unknown): OwnershipError {
    try {
      run()
    } catch (error) {
      if (error instanceof OwnershipError) return error
      throw error
    }
    throw new Error('expected a rejection')
  }

  it('lets the person create, revise, and delete their own work', () => {
    repository.commitStudyItem(item(), mutation(), NOW)
    const revised = repository.commitStudyItem(
      item({ payload: { kind: 'prose', text: 'Revised' } }),
      mutation({ operation: 'update' }),
      NOW,
    )
    expect(revised.item.revision).toBe(2)
    expect(revised.prior?.payload).toEqual({ kind: 'prose', text: 'The slope at a point' })
    repository.deleteStudyItem('item-1')
    expect(repository.listStudyItems(boardId)).toEqual([])
  })

  it('commits a titled lesson and all ordered blocks as one retry-safe record', () => {
    const experience: StudyExperience = {
      id: 'lesson-action-1',
      boardId,
      origin: 'agent',
      actionGroupId: 'lesson-group',
      revision: 1,
      title: 'Why the derivative is a ratio',
      blocks: [
        { id: 'idea', payload: { kind: 'prose', text: 'Begin with a small change.' } },
        { id: 'formula', payload: { kind: 'equation', expression: 'dy/dx' } },
        { id: 'check', payload: { kind: 'question', prompt: 'What shrinks?' } },
      ],
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const authority = {
      origin: 'agent' as const,
      bookId,
      actionToken: 'lesson-action-1',
      actionGroupId: 'lesson-group',
    }
    const first = repository.commitStudyExperience(experience, authority, NOW)
    const replay = repository.commitStudyExperience(experience, authority, NOW)
    expect(first.replayed).toBe(false)
    expect(replay.replayed).toBe(true)
    expect(repository.listStudyExperiences(boardId)).toEqual([first.experience])
    expect(() =>
      repository.commitStudyExperience(
        { ...experience, title: 'A different lesson wearing the same token' },
        authority,
        NOW,
      ),
    ).toThrow(OwnershipError)
    expect(repository.listStudyExperiences(boardId)).toHaveLength(1)
    repository.deleteStudyExperience(experience.id, boardId)
    expect(repository.listStudyExperiences(boardId)).toEqual([])
  })

  it('rolls back the lesson when its action receipt cannot be recorded', () => {
    db.exec(`CREATE TRIGGER refuse_lesson_receipt BEFORE INSERT ON action_receipts
             WHEN NEW.operation = 'create-study-experience'
             BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;`)
    const experience: StudyExperience = {
      id: 'lesson-failed',
      boardId,
      origin: 'agent',
      actionGroupId: 'lesson-failed',
      revision: 1,
      title: 'This must not half-land',
      blocks: [{ id: 'only', payload: { kind: 'prose', text: 'Atomic or absent.' } }],
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(() =>
      repository.commitStudyExperience(
        experience,
        {
          origin: 'agent',
          bookId,
          actionToken: 'lesson-failed',
          actionGroupId: 'lesson-failed',
        },
        NOW,
      ),
    ).toThrow(/injected receipt failure/)
    expect(repository.listStudyExperiences(boardId)).toEqual([])
  })

  it('gives an agent a token when it creates, and never lists that token back', () => {
    const commit = repository.commitStudyItem(item(), mutation({ origin: 'agent' }), NOW)
    expect(commit.updateToken).toMatch(/[0-9a-f-]{36}/)
    expect(commit.item.origin).toBe('agent')
    // Listing the board must not hand the token to whoever asks for the board.
    expect(JSON.stringify(repository.listStudyItems(boardId))).not.toContain(commit.updateToken!)
  })

  it('lets an agent revise its own block when it presents that token', () => {
    const created = repository.commitStudyItem(item(), mutation({ origin: 'agent' }), NOW)
    const revised = repository.commitStudyItem(
      item({ payload: { kind: 'prose', text: 'Revised by the agent' } }),
      mutation({ operation: 'update', origin: 'agent', updateToken: created.updateToken }),
      NOW,
    )
    expect(revised.item.payload).toEqual({ kind: 'prose', text: 'Revised by the agent' })
  })

  it('refuses an agent revision with no token at all', () => {
    repository.commitStudyItem(item(), mutation({ origin: 'agent' }), NOW)
    const error = rejection(() =>
      repository.commitStudyItem(
        item({ payload: { kind: 'prose', text: 'No token' } }),
        mutation({ operation: 'update', origin: 'agent' }),
        NOW,
      ),
    )
    expect(error.userMessage).toMatch(/only revise blocks it created/)
    expect(repository.listStudyItems(boardId)[0]?.payload).toEqual({
      kind: 'prose',
      text: 'The slope at a point',
    })
  })

  it('refuses an agent revision presenting another block’s token', () => {
    const first = repository.commitStudyItem(item(), mutation({ origin: 'agent' }), NOW)
    repository.commitStudyItem(item({ id: 'item-2' }), mutation({ origin: 'agent' }), NOW)
    const error = rejection(() =>
      repository.commitStudyItem(
        item({ id: 'item-2', payload: { kind: 'prose', text: 'Wrong token' } }),
        mutation({ operation: 'update', origin: 'agent', updateToken: first.updateToken }),
        NOW,
      ),
    )
    expect(error.userMessage).toMatch(/only revise blocks it created/)
  })

  it('refuses to let an agent touch what the person wrote', () => {
    repository.commitStudyItem(item(), mutation({ origin: 'user' }), NOW)
    const error = rejection(() =>
      repository.commitStudyItem(
        item({ payload: { kind: 'prose', text: 'Agent rewrite' } }),
        mutation({ operation: 'update', origin: 'agent', updateToken: 'anything' }),
        NOW,
      ),
    )
    expect(error.userMessage).toMatch(/cannot change a block you wrote/)
  })

  it('refuses a create under an id that is already taken', () => {
    repository.commitStudyItem(item(), mutation(), NOW)
    const error = rejection(() => repository.commitStudyItem(item(), mutation(), NOW))
    expect(error.userMessage).toMatch(/already in use/)
  })

  it('refuses an update to an id that names nothing', () => {
    const error = rejection(() =>
      repository.commitStudyItem(item({ id: 'never-existed' }), mutation({ operation: 'update' }), NOW),
    )
    expect(error.userMessage).toMatch(/no longer exists/)
  })

  it('refuses to reach across books, even for the person', () => {
    repository.commitStudyItem(item({ boardId: otherBoardId }), mutation({ bookId: otherBookId }), NOW)
    const error = rejection(() =>
      repository.commitStudyItem(
        item({ boardId: otherBoardId, payload: { kind: 'prose', text: 'From book 1' } }),
        mutation({ operation: 'update', bookId }),
        NOW,
      ),
    )
    expect(error.userMessage).toMatch(/different book/)
  })
})

describe('retrying an action that may already have happened', () => {
  let db: Database
  let repository: LibraryRepository
  let boardId: string

  beforeEach(async () => {
    const sqlite3 = await sqlite3InitModule()
    db = new sqlite3.oo1.DB(':memory:')
    initializeSchema(db)
    repository = new LibraryRepository(db)
    repository.importBook('book-1', bookInput(1))
    boardId = repository.getOrCreateBoard('book-1', NOW).id
  })

  afterEach(() => db.close())

  const base: StudyItem = {
    id: 'item-1',
    boardId: '',
    origin: 'agent',
    revision: 1,
    payload: { kind: 'prose', text: 'Written once' },
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  }

  const mutation: StudyMutation = {
    operation: 'create',
    origin: 'agent',
    bookId: 'book-1',
    actionToken: 'the-same-token',
    actionGroupId: 'group-1',
  }

  it('returns the first result for an identical retry, writing nothing twice', () => {
    const first = repository.commitStudyItem({ ...base, boardId }, mutation, NOW)
    const retry = repository.commitStudyItem({ ...base, boardId }, mutation, NOW)

    expect(retry.replayed).toBe(true)
    expect(retry.item).toEqual(first.item)
    // Critically, the same token comes back, so a retry after a dropped
    // response still leaves the agent able to revise what it made.
    expect(retry.updateToken).toBe(first.updateToken)
    expect(repository.listStudyItems(boardId)).toHaveLength(1)
  })

  it('refuses the same token carrying different content', () => {
    repository.commitStudyItem({ ...base, boardId }, mutation, NOW)
    let caught: OwnershipError | undefined
    try {
      repository.commitStudyItem(
        { ...base, boardId, payload: { kind: 'prose', text: 'Something else' } },
        mutation,
        NOW,
      )
    } catch (error) {
      caught = error as OwnershipError
    }
    expect(caught?.userMessage).toMatch(/already used for a different change/)
    expect(repository.listStudyItems(boardId)).toHaveLength(1)
  })

  it('treats a payload that only differs in key order as the same action', () => {
    const first = repository.commitStudyItem(
      { ...base, boardId, payload: { kind: 'question', prompt: 'Why?', answer: 'Because' } },
      mutation,
      NOW,
    )
    const retry = repository.commitStudyItem(
      { ...base, boardId, payload: { kind: 'question', answer: 'Because', prompt: 'Why?' } },
      mutation,
      NOW,
    )
    expect(retry.replayed).toBe(true)
    expect(retry.item.id).toBe(first.item.id)
  })

  it('scopes tokens by origin, so a person and an agent never collide', () => {
    repository.commitStudyItem({ ...base, boardId }, mutation, NOW)
    const byPerson = repository.commitStudyItem(
      { ...base, boardId, id: 'item-2', origin: 'user' },
      { ...mutation, origin: 'user' },
      NOW,
    )
    expect(byPerson.replayed).toBe(false)
    expect(repository.listStudyItems(boardId)).toHaveLength(2)
  })
})

describe('taking a study-item write back', () => {
  let db: Database
  let repository: LibraryRepository
  let boardId: string

  beforeEach(async () => {
    const sqlite3 = await sqlite3InitModule()
    db = new sqlite3.oo1.DB(':memory:')
    initializeSchema(db)
    repository = new LibraryRepository(db)
    repository.importBook('book-1', bookInput(1))
    boardId = repository.getOrCreateBoard('book-1', NOW).id
  })

  afterEach(() => db.close())

  function write(id: string, text: string, operation: 'create' | 'update', token = id) {
    return repository.commitStudyItem(
      {
        id,
        boardId,
        origin: 'agent',
        revision: 1,
        payload: { kind: 'prose', text },
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        operation,
        origin: 'agent',
        bookId: 'book-1',
        actionToken: `${token}-${operation}-${text}`,
        actionGroupId: 'group-1',
        ...(operation === 'update' ? { updateToken: tokens.get(id) } : {}),
      },
      NOW,
    )
  }

  const tokens = new Map<string, string>()

  it('undoing a creation removes the block', () => {
    const created = write('item-1', 'First', 'create')
    expect(repository.undoStudyItem('item-1', created.item.revision, NOW)).toBeUndefined()
    expect(repository.listStudyItems(boardId)).toEqual([])
  })

  it('undoing a revision restores exactly the version before it', () => {
    const created = write('item-1', 'First', 'create')
    tokens.set('item-1', created.updateToken!)
    const revised = write('item-1', 'Second', 'update')
    expect(revised.item.revision).toBe(2)

    const restored = repository.undoStudyItem('item-1', 2, NOW)
    expect(restored?.payload).toEqual({ kind: 'prose', text: 'First' })
    expect(restored?.revision).toBe(1)
  })

  it('refuses an undo that would discard work done since', () => {
    const created = write('item-1', 'First', 'create')
    tokens.set('item-1', created.updateToken!)
    write('item-1', 'Second', 'update')
    write('item-1', 'Third', 'update')

    // The caller still believes it is undoing revision 2.
    let caught: OwnershipError | undefined
    try {
      repository.undoStudyItem('item-1', 2, NOW)
    } catch (error) {
      caught = error as OwnershipError
    }
    expect(caught?.userMessage).toMatch(/would discard newer work/)
    expect(repository.listStudyItems(boardId)[0]?.payload).toEqual({
      kind: 'prose',
      text: 'Third',
    })
  })

  it('leaves every unrelated block alone', () => {
    const first = write('item-1', 'First', 'create')
    write('item-2', 'Untouched', 'create')
    repository.undoStudyItem('item-1', first.item.revision, NOW)

    const remaining = repository.listStudyItems(boardId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe('item-2')
  })
})

describe('opening a database written before provenance existed', () => {
  it('adds the new columns and attributes existing rows to the person', async () => {
    const sqlite3 = await sqlite3InitModule()
    const db = new sqlite3.oo1.DB(':memory:')
    try {
      // Exactly the version 1 shape, as it shipped.
      db.exec(`
        CREATE TABLE books (
          id TEXT PRIMARY KEY, metadata_json TEXT NOT NULL, cover_media_type TEXT,
          cover_blob BLOB, epub_blob BLOB NOT NULL, imported_at TEXT NOT NULL,
          provenance_json TEXT NOT NULL
        ) STRICT;
        CREATE TABLE boards (
          id TEXT PRIMARY KEY, book_id TEXT NOT NULL, title TEXT NOT NULL,
          layout_mode TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE study_items (
          id TEXT PRIMARY KEY, board_id TEXT NOT NULL, source_range_json TEXT,
          kind TEXT NOT NULL, payload_json TEXT NOT NULL, sort_order INTEGER NOT NULL,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE annotations (
          id TEXT PRIMARY KEY, book_id TEXT NOT NULL, range_json TEXT NOT NULL,
          quote TEXT NOT NULL, color TEXT, note TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        ) STRICT;
        PRAGMA user_version = 1;
      `)
      db.exec({
        sql: `INSERT INTO boards VALUES ('board-1', 'book-1', 'Study board', 'docked', ?, ?)`,
        bind: [NOW, NOW],
      })
      db.exec({
        sql: `INSERT INTO study_items VALUES ('old-item', 'board-1', ?, 'quotation', ?, 0, ?, ?)`,
        bind: [
          JSON.stringify({
            range: {
              startCfi: 'start',
              endCfi: 'end',
              sectionIndex: 0,
              textFingerprint: fingerprintText('Written before provenance'),
            },
            label: 'Chapter X',
          }),
          JSON.stringify({ kind: 'quotation', text: 'Written before provenance' }),
          NOW,
          NOW,
        ],
      })
      db.exec({
        sql: `INSERT INTO annotations VALUES ('old-mark', 'book-1', ?, ?, 'accent', NULL, ?, ?)`,
        bind: [
          JSON.stringify({
            startCfi: 'start',
            endCfi: 'end',
            sectionIndex: 0,
            textFingerprint: fingerprintText('Marked before provenance'),
          }),
          'Marked before provenance',
          NOW,
          NOW,
        ],
      })

      initializeSchema(db)

      expect(Number(db.selectValue('PRAGMA user_version'))).toBe(STORAGE_SCHEMA_VERSION)
      const migrated = new LibraryRepository(db).listStudyItems('board-1')
      expect(migrated).toHaveLength(1)
      // Truthful, not merely convenient: no agent path existed when this was
      // written, so the person is the only author it could have had.
      expect(migrated[0]?.origin).toBe('user')
      expect(migrated[0]?.revision).toBe(1)
      expect(migrated[0]?.payload).toEqual({
        kind: 'quotation',
        text: 'Written before provenance',
      })
      expect(migrated[0]?.source).toEqual({
        status: 'pending-legacy',
        ownership: 'derived',
      })
      expect(new LibraryRepository(db).listAnnotations('book-1')[0]?.source).toEqual({
        status: 'pending-legacy',
        ownership: 'derived',
      })
    } finally {
      db.close()
    }
  })
})
