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
import {
  SOURCE_EXCERPT_MAX_CHARACTERS,
  SOURCE_SEGMENT_MAX_CHARACTERS,
  SOURCE_SEGMENT_MAX_COUNT,
} from '../domain/source.ts'

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

function isBookRange(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.startCfi) &&
    isString(value.endCfi) &&
    (value.cfi === undefined || isString(value.cfi)) &&
    Number.isInteger(value.sectionIndex) &&
    isString(value.textFingerprint, 200)
  )
}

function isSourceLink(value: unknown): boolean {
  if (!isRecord(value) || !['derived', 'authored'].includes(String(value.ownership))) {
    return false
  }
  if (value.status === 'pending-legacy') return true
  if (value.status === 'stale') {
    return ['range-unresolved', 'book-unavailable'].includes(String(value.reason))
  }
  if (value.status !== 'resolved' || !isRecord(value.excerpt)) return false
  const excerpt = value.excerpt
  return (
    excerpt.schemaVersion === 1 &&
    isString(excerpt.bookId, 256) &&
    isBookRange(excerpt.range) &&
    Number.isInteger(excerpt.extractionVersion) &&
    isString(excerpt.text, SOURCE_EXCERPT_MAX_CHARACTERS) &&
    isRecord(excerpt.range) &&
    excerpt.textFingerprint === excerpt.range.textFingerprint &&
    Array.isArray(excerpt.segments) &&
    excerpt.segments.length <= SOURCE_SEGMENT_MAX_COUNT &&
    excerpt.segments.every(
      (segment) =>
        isRecord(segment) &&
        ['text', 'math', 'figure'].includes(String(segment.kind)) &&
        isString(segment.text, SOURCE_SEGMENT_MAX_CHARACTERS),
    ) &&
    Array.isArray(excerpt.chapterBreadcrumb) &&
    excerpt.chapterBreadcrumb.length <= 100 &&
    excerpt.chapterBreadcrumb.every((part) => isString(part, 500))
  )
}

function isAnnotation(value: unknown): boolean {
  return (
    isRecord(value) &&
    ORIGINS.includes(String(value.origin)) &&
    (value.actionGroupId === undefined || isString(value.actionGroupId, 200)) &&
    isString(value.id, 200) &&
    isString(value.bookId, 256) &&
    isBookRange(value.range) &&
    isString(value.quote, 32_000) &&
    (value.source === undefined || isSourceLink(value.source)) &&
    ['accent', 'amber', 'sky', 'moss'].includes(String(value.color)) &&
    (value.note === undefined || isString(value.note, 20_000)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isStudyPayload(value: unknown): boolean {
  if (!isRecord(value)) return false
  switch (value.kind) {
    case 'prose':
      return isString(value.text, 32_000)
    case 'quotation':
      return isString(value.text, 32_000) && isOptionalString(value.attribution)
    case 'equation':
      return isString(value.expression, 5_000) && isOptionalString(value.caption)
    case 'steps':
      return (
        isOptionalString(value.title) &&
        Array.isArray(value.steps) &&
        value.steps.length <= 100 &&
        value.steps.every((step) => isString(step, 5_000))
      )
    case 'question':
      return isString(value.prompt, 20_000) && isOptionalString(value.answer)
    default:
      return false
  }
}

const ORIGINS = ['user', 'agent']

function isStudyItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id, 200) &&
    isString(value.boardId, 256) &&
    ORIGINS.includes(String(value.origin)) &&
    Number.isInteger(value.revision) &&
    (value.actionGroupId === undefined || isString(value.actionGroupId, 200)) &&
    isStudyPayload(value.payload) &&
    (value.sourceRange === undefined || isBookRange(value.sourceRange)) &&
    (value.source === undefined || isSourceLink(value.source)) &&
    isOptionalString(value.sourceLabel) &&
    Number.isInteger(value.sortOrder) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isStudyMutation(value: unknown): boolean {
  return (
    isRecord(value) &&
    ['create', 'update'].includes(String(value.operation)) &&
    ORIGINS.includes(String(value.origin)) &&
    isString(value.bookId, 256) &&
    isString(value.actionToken, 200) &&
    isString(value.actionGroupId, 200) &&
    (value.updateToken === undefined || isString(value.updateToken, 200))
  )
}

function isStudyItemCommit(value: unknown): boolean {
  return (
    isRecord(value) &&
    isStudyItem(value.item) &&
    (value.prior === undefined || isStudyItem(value.prior)) &&
    (value.updateToken === undefined || isString(value.updateToken, 200)) &&
    typeof value.replayed === 'boolean'
  )
}

function isBoard(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id, 256) &&
    isString(value.bookId, 256) &&
    isString(value.title, 500) &&
    ['docked', 'expanded'].includes(String(value.view)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
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
    case 'list-annotations':
    case 'get-board':
      if (isString(value.bookId, 256)) return
      break
    case 'save-annotation':
    case 'repair-annotation-source':
      if (isAnnotation(value.annotation)) return
      break
    case 'delete-annotation':
      if (isString(value.annotationId, 200)) return
      break
    case 'set-board-view':
      if (isString(value.boardId, 256) && ['docked', 'expanded'].includes(String(value.view))) {
        return
      }
      break
    case 'commit-study-item':
      if (isStudyItem(value.item) && isStudyMutation(value.mutation)) return
      break
    case 'repair-study-item-source':
      if (isStudyItem(value.item)) return
      break
    case 'undo-study-item':
      if (isString(value.itemId, 200) && Number.isInteger(value.expectedRevision)) return
      break
    case 'delete-study-item':
      if (isString(value.itemId, 200)) return
      break
    case 'list-study-items':
      if (isString(value.boardId, 256)) return
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
    case 'annotation-saved':
      if (isAnnotation(result.annotation)) return
      break
    case 'annotation-deleted':
      if (isString(result.annotationId, 200)) return
      break
    case 'annotations':
      if (Array.isArray(result.annotations) && result.annotations.every(isAnnotation)) return
      break
    case 'board':
      if (isBoard(result.board)) return
      break
    case 'study-item-committed':
      if (isStudyItemCommit(result.commit)) return
      break
    case 'study-item-repaired':
      if (isStudyItem(result.item)) return
      break
    case 'study-item-undone':
      if (result.item === null || isStudyItem(result.item)) return
      break
    case 'study-item-deleted':
      if (isString(result.itemId, 200)) return
      break
    case 'study-items':
      if (Array.isArray(result.items) && result.items.every(isStudyItem)) return
      break
  }
  throw new TypeError(`Invalid storage worker result: ${String(result.type)}`)
}
