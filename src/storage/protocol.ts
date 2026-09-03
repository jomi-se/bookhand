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

/** The largest section markup or stylesheet that may be saved. */
export const SECTION_REWRITE_MAX_CHARACTERS = 1_500_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown, maximum = 10_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function isNonBlankString(value: unknown, maximum = 10_000): value is string {
  return isString(value, maximum) && value.trim().length > 0
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

function isStudyExperience(value: unknown): boolean {
  const blocks = isRecord(value) && Array.isArray(value.blocks) ? value.blocks : []
  return (
    isRecord(value) &&
    isString(value.id, 200) &&
    isString(value.boardId, 256) &&
    ORIGINS.includes(String(value.origin)) &&
    isString(value.actionGroupId, 200) &&
    Number.isInteger(value.revision) &&
    isNonBlankString(value.title, 500) &&
    blocks.length >= 1 &&
    blocks.length <= 12 &&
    blocks.every(
      (block) => isRecord(block) && isNonBlankString(block.id, 200) && isStudyPayload(block.payload),
    ) &&
    new Set(blocks.map((block) => (isRecord(block) ? block.id : undefined))).size === blocks.length &&
    (value.sourceRange === undefined || isBookRange(value.sourceRange)) &&
    (value.source === undefined || isSourceLink(value.source)) &&
    isOptionalString(value.sourceLabel) &&
    Number.isInteger(value.sortOrder) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isStudyExperienceMutation(value: unknown): boolean {
  return (
    isRecord(value) &&
    ORIGINS.includes(String(value.origin)) &&
    isString(value.bookId, 256) &&
    isString(value.actionToken, 200) &&
    isString(value.actionGroupId, 200)
  )
}

function isStudyExperienceCommit(value: unknown): boolean {
  return isRecord(value) && isStudyExperience(value.experience) && typeof value.replayed === 'boolean'
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

function isCursor(value: unknown): boolean {
  return isRecord(value) && Number.isInteger(value.sectionIndex) && Number(value.sectionIndex) >= 0 && Number.isInteger(value.sectionChunkIndex) && Number(value.sectionChunkIndex) >= 0 && Number.isInteger(value.globalOrder) && Number(value.globalOrder) >= 0
}

function isIndexState(value: unknown): boolean {
  return isRecord(value) && isString(value.bookId, 256) && ['partial', 'failed', 'complete'].includes(String(value.status)) && Number.isInteger(value.epoch) && isCursor(value.cursor) && Number.isInteger(value.committedChunks) && isString(value.updatedAt) && (value.failure === undefined || isString(value.failure, 500))
}

function isIndexChunk(value: unknown): boolean {
  return isRecord(value) && isString(value.id, 256) && isString(value.bookId, 256) && Number.isInteger(value.sectionIndex) && Number(value.sectionIndex) >= 0 && Number.isInteger(value.sectionChunkIndex) && Number(value.sectionChunkIndex) >= 0 && Number.isInteger(value.globalOrder) && Number(value.globalOrder) >= 0 && isString(value.sectionTitle, 1000) && isString(value.text, 1_200) && value.text.length > 0 && isBookRange(value.range)
}

function isSearchResult(value: unknown): boolean {
  return isRecord(value) && isString(value.query, 300) && ['unavailable', 'partial', 'ready'].includes(String(value.availability)) && ['results', 'no-results'].includes(String(value.outcome)) && Array.isArray(value.hits) && value.hits.length <= 10 && value.hits.every((hit) => isRecord(hit) && isString(hit.id, 256) && isString(hit.bookId, 256) && Number.isInteger(hit.sectionIndex) && isString(hit.sectionTitle, 1000) && isString(hit.text, 1200) && isString(hit.startCfi) && isString(hit.endCfi) && isString(hit.textFingerprint, 200))
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
    case 'get-index-state':
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
    case 'commit-study-experience':
      if (isStudyExperience(value.experience) && isStudyExperienceMutation(value.mutation)) return
      break
    case 'delete-study-experience':
      if (isString(value.experienceId, 200) && isString(value.boardId, 256)) return
      break
    case 'list-study-experiences':
      if (isString(value.boardId, 256)) return
      break
    case 'begin-index':
      if (isString(value.bookId, 256) && Number.isInteger(value.sectionsTotal) && Number(value.sectionsTotal) >= 0) return
      break
    case 'commit-index-batch':
      if (isString(value.bookId, 256) && Number.isInteger(value.epoch) && isCursor(value.expected) && isCursor(value.next) && Number.isInteger(value.sectionsIndexed) && Array.isArray(value.chunks) && value.chunks.length <= 250 && value.chunks.every(isIndexChunk)) return
      break
    case 'complete-index':
    case 'cancel-index':
      if (isString(value.bookId, 256) && Number.isInteger(value.epoch)) return
      break
    case 'fail-index':
      if (isString(value.bookId, 256) && Number.isInteger(value.epoch) && isString(value.message, 500)) return
      break
    case 'search-book':
      if (isString(value.bookId, 256) && isString(value.query, 300) && Number.isInteger(value.limit) && Number(value.limit) >= 1 && Number(value.limit) <= 10) return
      break
    case 'list-section-rewrites':
      if (isString(value.bookId, 256)) return
      break
    case 'append-section-rewrite':
      if (
        isString(value.bookId, 256) &&
        isSectionIndex(value.sectionIndex) &&
        isRewriteVersion(value.version)
      ) {
        return
      }
      break
    case 'undo-section-rewrite':
    case 'clear-section-rewrites':
      if (isString(value.bookId, 256) && isSectionIndex(value.sectionIndex)) return
      break
  }
  throw new TypeError(`Invalid storage worker request: ${String(value.type)}`)
}

/** A section index is a position in the spine, not an arbitrary number. */
function isSectionIndex(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 10_000
}

/**
 * A revision crossing the worker boundary.
 *
 * The markup was sanitized before it was ever offered for saving, but this
 * boundary re-checks shape and size anyway: the worker owns the database, and
 * what reaches it is the last place a malformed record can be refused.
 */
function isRewriteVersion(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (
    typeof value.html !== 'string' ||
    value.html.length === 0 ||
    value.html.length > SECTION_REWRITE_MAX_CHARACTERS
  ) {
    return false
  }
  if (
    value.css !== undefined &&
    (typeof value.css !== 'string' || value.css.length > SECTION_REWRITE_MAX_CHARACTERS)
  ) {
    return false
  }
  if (value.summary !== undefined && (typeof value.summary !== 'string' || value.summary.length > 240)) {
    return false
  }
  return isStorableTimestamp(value.at)
}

/**
 * A timestamp the repository can actually write.
 *
 * The repository stores it as `new Date(at).toISOString()`, and that throws a
 * `RangeError` outside ±8.64e15 milliseconds — so "finite" is not the same
 * question as "storable". Checking the weaker one here would move the failure
 * into the middle of a write, where it is a broken transaction rather than a
 * refused message.
 */
function isStorableTimestamp(value: unknown): value is number {
  if (!isFiniteNumber(value) || !Number.isInteger(value)) return false
  try {
    new Date(value).toISOString()
    return true
  } catch {
    return false
  }
}

function isStoredSectionRewrite(value: unknown): boolean {
  if (!isRecord(value) || !isSectionIndex(value.sectionIndex)) return false
  return Array.isArray(value.versions) && value.versions.every(isRewriteVersion)
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
    case 'study-experience-committed':
      if (isStudyExperienceCommit(result.commit)) return
      break
    case 'study-experience-deleted':
      if (isString(result.experienceId, 200)) return
      break
    case 'study-experiences':
      if (Array.isArray(result.experiences) && result.experiences.every(isStudyExperience)) return
      break
    case 'index-state':
      if (result.state === null || isIndexState(result.state)) return
      break
    case 'search-results':
      if (isSearchResult(result.result)) return
      break
    case 'section-rewrites':
      if (Array.isArray(result.rewrites) && result.rewrites.every(isStoredSectionRewrite)) return
      break
    case 'section-rewrite-written':
      if (
        isSectionIndex(result.sectionIndex) &&
        Number.isInteger(result.versions) &&
        Number(result.versions) >= 0
      ) return
      break
  }
  throw new TypeError(`Invalid storage worker result: ${String(result.type)}`)
}
