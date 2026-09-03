import type { Database } from '@sqlite.org/sqlite-wasm'

export const STORAGE_SCHEMA_VERSION = 6

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
  updated_at TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'agent')),
  action_group_id TEXT,
  source_json TEXT
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
  updated_at TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'agent')),
  -- Held only by whoever created the item. An agent proves authorship by
  -- presenting it; it is never listed back out.
  update_token TEXT,
  action_group_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  source_json TEXT
) STRICT;

-- Every superseded version of an item, so Undo of an update can restore the
-- immediately prior one rather than merely reverting to a remembered guess.
CREATE TABLE IF NOT EXISTS study_item_versions (
  item_id TEXT NOT NULL REFERENCES study_items(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  source_range_json TEXT,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  source_json TEXT,
  PRIMARY KEY (item_id, revision)
) STRICT;

CREATE TABLE IF NOT EXISTS study_experiences (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  blocks_json TEXT NOT NULL,
  source_range_json TEXT,
  source_label TEXT,
  source_json TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('user', 'agent')),
  action_group_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
) STRICT;

-- What a caller already did, so an identical retry returns the first result
-- instead of writing twice. Scoped to the book, the caller's origin, and the
-- caller's own action token; the digest catches a token reused for a different
-- intent.
CREATE TABLE IF NOT EXISTS action_receipts (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK (origin IN ('user', 'agent')),
  action_token TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, origin, action_token)
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
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('partial', 'failed', 'complete')),
  extraction_version INTEGER NOT NULL DEFAULT 0,
  chunk_version INTEGER NOT NULL DEFAULT 0,
  next_section_index INTEGER NOT NULL DEFAULT 0,
  next_section_chunk INTEGER NOT NULL DEFAULT 0,
  sections_indexed INTEGER NOT NULL DEFAULT 0,
  sections_total INTEGER NOT NULL DEFAULT 0,
  failure_message TEXT,
  updated_at TEXT NOT NULL DEFAULT ''
) STRICT;

CREATE TABLE IF NOT EXISTS section_rewrites (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  section_index INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  html TEXT NOT NULL,
  css TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, section_index, revision)
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

/**
 * Columns added after version 1 shipped. `CREATE TABLE IF NOT EXISTS` will not
 * touch a table that already exists, so a database created before provenance
 * needs these applied by hand. Each is written to be safe to skip if it is
 * already there, because the same database may be opened by a build that has
 * already migrated it.
 */
// Existing rows predate provenance. They were all written through the
// interface by the person sitting there, so `'user'` is the truthful default
// rather than a convenient one — no agent could have written them, because no
// agent path existed.
const VERSION_2_COLUMNS: readonly (readonly [string, string])[] = [
  ['annotations', "origin TEXT NOT NULL DEFAULT 'user'"],
  ['annotations', 'action_group_id TEXT'],
  ['study_items', "origin TEXT NOT NULL DEFAULT 'user'"],
  ['study_items', 'update_token TEXT'],
  ['study_items', 'action_group_id TEXT'],
  ['study_items', 'revision INTEGER NOT NULL DEFAULT 1'],
]

/** Canonical, versioned source excerpts. Null means a legacy record pending resolution. */
const VERSION_3_COLUMNS: readonly (readonly [string, string])[] = [
  ['annotations', 'source_json TEXT'],
  ['study_items', 'source_json TEXT'],
  ['study_item_versions', 'source_json TEXT'],
]

const VERSION_4_COLUMNS: readonly (readonly [string, string])[] = [
  ['index_meta', "status TEXT NOT NULL DEFAULT 'partial'"],
  ['index_meta', 'extraction_version INTEGER NOT NULL DEFAULT 0'],
  ['index_meta', 'chunk_version INTEGER NOT NULL DEFAULT 0'],
  ['index_meta', 'next_section_index INTEGER NOT NULL DEFAULT 0'],
  ['index_meta', 'next_section_chunk INTEGER NOT NULL DEFAULT 0'],
  ['index_meta', 'sections_indexed INTEGER NOT NULL DEFAULT 0'],
  ['index_meta', 'sections_total INTEGER NOT NULL DEFAULT 0'],
  ['index_meta', 'failure_message TEXT'],
  ['index_meta', "updated_at TEXT NOT NULL DEFAULT ''"],
]

/** Safe to run against a database a newer build has already migrated. */
function addMissingColumns(
  db: Database,
  columns: readonly (readonly [string, string])[],
): void {
  for (const [table, definition] of columns) {
    const column = definition.split(' ')[0]
    const present = db.selectValue(
      `SELECT count(*) FROM pragma_table_info(?) WHERE name = ?`,
      [table, column],
    )
    if (Number(present ?? 0) > 0) continue
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}

export function initializeSchema(db: Database): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF;')
  db.transaction('IMMEDIATE', () => {
    const from = Number(db.selectValue('PRAGMA user_version') ?? 0)
    if (from > STORAGE_SCHEMA_VERSION) {
      throw new Error(
        `This library uses schema version ${from}, newer than this build supports (${STORAGE_SCHEMA_VERSION}). Update Bookhand before opening it.`,
      )
    }
    db.exec(SCHEMA_SQL)
    if (from > 0 && from < 2) addMissingColumns(db, VERSION_2_COLUMNS)
    if (from > 0 && from < 3) addMissingColumns(db, VERSION_3_COLUMNS)
    if (from > 0 && from < 4) {
      addMissingColumns(db, VERSION_4_COLUMNS)
      // Retrieval before v4 had no trustworthy state/cursor contract. Clear
      // only derived retrieval data; books and learner-owned records remain.
      db.exec('DELETE FROM vector_batches; DELETE FROM chunks; DELETE FROM index_meta;')
    }
    // Version 5 adds `section_rewrites`, which `CREATE TABLE IF NOT EXISTS`
    // above already creates on any database. There is nothing to backfill: a
    // library from before this feature simply has no saved rewrites, which is
    // the truthful state, and the books it holds are untouched.
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS chunks_book_order ON chunks(book_id, sort_order);
             CREATE INDEX IF NOT EXISTS chunks_book_section ON chunks(book_id, section_index, sort_order);
             CREATE INDEX IF NOT EXISTS section_rewrites_book ON section_rewrites(book_id, section_index, revision);
             CREATE INDEX IF NOT EXISTS study_experiences_board_order ON study_experiences(board_id, sort_order, created_at);`)
    db.exec(`PRAGMA user_version = ${STORAGE_SCHEMA_VERSION}`)
  })
}
