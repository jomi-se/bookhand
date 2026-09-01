import type { Database } from '@sqlite.org/sqlite-wasm'

export const STORAGE_SCHEMA_VERSION = 1

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  metadata_json TEXT NOT NULL,
  cover_media_type TEXT,
  cover_blob BLOB,
  epub_blob BLOB NOT NULL,
  imported_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS reading_state (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  location_json TEXT NOT NULL,
  style_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  range_json TEXT NOT NULL,
  quote TEXT NOT NULL,
  color TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  layout_mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS study_items (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  source_range_json TEXT,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  section_index INTEGER NOT NULL,
  title_breadcrumb_json TEXT NOT NULL,
  start_cfi TEXT NOT NULL,
  end_cfi TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  text TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  index_version INTEGER NOT NULL
) STRICT;

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  content='chunks',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text)
  VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text)
  VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TABLE IF NOT EXISTS index_meta (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL,
  tokenizer_version INTEGER NOT NULL,
  index_epoch INTEGER NOT NULL,
  next_chunk_order INTEGER NOT NULL,
  completed INTEGER NOT NULL CHECK (completed IN (0, 1))
) STRICT;

CREATE TABLE IF NOT EXISTS vector_batches (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  first_chunk_order INTEGER NOT NULL,
  vector_count INTEGER NOT NULL,
  dimensions INTEGER NOT NULL,
  vectors_blob BLOB NOT NULL,
  PRIMARY KEY (book_id, model_id, first_chunk_order)
) STRICT;
`

export function initializeSchema(db: Database): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF;')
  db.transaction('IMMEDIATE', () => {
    db.exec(SCHEMA_SQL)
    db.exec(`PRAGMA user_version = ${STORAGE_SCHEMA_VERSION}`)
  })
}
