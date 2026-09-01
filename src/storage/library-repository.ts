import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'

import type {
  BookCatalogEntry,
  BookMetadata,
  BookProvenance,
  ImportBookInput,
  ReadingState,
  StoredBook,
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
}
