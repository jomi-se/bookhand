import type {
  BookMetadata,
  BookProvenance,
  ImportBookInput,
  ReaderLocation,
  ReaderStyle,
  ReadingState,
  StorageDiagnostics,
  StorageWorkerRequest,
  StorageWorkerResponse,
  StoredBook,
} from '../domain/index.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown, maximum = 10_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMetadata(value: unknown): value is BookMetadata {
  if (!isRecord(value) || !isString(value.title) || !Array.isArray(value.authors)) {
    return false
  }
  if (
    !isOptionalString(value.subtitle) ||
    !isOptionalString(value.language) ||
    !isOptionalString(value.publisher) ||
    !isOptionalString(value.description) ||
    !isOptionalString(value.published) ||
    !isOptionalString(value.modified) ||
    !isOptionalString(value.identifier)
  ) {
    return false
  }
  if (
    !value.authors.every(
      (author) =>
        isRecord(author) && isString(author.name) && isOptionalString(author.sortAs),
    )
  ) {
    return false
  }
  return (
    value.cover === undefined ||
    (isRecord(value.cover) &&
      isString(value.cover.mediaType) &&
      value.cover.bytes instanceof Uint8Array)
  )
}

function isProvenance(value: unknown): value is BookProvenance {
  if (!isRecord(value)) return false
  if (value.kind === 'imported') return isString(value.originalFileName, 1_000)
  return (
    value.kind === 'bundled' &&
    isString(value.sourceUrl) &&
    isString(value.retrievedAt) &&
    typeof value.removeAfterJudging === 'boolean'
  )
}

function isImportBook(value: unknown): value is ImportBookInput {
  return (
    isRecord(value) &&
    isMetadata(value.metadata) &&
    value.epubBytes instanceof Uint8Array &&
    value.epubBytes.byteLength > 0 &&
    value.epubBytes.byteLength <= 1_073_741_824 &&
    isString(value.importedAt) &&
    isProvenance(value.provenance)
  )
}

function isLocation(value: unknown): value is ReaderLocation {
  return (
    isRecord(value) &&
    isString(value.cfi) &&
    Number.isInteger(value.sectionIndex) &&
    isFiniteNumber(value.fraction) &&
    value.fraction >= 0 &&
    value.fraction <= 1 &&
    isOptionalString(value.chapterLabel) &&
    isOptionalString(value.textFingerprint)
  )
}

function isStyle(value: unknown): value is ReaderStyle {
  return (
    isRecord(value) &&
    isOptionalString(value.fontFamily) &&
    isFiniteNumber(value.fontSizePercent) &&
    isFiniteNumber(value.lineHeight) &&
    isFiniteNumber(value.measureCh) &&
    isFiniteNumber(value.paragraphSpacingEm) &&
    ['publisher', 'light', 'sepia', 'dark'].includes(String(value.theme)) &&
    isOptionalString(value.customCss)
  )
}

function isReadingState(value: unknown): value is ReadingState {
  return (
    isRecord(value) &&
    isString(value.bookId) &&
    isLocation(value.location) &&
    isStyle(value.style) &&
    isString(value.updatedAt)
  )
}

function isStoredBook(value: unknown): value is StoredBook {
  return (
    isRecord(value) &&
    isString(value.id, 256) &&
    isMetadata(value.metadata) &&
    value.epubBytes instanceof Uint8Array &&
    isString(value.importedAt) &&
    isProvenance(value.provenance)
  )
}

function isCatalogEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id, 256) &&
    isMetadata(value.metadata) &&
    isString(value.importedAt) &&
    isProvenance(value.provenance) &&
    (value.readingState === undefined || isReadingState(value.readingState))
  )
}

function isDiagnostics(value: unknown): value is StorageDiagnostics {
  return (
    isRecord(value) &&
    ['persistent', 'session-only', 'locked'].includes(String(value.mode)) &&
    isString(value.sqliteVersion, 100) &&
    isString(value.vfsName, 200) &&
    Number.isInteger(value.schemaVersion) &&
    value.connectionOwner === 'dedicated-worker' &&
    Number.isInteger(value.bookCount) &&
    Number(value.bookCount) >= 0
  )
}

export function assertStorageWorkerRequest(value: unknown): asserts value is StorageWorkerRequest {
  if (!isRecord(value) || !isString(value.requestId, 200) || !isString(value.type, 100)) {
    throw new TypeError('Invalid storage worker request envelope')
  }
  switch (value.type) {
    case 'initialize':
    case 'list-books':
    case 'get-diagnostics':
    case 'retry-persistence':
    case 'claim-persistence-request':
    case 'close':
      return
    case 'get-book':
    case 'get-reading-state':
      if (isString(value.bookId, 256)) return
      break
    case 'import-book':
      if (isImportBook(value.book)) return
      break
    case 'put-reading-state':
      if (isReadingState(value.state)) return
      break
  }
  throw new TypeError(`Invalid storage worker request: ${String(value.type)}`)
}

export function assertStorageWorkerResponse(
  value: unknown,
): asserts value is StorageWorkerResponse {
  if (!isRecord(value) || !isString(value.requestId, 200) || typeof value.ok !== 'boolean') {
    throw new TypeError('Invalid storage worker response envelope')
  }
  if (!value.ok) {
    if (
      isRecord(value.error) &&
      isString(value.error.code, 200) &&
      isString(value.error.message) &&
      typeof value.error.retryable === 'boolean'
    ) {
      return
    }
    throw new TypeError('Invalid storage worker error response')
  }
  if (!isRecord(value.result) || !isString(value.result.type, 100)) {
    throw new TypeError('Invalid storage worker result envelope')
  }
  const result = value.result
  switch (result.type) {
    case 'initialized':
    case 'diagnostics':
      if (isDiagnostics(result.diagnostics)) return
      break
    case 'book-written':
    case 'reading-state-written':
      if (isString(result.bookId, 256)) return
      break
    case 'book':
      if (result.book === null || isStoredBook(result.book)) return
      break
    case 'book-list':
      if (Array.isArray(result.books) && result.books.every(isCatalogEntry)) return
      break
    case 'reading-state':
      if (result.state === null || isReadingState(result.state)) return
      break
    case 'persistence-request-claimed':
      if (typeof result.claimed === 'boolean') return
      break
    case 'closed':
      return
  }
  throw new TypeError(`Invalid storage worker result: ${String(result.type)}`)
}
