import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'

import type {
  Annotation,
  BookCatalogEntry,
  BookMetadata,
  BookProvenance,
  BookRange,
  ImportBookInput,
  ReadingState,
  StoredBook,
  StudyBoard,
  StudyBoardView,
  StudyItem,
  StudyItemCommit,
  StudyItemPayload,
  StudyMutation,
  SourceLink,
  IndexChunk,
  IndexState,
  SearchHit,
} from '../domain/index.ts'
import { canonicalize, OwnershipError } from '../domain/provenance.ts'
import { fingerprintText } from '../reader/text.ts'
import {
  INDEX_CHUNK_VERSION,
  INDEX_TOKENIZER_VERSION,
  SEARCH_RESULT_MAX_CHARACTERS,
  normalizeSearchQuery,
  searchAvailability,
  type SearchResult,
} from '../domain/search.ts'
import { SOURCE_EXTRACTION_VERSION } from '../domain/source.ts'

type Row = Record<string, SqlValue>

export interface IndexRepositoryHooks {
  /** Test harnesses may throw here to prove the surrounding transaction rolls back. */
  beforeIndexChunk?(chunk: IndexChunk): void
}

interface FlattenedMetadata {
  readonly title: string
  readonly subtitle?: string
  readonly authors: BookMetadata['authors']
  readonly language?: string
  readonly publisher?: string
  readonly description?: string
  readonly published?: string
  readonly modified?: string
  readonly identifier?: string
}

function withoutCover(metadata: BookMetadata): FlattenedMetadata {
  const { cover: _cover, ...flat } = metadata
  return flat
}

function asString(value: SqlValue, field: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${field} in library database`)
  return value
}

function asBytes(value: SqlValue, field: string): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new Error(`Invalid ${field} in library database`)
  }
  return value
}

function parseJson<T>(value: SqlValue, field: string): T {
  return JSON.parse(asString(value, field)) as T
}

function metadataFromRow(row: Row): BookMetadata {
  const metadata = parseJson<FlattenedMetadata>(row.metadata_json, 'book metadata')
  const coverMediaType = row.cover_media_type
  const coverBlob = row.cover_blob
  if (coverMediaType === null && coverBlob === null) return metadata
  if (typeof coverMediaType !== 'string' || !(coverBlob instanceof Uint8Array)) {
    throw new Error('Invalid book cover in library database')
  }
  return { ...metadata, cover: { mediaType: coverMediaType, bytes: coverBlob } }
}

function readingStateFromRow(row: Row): ReadingState {
  return {
    bookId: asString(row.book_id, 'reading-state book id'),
    location: parseJson(row.location_json, 'reader location'),
    style: parseJson(row.style_json, 'reader style'),
    updatedAt: asString(row.updated_at, 'reading-state timestamp'),
  }
}

function finalize(statement: { finalize(): void }): void {
  statement.finalize()
}

export class LibraryRepository {
  private readonly db: Database
  private readonly indexHooks: IndexRepositoryHooks

  constructor(db: Database, indexHooks: IndexRepositoryHooks = {}) {
    this.db = db
    this.indexHooks = indexHooks
  }

  importBook(bookId: string, book: ImportBookInput): string {
    this.db.transaction('IMMEDIATE', () => {
      const statement = this.db.prepare(`
        INSERT INTO books (
          id, metadata_json, cover_media_type, cover_blob, epub_blob,
          imported_at, provenance_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `)
      try {
        statement
          .bind([
            bookId,
            JSON.stringify(withoutCover(book.metadata)),
            book.metadata.cover?.mediaType ?? null,
            book.metadata.cover?.bytes ?? null,
            book.epubBytes,
            book.importedAt,
            JSON.stringify(book.provenance),
          ])
          .step()
      } finally {
        finalize(statement)
      }
    })
    return bookId
  }

  getBook(bookId: string): StoredBook | null {
    const row = this.db.selectObject(
      `SELECT id, metadata_json, cover_media_type, cover_blob, epub_blob,
              imported_at, provenance_json
       FROM books WHERE id = ?`,
      [bookId],
    )
    if (!row) return null
    return {
      id: asString(row.id, 'book id'),
      metadata: metadataFromRow(row),
      epubBytes: asBytes(row.epub_blob, 'EPUB bytes'),
      importedAt: asString(row.imported_at, 'import timestamp'),
      provenance: parseJson<BookProvenance>(row.provenance_json, 'provenance'),
    }
  }

  listBooks(): readonly BookCatalogEntry[] {
    const rows = this.db.selectObjects(`
      SELECT b.id, b.metadata_json, b.cover_media_type, b.cover_blob,
             b.imported_at, b.provenance_json,
             r.book_id, r.location_json, r.style_json, r.updated_at
      FROM books b
      LEFT JOIN reading_state r ON r.book_id = b.id
      ORDER BY b.imported_at DESC, b.id ASC
    `)
    return rows.map((row) => ({
      id: asString(row.id, 'book id'),
      metadata: metadataFromRow(row),
      importedAt: asString(row.imported_at, 'import timestamp'),
      provenance: parseJson<BookProvenance>(row.provenance_json, 'provenance'),
      ...(row.book_id === null ? {} : { readingState: readingStateFromRow(row) }),
    }))
  }

  putReadingState(state: ReadingState): string {
    const statement = this.db.prepare(`
      INSERT INTO reading_state (
        book_id, location_json, style_json, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET
        location_json = excluded.location_json,
        style_json = excluded.style_json,
        updated_at = excluded.updated_at
    `)
    try {
      statement
        .bind([
          state.bookId,
          JSON.stringify(state.location),
          JSON.stringify(state.style),
          state.updatedAt,
        ])
        .step()
    } finally {
      finalize(statement)
    }
    return state.bookId
  }

  getReadingState(bookId: string): ReadingState | null {
    const row = this.db.selectObject(
      `SELECT book_id, location_json, style_json, updated_at
       FROM reading_state WHERE book_id = ?`,
      [bookId],
    )
    return row ? readingStateFromRow(row) : null
  }

  claimPersistenceRequest(): boolean {
    return this.db.transaction('IMMEDIATE', () => {
      this.db.exec({
        sql: `INSERT INTO app_meta(key, value) VALUES ('persistence-requested', '1')
              ON CONFLICT(key) DO NOTHING`,
      })
      return Number(this.db.changes()) === 1
    })
  }

  countBooks(): number {
    return Number(this.db.selectValue('SELECT count(*) FROM books') ?? 0)
  }

  saveAnnotation(annotation: Annotation): Annotation {
    const statement = this.db.prepare(`
      INSERT INTO annotations (
        id, book_id, range_json, quote, color, note, created_at, updated_at,
        origin, action_group_id, source_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        range_json = excluded.range_json,
        quote = excluded.quote,
        color = excluded.color,
        note = excluded.note,
        updated_at = excluded.updated_at,
        action_group_id = excluded.action_group_id,
        source_json = excluded.source_json
    `)
    try {
      statement
        .bind([
          annotation.id,
          annotation.bookId,
          JSON.stringify(annotation.range),
          annotation.quote,
          annotation.color,
          annotation.note ?? null,
          annotation.createdAt,
          annotation.updatedAt,
          annotation.origin,
          annotation.actionGroupId ?? null,
          annotation.source ? JSON.stringify(annotation.source) : null,
        ])
        .step()
    } finally {
      finalize(statement)
    }
    return annotation
  }

  /** Refresh canonical source data without pretending the person edited the annotation. */
  repairAnnotationSource(annotation: Annotation): Annotation {
    const existing = this.db.selectObject(
      'SELECT book_id FROM annotations WHERE id = ?',
      [annotation.id],
    )
    if (!existing || asString(existing.book_id, 'annotation book id') !== annotation.bookId) {
      throw new Error('That annotation no longer exists in this book.')
    }
    this.db.exec({
      sql: `UPDATE annotations
            SET range_json = ?, quote = ?, source_json = ?
            WHERE id = ? AND book_id = ?`,
      bind: [
        JSON.stringify(annotation.range),
        annotation.quote,
        annotation.source ? JSON.stringify(annotation.source) : null,
        annotation.id,
        annotation.bookId,
      ],
    })
    return annotation
  }

  deleteAnnotation(annotationId: string): void {
    this.db.exec({ sql: 'DELETE FROM annotations WHERE id = ?', bind: [annotationId] })
  }

  listAnnotations(bookId: string): readonly Annotation[] {
    const rows = this.db.selectObjects(
      `SELECT id, book_id, range_json, quote, color, note, created_at, updated_at,
              origin, action_group_id, source_json
       FROM annotations WHERE book_id = ? ORDER BY created_at ASC`,
      [bookId],
    )
    return rows.map((row) => ({
      id: asString(row.id, 'annotation id'),
      bookId: asString(row.book_id, 'annotation book id'),
      range: parseJson<BookRange>(row.range_json, 'annotation range'),
      quote: asString(row.quote, 'annotation quote'),
      source:
        row.source_json === null
          ? { status: 'pending-legacy', ownership: 'derived' }
          : parseJson<SourceLink>(row.source_json, 'annotation source'),
      color: asString(row.color, 'annotation color') as Annotation['color'],
      ...(row.note === null ? {} : { note: asString(row.note, 'annotation note') }),
      createdAt: asString(row.created_at, 'annotation created time'),
      updatedAt: asString(row.updated_at, 'annotation updated time'),
      origin: asString(row.origin, 'annotation origin') as Annotation['origin'],
      ...(row.action_group_id === null
        ? {}
        : { actionGroupId: asString(row.action_group_id, 'annotation action group') }),
    }))
  }

  /** One board per book for this slice; created on first use. */
  getOrCreateBoard(bookId: string, now: string): StudyBoard {
    return this.db.transaction('IMMEDIATE', () => {
      const existing = this.db.selectObject(
        `SELECT id, book_id, title, layout_mode, created_at, updated_at
         FROM boards WHERE book_id = ? ORDER BY created_at ASC LIMIT 1`,
        [bookId],
      )
      if (existing) return boardFromRow(existing)
      const board: StudyBoard = {
        id: `board-${bookId}`,
        bookId,
        title: 'Study board',
        view: 'docked',
        createdAt: now,
        updatedAt: now,
      }
      this.db.exec({
        sql: `INSERT INTO boards (id, book_id, title, layout_mode, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        bind: [board.id, board.bookId, board.title, board.view, board.createdAt, board.updatedAt],
      })
      return board
    })
  }

  setBoardView(boardId: string, view: StudyBoardView, now: string): StudyBoard {
    this.db.exec({
      sql: 'UPDATE boards SET layout_mode = ?, updated_at = ? WHERE id = ?',
      bind: [view, now, boardId],
    })
    const row = this.db.selectObject(
      `SELECT id, book_id, title, layout_mode, created_at, updated_at FROM boards WHERE id = ?`,
      [boardId],
    )
    if (!row) throw new Error('That study board no longer exists')
    return boardFromRow(row)
  }

  /**
   * Write one study item under a stated authority, in one transaction.
   *
   * Everything that decides whether a write is allowed lives here rather than
   * at the command boundary, because "allowed" depends on rows — who made this
   * item, which board it is on, whether this action already happened. A check
   * performed above the database can be true when it is made and false when the
   * write lands; a check inside the transaction cannot.
   *
   * `VAL-STUDY-ID-OWNERSHIP`.
   */
  commitStudyItem(item: StudyItem, mutation: StudyMutation, now: string): StudyItemCommit {
    return this.db.transaction('IMMEDIATE', () => {
      // What the caller asked for, and nothing the product worked out for
      // itself. `sortOrder` is derived from what is already on the board, so a
      // retry computes a different one and an identical request would look like
      // a different action — the retry protection would protect nothing.
      const digest = canonicalize({
        id: item.id,
        boardId: item.boardId,
        payload: item.payload,
        sourceRange: item.sourceRange ?? null,
        sourceLabel: item.sourceLabel ?? null,
        source: item.source ?? null,
      })

      const replay = this.#findReceipt(mutation)
      if (replay) {
        if (replay.operation !== mutation.operation || replay.payload_digest !== digest) {
          throw new OwnershipError(
            'That action was already used for a different change.',
            `Action token reused with operation ${mutation.operation} and a different payload`,
          )
        }
        return { ...(parseJson<StudyItemCommit>(replay.result_json, 'action receipt')), replayed: true }
      }

      const existing = this.#studyItemRow(item.id)
      const commit =
        mutation.operation === 'create'
          ? this.#createStudyItem(item, mutation, existing)
          : this.#updateStudyItem(item, mutation, existing, now)

      this.db.exec({
        sql: `INSERT INTO action_receipts
              (book_id, origin, action_token, operation, payload_digest, result_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        bind: [
          mutation.bookId,
          mutation.origin,
          mutation.actionToken,
          mutation.operation,
          digest,
          JSON.stringify({ ...commit, replayed: false }),
          now,
        ],
      })
      return commit
    })
  }

  #findReceipt(mutation: StudyMutation): Row | undefined {
    return this.db.selectObject(
      `SELECT operation, payload_digest, result_json FROM action_receipts
       WHERE book_id = ? AND origin = ? AND action_token = ?`,
      [mutation.bookId, mutation.origin, mutation.actionToken],
    )
  }

  /** Repair source metadata without creating a revision or an action receipt. */
  repairStudyItemSource(item: StudyItem): StudyItem {
    const existing = this.#studyItemRow(item.id)
    if (!existing || asString(existing.board_id, 'study item board id') !== item.boardId) {
      throw new Error('That study block no longer exists on this board.')
    }
    this.db.exec({
      sql: `UPDATE study_items
            SET source_range_json = ?, source_json = ?, payload_json = ?
            WHERE id = ? AND board_id = ?`,
      bind: [
        sourceJson(item),
        item.source ? JSON.stringify(item.source) : null,
        JSON.stringify(item.payload),
        item.id,
        item.boardId,
      ],
    })
    return item
  }

  #studyItemRow(itemId: string): Row | undefined {
    return this.db.selectObject(
      `SELECT i.id, i.board_id, i.source_range_json, i.source_json, i.payload_json, i.sort_order,
              i.created_at, i.updated_at, i.origin, i.update_token, i.action_group_id, i.revision,
              b.book_id AS owning_book_id
       FROM study_items i JOIN boards b ON b.id = i.board_id
       WHERE i.id = ?`,
      [itemId],
    )
  }

  #createStudyItem(item: StudyItem, mutation: StudyMutation, existing: Row | undefined): StudyItemCommit {
    if (existing) {
      // Deliberately the same message whether the id collides on this board or
      // another book's: telling a caller which would let it probe for the
      // existence of ids it has no business knowing about.
      throw new OwnershipError(
        'That study block id is already in use.',
        `create with existing id ${item.id}`,
      )
    }
    // Only an agent needs a token, and only to prove later that it was the
    // author. A person's authority comes from being the person.
    const updateToken = mutation.origin === 'agent' ? crypto.randomUUID() : null
    const created: StudyItem = {
      ...item,
      origin: mutation.origin,
      revision: 1,
      ...(mutation.actionGroupId ? { actionGroupId: mutation.actionGroupId } : {}),
    }
    this.db.exec({
      sql: `INSERT INTO study_items (
              id, board_id, source_range_json, kind, payload_json, sort_order,
              created_at, updated_at, origin, update_token, action_group_id, revision, source_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      bind: [
        created.id,
        created.boardId,
        sourceJson(created),
        created.payload.kind,
        JSON.stringify(created.payload),
        created.sortOrder,
        created.createdAt,
        created.updatedAt,
        created.origin,
        updateToken,
        mutation.actionGroupId,
        created.source ? JSON.stringify(created.source) : null,
      ],
    })
    return { item: created, ...(updateToken ? { updateToken } : {}), replayed: false }
  }

  #updateStudyItem(
    item: StudyItem,
    mutation: StudyMutation,
    existing: Row | undefined,
    now: string,
  ): StudyItemCommit {
    if (!existing) {
      throw new OwnershipError(
        'That study block no longer exists.',
        `update with unknown id ${item.id}`,
      )
    }
    if (asString(existing.owning_book_id, 'owning book') !== mutation.bookId) {
      throw new OwnershipError(
        'That study block belongs to a different book.',
        `cross-book update of ${item.id}`,
      )
    }
    if (mutation.origin === 'agent') {
      if (asString(existing.origin, 'study item origin') !== 'agent') {
        throw new OwnershipError(
          'An agent cannot change a block you wrote yourself.',
          `agent update of user-origin item ${item.id}`,
        )
      }
      const held = existing.update_token === null ? null : asString(existing.update_token, 'token')
      if (!held || !mutation.updateToken || mutation.updateToken !== held) {
        throw new OwnershipError(
          'An agent may only revise blocks it created.',
          `missing or wrong update token for ${item.id}`,
        )
      }
    }

    const prior = studyItemFromRow(existing)
    // Keep the superseded version so Undo restores what was actually there,
    // rather than whatever the caller happens to remember.
    this.db.exec({
      sql: `INSERT OR REPLACE INTO study_item_versions
            (item_id, revision, source_range_json, kind, payload_json, sort_order, updated_at, source_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [
        prior.id,
        prior.revision,
        sourceJson(prior),
        prior.payload.kind,
        JSON.stringify(prior.payload),
        prior.sortOrder,
        prior.updatedAt,
        prior.source ? JSON.stringify(prior.source) : null,
      ],
    })

    const updated: StudyItem = {
      ...item,
      boardId: prior.boardId,
      origin: prior.origin,
      createdAt: prior.createdAt,
      updatedAt: now,
      revision: prior.revision + 1,
      ...(mutation.actionGroupId ? { actionGroupId: mutation.actionGroupId } : {}),
    }
    this.db.exec({
      sql: `UPDATE study_items SET
              source_range_json = ?, kind = ?, payload_json = ?, sort_order = ?,
              updated_at = ?, action_group_id = ?, revision = ?, source_json = ?
            WHERE id = ?`,
      bind: [
        sourceJson(updated),
        updated.payload.kind,
        JSON.stringify(updated.payload),
        updated.sortOrder,
        updated.updatedAt,
        mutation.actionGroupId,
        updated.revision,
        updated.source ? JSON.stringify(updated.source) : null,
        updated.id,
      ],
    })
    return { item: updated, prior, replayed: false }
  }

  /**
   * Take back one study-item write.
   *
   * Undoing a creation removes the block. Undoing an update restores the
   * version immediately before it. Both refuse when the block has moved on
   * since — `expectedRevision` is what the caller believes it is undoing, and a
   * mismatch means someone edited the block in the meantime. Silently
   * discarding that edit would make Undo destructive, which is the one thing it
   * must never be.
   */
  undoStudyItem(itemId: string, expectedRevision: number, now: string): StudyItem | undefined {
    return this.db.transaction('IMMEDIATE', () => {
      const existing = this.#studyItemRow(itemId)
      if (!existing) {
        throw new OwnershipError(
          'That study block no longer exists.',
          `undo of unknown item ${itemId}`,
        )
      }
      const current = studyItemFromRow(existing)
      if (current.revision !== expectedRevision) {
        throw new OwnershipError(
          'This block changed after that action, so undoing it would discard newer work.',
          `undo expected revision ${expectedRevision}, found ${current.revision}`,
        )
      }
      if (current.revision === 1) {
        this.db.exec({ sql: 'DELETE FROM study_items WHERE id = ?', bind: [itemId] })
        return undefined
      }
      const previousRevision = current.revision - 1
      const version = this.db.selectObject(
        `SELECT source_range_json, kind, payload_json, sort_order, updated_at, source_json
         FROM study_item_versions WHERE item_id = ? AND revision = ?`,
        [itemId, previousRevision],
      )
      if (!version) {
        throw new OwnershipError(
          'The previous version of this block is no longer available.',
          `missing version ${previousRevision} of ${itemId}`,
        )
      }
      this.db.exec({
        sql: `UPDATE study_items SET
                source_range_json = ?, kind = ?, payload_json = ?, sort_order = ?,
                updated_at = ?, revision = ?, source_json = ?
              WHERE id = ?`,
        bind: [
          version.source_range_json,
          version.kind,
          version.payload_json,
          version.sort_order,
          now,
          previousRevision,
          version.source_json,
          itemId,
        ],
      })
      this.db.exec({
        sql: 'DELETE FROM study_item_versions WHERE item_id = ? AND revision = ?',
        bind: [itemId, previousRevision],
      })
      return studyItemFromRow(this.#studyItemRow(itemId)!)
    })
  }

  deleteStudyItem(itemId: string): void {
    this.db.exec({ sql: 'DELETE FROM study_items WHERE id = ?', bind: [itemId] })
  }

  listStudyItems(boardId: string): readonly StudyItem[] {
    const rows = this.db.selectObjects(
      `SELECT id, board_id, source_range_json, source_json, payload_json, sort_order, created_at, updated_at,
              origin, action_group_id, revision
       FROM study_items WHERE board_id = ? ORDER BY sort_order ASC, created_at ASC`,
      [boardId],
    )
    return rows.map(studyItemFromRow)
  }

  nextStudyItemOrder(boardId: string): number {
    return (
      Number(
        this.db.selectValue('SELECT max(sort_order) FROM study_items WHERE board_id = ?', [
          boardId,
        ]) ?? -1,
      ) + 1
    )
  }

  getIndexState(bookId: string): IndexState | null {
    const row = this.db.selectObject('SELECT * FROM index_meta WHERE book_id = ?', [bookId])
    if (!row) return null
    return this.#indexStateFromRow(row)
  }

  beginIndex(bookId: string, sectionsTotal: number, now: string): IndexState {
    return this.db.transaction('IMMEDIATE', () => {
      const current = this.getIndexState(bookId)
      const versionsMatch =
        current?.extractionVersion === SOURCE_EXTRACTION_VERSION &&
        current.chunkVersion === INDEX_CHUNK_VERSION &&
        current.tokenizerVersion === INDEX_TOKENIZER_VERSION
      if (current && versionsMatch && current.status === 'complete') return current
      if (current && versionsMatch) {
        const epoch = current.epoch + 1
        this.db.exec({
          sql: `UPDATE index_meta SET status = 'partial', completed = 0,
                  failure_message = NULL, sections_total = ?, index_epoch = ?,
                  updated_at = ? WHERE book_id = ?`,
          bind: [sectionsTotal, epoch, now, bookId],
        })
        return this.getIndexState(bookId)!
      }

      const epoch = (current?.epoch ?? 0) + 1
      this.db.exec({ sql: 'DELETE FROM vector_batches WHERE book_id = ?', bind: [bookId] })
      this.db.exec({ sql: 'DELETE FROM chunks WHERE book_id = ?', bind: [bookId] })
      this.db.exec({
        sql: `INSERT INTO index_meta (
                book_id, schema_version, tokenizer_version, index_epoch,
                next_chunk_order, completed, status, extraction_version,
                chunk_version, next_section_index, next_section_chunk,
                sections_indexed, sections_total, failure_message, updated_at
              ) VALUES (?, 4, ?, ?, 0, 0, 'partial', ?, ?, 0, 0, 0, ?, NULL, ?)
              ON CONFLICT(book_id) DO UPDATE SET
                schema_version = 4, tokenizer_version = excluded.tokenizer_version,
                index_epoch = excluded.index_epoch, next_chunk_order = 0,
                completed = 0, status = 'partial',
                extraction_version = excluded.extraction_version,
                chunk_version = excluded.chunk_version, next_section_index = 0,
                next_section_chunk = 0, sections_indexed = 0,
                sections_total = excluded.sections_total, failure_message = NULL,
                updated_at = excluded.updated_at`,
        bind: [bookId, INDEX_TOKENIZER_VERSION, epoch, SOURCE_EXTRACTION_VERSION, INDEX_CHUNK_VERSION, sectionsTotal, now],
      })
      return this.getIndexState(bookId)!
    })
  }

  commitIndexBatch(
    bookId: string,
    epoch: number,
    expected: IndexState['cursor'],
    chunks: readonly IndexChunk[],
    next: IndexState['cursor'],
    sectionsIndexed: number,
    now: string,
  ): IndexState {
    if (chunks.length > 250) throw new Error('An index batch may contain at most 250 chunks.')
    return this.db.transaction('IMMEDIATE', () => {
      const state = this.getIndexState(bookId)
      if (!state || state.epoch !== epoch) throw new Error('That indexing work is stale. Retry from current index state.')
      if (
        state.cursor.sectionIndex !== expected.sectionIndex ||
        state.cursor.sectionChunkIndex !== expected.sectionChunkIndex ||
        state.cursor.globalOrder !== expected.globalOrder
      ) throw new Error('That indexing cursor is stale. Retry from current index state.')
      const advancesSection = next.sectionIndex === expected.sectionIndex + 1 && next.sectionChunkIndex === 0
      const staysInSection =
        chunks.length > 0 &&
        next.sectionIndex === expected.sectionIndex &&
        next.sectionChunkIndex === expected.sectionChunkIndex + chunks.length
      if (
        next.globalOrder !== expected.globalOrder + chunks.length ||
        (!advancesSection && !staysInSection) ||
        next.sectionIndex > state.sectionsTotal ||
        sectionsIndexed !== next.sectionIndex
      ) throw new Error('That index batch does not advance the committed cursor exactly.')

      const sourceSectionIndex = chunks[0]?.sectionIndex
      chunks.forEach((chunk, index) => {
        if (
          chunk.bookId !== bookId ||
          chunk.sectionIndex !== sourceSectionIndex ||
          chunk.range.sectionIndex !== sourceSectionIndex ||
          chunk.sectionChunkIndex !== expected.sectionChunkIndex + index ||
          chunk.globalOrder !== expected.globalOrder + index ||
          chunk.text.length < 1 ||
          chunk.text.length > SEARCH_RESULT_MAX_CHARACTERS
        ) throw new Error('That index batch contains a chunk outside its exact cursor.')
      })

      const statement = this.db.prepare(`INSERT INTO chunks (
          id, book_id, section_index, title_breadcrumb_json, start_cfi, end_cfi,
          sort_order, text, text_hash, index_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      try {
        for (const chunk of chunks) {
          this.indexHooks.beforeIndexChunk?.(chunk)
          statement.bind([
            chunk.id, bookId, chunk.sectionIndex, JSON.stringify([chunk.sectionTitle]),
            chunk.range.startCfi, chunk.range.endCfi, chunk.globalOrder,
            chunk.text, chunk.range.textFingerprint,
            SOURCE_EXTRACTION_VERSION * 1_000_000 + INDEX_CHUNK_VERSION * 1_000 + INDEX_TOKENIZER_VERSION,
          ]).step()
          statement.reset()
        }
      } finally { finalize(statement) }
      this.db.exec({
        sql: `UPDATE index_meta SET next_section_index = ?, next_section_chunk = ?,
                next_chunk_order = ?, sections_indexed = ?, status = 'partial',
                completed = 0, failure_message = NULL, updated_at = ?
              WHERE book_id = ? AND index_epoch = ?`,
        bind: [next.sectionIndex, next.sectionChunkIndex, next.globalOrder, sectionsIndexed, now, bookId, epoch],
      })
      return this.getIndexState(bookId)!
    })
  }

  completeIndex(bookId: string, epoch: number, now: string): IndexState {
    const current = this.getIndexState(bookId)
    if (!current || current.epoch !== epoch) throw new Error('That indexing work is stale.')
    if (current.cursor.sectionIndex !== current.sectionsTotal || current.cursor.sectionChunkIndex !== 0) {
      throw new Error('The book index cannot complete before every section cursor is committed.')
    }
    this.db.exec({
      sql: `UPDATE index_meta SET status = 'complete', completed = 1,
              failure_message = NULL, sections_indexed = sections_total, updated_at = ?
            WHERE book_id = ? AND index_epoch = ?`,
      bind: [now, bookId, epoch],
    })
    const state = this.getIndexState(bookId)
    if (!state || state.epoch !== epoch || state.status !== 'complete') throw new Error('That indexing work is stale.')
    return state
  }

  failIndex(bookId: string, epoch: number, message: string, now: string): IndexState {
    this.db.exec({
      sql: `UPDATE index_meta SET status = 'failed', completed = 0,
              failure_message = ?, updated_at = ? WHERE book_id = ? AND index_epoch = ?`,
      bind: [message.slice(0, 500), now, bookId, epoch],
    })
    const state = this.getIndexState(bookId)
    if (!state || state.epoch !== epoch) throw new Error('That indexing work is stale.')
    return state
  }

  cancelIndex(bookId: string, epoch: number, now: string): IndexState {
    this.db.exec({
      sql: `UPDATE index_meta SET status = 'partial', completed = 0,
              failure_message = NULL, updated_at = ? WHERE book_id = ? AND index_epoch = ?`,
      bind: [now, bookId, epoch],
    })
    const state = this.getIndexState(bookId)
    if (!state || state.epoch !== epoch) throw new Error('That indexing work is stale.')
    return state
  }

  searchBook(bookId: string, rawQuery: string, limit: number): SearchResult {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('Search limit must be from 1 to 10.')
    const { query, fts } = normalizeSearchQuery(rawQuery)
    const state = this.getIndexState(bookId)
    const availability = searchAvailability(state)
    if (availability === 'unavailable') return { query, availability, outcome: 'no-results', hits: [] }
    const rows = this.db.selectObjects(
      `SELECT c.id, c.book_id, c.section_index, c.title_breadcrumb_json,
              c.start_cfi, c.end_cfi, c.sort_order, c.text, c.text_hash,
              bm25(chunks_fts) AS score
       FROM chunks_fts JOIN chunks c ON c.rowid = chunks_fts.rowid
       WHERE chunks_fts MATCH ? AND c.book_id = ?
       ORDER BY score ASC, c.sort_order ASC, c.id ASC LIMIT ?`,
      [fts, bookId, limit],
    )
    const hits: SearchHit[] = rows.map((row) => ({
      id: asString(row.id, 'chunk id'),
      bookId: asString(row.book_id, 'chunk book id'),
      sectionIndex: Number(row.section_index),
      sectionTitle: parseJson<string[]>(row.title_breadcrumb_json, 'chunk title')[0] ?? 'Untitled section',
      text: asString(row.text, 'chunk text').slice(0, SEARCH_RESULT_MAX_CHARACTERS),
      startCfi: asString(row.start_cfi, 'chunk start CFI'),
      endCfi: asString(row.end_cfi, 'chunk end CFI'),
      textFingerprint: asString(row.text_hash, 'chunk fingerprint'),
    }))
    return { query, availability, outcome: hits.length ? 'results' : 'no-results', hits }
  }

  #indexStateFromRow(row: Row): IndexState {
    const bookId = asString(row.book_id, 'index book id')
    const committedChunks = Number(this.db.selectValue('SELECT count(*) FROM chunks WHERE book_id = ?', [bookId]) ?? 0)
    return {
      bookId,
      status: asString(row.status, 'index status') as IndexState['status'],
      epoch: Number(row.index_epoch),
      extractionVersion: Number(row.extraction_version),
      chunkVersion: Number(row.chunk_version),
      tokenizerVersion: Number(row.tokenizer_version),
      cursor: {
        sectionIndex: Number(row.next_section_index),
        sectionChunkIndex: Number(row.next_section_chunk),
        globalOrder: Number(row.next_chunk_order),
      },
      sectionsIndexed: Number(row.sections_indexed),
      sectionsTotal: Number(row.sections_total),
      committedChunks,
      ...(row.failure_message === null ? {} : { failure: asString(row.failure_message, 'index failure') }),
      updatedAt: asString(row.updated_at, 'index timestamp'),
    }
  }

}

function boardFromRow(row: Row): StudyBoard {
  return {
    id: asString(row.id, 'board id'),
    bookId: asString(row.book_id, 'board book id'),
    title: asString(row.title, 'board title'),
    view: asString(row.layout_mode, 'board view') as StudyBoardView,
    createdAt: asString(row.created_at, 'board created time'),
    updatedAt: asString(row.updated_at, 'board updated time'),
  }
}

function sourceJson(item: StudyItem): string | null {
  return item.sourceRange
    ? JSON.stringify({ range: item.sourceRange, label: item.sourceLabel ?? null })
    : null
}

/**
 * Note what is absent: `update_token` is never read into a `StudyItem`. It only
 * ever travels outward once, in the receipt for the create that minted it, so
 * possession of it is evidence of authorship rather than of having read a list.
 */
function studyItemFromRow(row: Row): StudyItem {
  const source =
    row.source_range_json === null || row.source_range_json === undefined
      ? undefined
      : parseJson<{ range: BookRange; label: string | null }>(
          row.source_range_json,
          'study item source',
        )
  const payload = parseJson<StudyItemPayload>(row.payload_json, 'study item payload')
  const sourceLink: SourceLink | undefined = source
    ? row.source_json === null || row.source_json === undefined
      ? {
          status: 'pending-legacy',
          ownership:
            payload.kind === 'quotation' &&
            fingerprintText(payload.text) === source.range.textFingerprint
              ? 'derived'
              : 'authored',
        }
      : parseJson<SourceLink>(row.source_json, 'study item canonical source')
    : undefined
  return {
    id: asString(row.id, 'study item id'),
    boardId: asString(row.board_id, 'study item board id'),
    origin: asString(row.origin, 'study item origin') as StudyItem['origin'],
    ...(row.action_group_id === null || row.action_group_id === undefined
      ? {}
      : { actionGroupId: asString(row.action_group_id, 'study item action group') }),
    revision: Number(row.revision ?? 1),
    payload,
    ...(source ? { sourceRange: source.range } : {}),
    ...(source?.label ? { sourceLabel: source.label } : {}),
    ...(sourceLink ? { source: sourceLink } : {}),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: asString(row.created_at, 'study item created time'),
    updatedAt: asString(row.updated_at, 'study item updated time'),
  }
}
