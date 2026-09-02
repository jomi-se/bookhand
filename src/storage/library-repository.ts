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
  StudyItemPayload,
} from '../domain/index.ts'

type Row = Record<string, SqlValue>

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

  constructor(db: Database) {
    this.db = db
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
        id, book_id, range_json, quote, color, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        range_json = excluded.range_json,
        quote = excluded.quote,
        color = excluded.color,
        note = excluded.note,
        updated_at = excluded.updated_at
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
        ])
        .step()
    } finally {
      finalize(statement)
    }
    return annotation
  }

  deleteAnnotation(annotationId: string): void {
    this.db.exec({ sql: 'DELETE FROM annotations WHERE id = ?', bind: [annotationId] })
  }

  listAnnotations(bookId: string): readonly Annotation[] {
    const rows = this.db.selectObjects(
      `SELECT id, book_id, range_json, quote, color, note, created_at, updated_at
       FROM annotations WHERE book_id = ? ORDER BY created_at ASC`,
      [bookId],
    )
    return rows.map((row) => ({
      id: asString(row.id, 'annotation id'),
      bookId: asString(row.book_id, 'annotation book id'),
      range: parseJson<BookRange>(row.range_json, 'annotation range'),
      quote: asString(row.quote, 'annotation quote'),
      color: asString(row.color, 'annotation color') as Annotation['color'],
      ...(row.note === null ? {} : { note: asString(row.note, 'annotation note') }),
      createdAt: asString(row.created_at, 'annotation created time'),
      updatedAt: asString(row.updated_at, 'annotation updated time'),
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

  upsertStudyItem(item: StudyItem): StudyItem {
    const statement = this.db.prepare(`
      INSERT INTO study_items (
        id, board_id, source_range_json, kind, payload_json, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_range_json = excluded.source_range_json,
        kind = excluded.kind,
        payload_json = excluded.payload_json,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
      WHERE study_items.board_id = excluded.board_id
    `)
    try {
      statement
        .bind([
          item.id,
          item.boardId,
          item.sourceRange
            ? JSON.stringify({ range: item.sourceRange, label: item.sourceLabel ?? null })
            : null,
          item.payload.kind,
          JSON.stringify(item.payload),
          item.sortOrder,
          item.createdAt,
          item.updatedAt,
        ])
        .step()
      if (Number(this.db.changes()) !== 1) {
        throw new Error('That study item belongs to another book')
      }
    } finally {
      finalize(statement)
    }
    return item
  }

  deleteStudyItem(itemId: string): void {
    this.db.exec({ sql: 'DELETE FROM study_items WHERE id = ?', bind: [itemId] })
  }

  listStudyItems(boardId: string): readonly StudyItem[] {
    const rows = this.db.selectObjects(
      `SELECT id, board_id, source_range_json, payload_json, sort_order, created_at, updated_at
       FROM study_items WHERE board_id = ? ORDER BY sort_order ASC, created_at ASC`,
      [boardId],
    )
    return rows.map((row) => {
      const source =
        row.source_range_json === null
          ? undefined
          : parseJson<{ range: BookRange; label: string | null }>(
              row.source_range_json,
              'study item source',
            )
      return {
        id: asString(row.id, 'study item id'),
        boardId: asString(row.board_id, 'study item board id'),
        payload: parseJson<StudyItemPayload>(row.payload_json, 'study item payload'),
        ...(source ? { sourceRange: source.range } : {}),
        ...(source?.label ? { sourceLabel: source.label } : {}),
        sortOrder: Number(row.sort_order ?? 0),
        createdAt: asString(row.created_at, 'study item created time'),
        updatedAt: asString(row.updated_at, 'study item updated time'),
      }
    })
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
