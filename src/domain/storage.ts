import type {
  BookIdentifier,
  BookMetadata,
  ReaderLocation,
  ReaderStyle,
} from './reader.ts'
import type {
  Annotation,
  StudyBoard,
  StudyItem,
  StudyItemCommit,
  StudyBoardView,
  StudyMutation,
} from './study.ts'
import type { IndexChunk, IndexCursor, IndexState, SearchResult } from './search.ts'
import type { SectionRewriteVersion, StoredSectionRewrite } from './remaster.ts'

export type StorageMode = 'persistent' | 'session-only' | 'locked'

export interface BundledBookProvenance {
  readonly kind: 'bundled'
  readonly sourceUrl: string
  readonly retrievedAt: string
  readonly removeAfterJudging: boolean
}

export interface ImportedBookProvenance {
  readonly kind: 'imported'
  readonly originalFileName: string
}

export type BookProvenance = BundledBookProvenance | ImportedBookProvenance

export interface StoredBook {
  readonly id: BookIdentifier
  readonly metadata: BookMetadata
  readonly epubBytes: Uint8Array
  readonly importedAt: string
  readonly provenance: BookProvenance
}

export interface ImportBookInput {
  readonly metadata: BookMetadata
  readonly epubBytes: Uint8Array
  readonly importedAt: string
  readonly provenance: BookProvenance
}

export interface BookCatalogEntry {
  readonly id: BookIdentifier
  readonly metadata: BookMetadata
  readonly importedAt: string
  readonly provenance: BookProvenance
  readonly readingState?: ReadingState
}

export interface ReadingState {
  readonly bookId: BookIdentifier
  readonly location: ReaderLocation
  readonly style: ReaderStyle
  readonly updatedAt: string
}

export interface StorageDiagnostics {
  readonly mode: StorageMode
  readonly sqliteVersion: string
  readonly vfsName: string
  readonly schemaVersion: number
  readonly connectionOwner: 'dedicated-worker'
  readonly bookCount: number
}

export type StorageWorkerRequest =
  | { readonly requestId: string; readonly type: 'initialize' }
  | {
      readonly requestId: string
      readonly type: 'import-book'
      readonly book: ImportBookInput
    }
  | { readonly requestId: string; readonly type: 'get-book'; readonly bookId: string }
  | { readonly requestId: string; readonly type: 'list-books' }
  | {
      readonly requestId: string
      readonly type: 'put-reading-state'
      readonly state: ReadingState
    }
  | {
      readonly requestId: string
      readonly type: 'get-reading-state'
      readonly bookId: string
    }
  | { readonly requestId: string; readonly type: 'get-diagnostics' }
  | { readonly requestId: string; readonly type: 'retry-persistence' }
  | { readonly requestId: string; readonly type: 'claim-persistence-request' }
  | { readonly requestId: string; readonly type: 'close' }
  | {
      readonly requestId: string
      readonly type: 'save-annotation'
      readonly annotation: Annotation
    }
  | {
      readonly requestId: string
      readonly type: 'repair-annotation-source'
      readonly annotation: Annotation
    }
  | {
      readonly requestId: string
      readonly type: 'delete-annotation'
      readonly annotationId: string
    }
  | { readonly requestId: string; readonly type: 'list-annotations'; readonly bookId: string }
  | { readonly requestId: string; readonly type: 'get-board'; readonly bookId: string }
  | {
      readonly requestId: string
      readonly type: 'set-board-view'
      readonly boardId: string
      readonly view: StudyBoardView
    }
  | {
      readonly requestId: string
      readonly type: 'commit-study-item'
      readonly item: StudyItem
      readonly mutation: StudyMutation
    }
  | {
      readonly requestId: string
      readonly type: 'repair-study-item-source'
      readonly item: StudyItem
    }
  | {
      readonly requestId: string
      readonly type: 'undo-study-item'
      readonly itemId: string
      readonly expectedRevision: number
    }
  | { readonly requestId: string; readonly type: 'delete-study-item'; readonly itemId: string }
  | { readonly requestId: string; readonly type: 'list-study-items'; readonly boardId: string }
  | { readonly requestId: string; readonly type: 'get-index-state'; readonly bookId: string }
  | { readonly requestId: string; readonly type: 'begin-index'; readonly bookId: string; readonly sectionsTotal: number }
  | { readonly requestId: string; readonly type: 'commit-index-batch'; readonly bookId: string; readonly epoch: number; readonly expected: IndexCursor; readonly chunks: readonly IndexChunk[]; readonly next: IndexCursor; readonly sectionsIndexed: number }
  | { readonly requestId: string; readonly type: 'complete-index'; readonly bookId: string; readonly epoch: number }
  | { readonly requestId: string; readonly type: 'fail-index'; readonly bookId: string; readonly epoch: number; readonly message: string }
  | { readonly requestId: string; readonly type: 'cancel-index'; readonly bookId: string; readonly epoch: number }
  | { readonly requestId: string; readonly type: 'search-book'; readonly bookId: string; readonly query: string; readonly limit: number }
  | { readonly requestId: string; readonly type: 'list-section-rewrites'; readonly bookId: string }
  | {
      readonly requestId: string
      readonly type: 'append-section-rewrite'
      readonly bookId: string
      readonly sectionIndex: number
      readonly version: SectionRewriteVersion
    }
  | {
      readonly requestId: string
      readonly type: 'undo-section-rewrite'
      readonly bookId: string
      readonly sectionIndex: number
    }
  | {
      readonly requestId: string
      readonly type: 'clear-section-rewrites'
      readonly bookId: string
      readonly sectionIndex: number
    }

export type StorageWorkerResult =
  | { readonly type: 'initialized'; readonly diagnostics: StorageDiagnostics }
  | { readonly type: 'book-written'; readonly bookId: string }
  | { readonly type: 'book'; readonly book: StoredBook | null }
  | { readonly type: 'book-list'; readonly books: readonly BookCatalogEntry[] }
  | { readonly type: 'reading-state-written'; readonly bookId: string }
  | { readonly type: 'reading-state'; readonly state: ReadingState | null }
  | { readonly type: 'diagnostics'; readonly diagnostics: StorageDiagnostics }
  | { readonly type: 'persistence-request-claimed'; readonly claimed: boolean }
  | { readonly type: 'closed' }
  | { readonly type: 'annotation-saved'; readonly annotation: Annotation }
  | { readonly type: 'annotation-deleted'; readonly annotationId: string }
  | { readonly type: 'annotations'; readonly annotations: readonly Annotation[] }
  | { readonly type: 'board'; readonly board: StudyBoard }
  | { readonly type: 'study-item-committed'; readonly commit: StudyItemCommit }
  | { readonly type: 'study-item-repaired'; readonly item: StudyItem }
  | { readonly type: 'study-item-undone'; readonly item: StudyItem | null }
  | { readonly type: 'study-item-deleted'; readonly itemId: string }
  | { readonly type: 'study-items'; readonly items: readonly StudyItem[] }
  | { readonly type: 'index-state'; readonly state: IndexState | null }
  | { readonly type: 'search-results'; readonly result: SearchResult }
  | { readonly type: 'section-rewrites'; readonly rewrites: readonly StoredSectionRewrite[] }
  | {
      readonly type: 'section-rewrite-written'
      readonly sectionIndex: number
      /** How many revisions the section has now. */
      readonly versions: number
    }

export type StorageWorkerResponse =
  | {
      readonly requestId: string
      readonly ok: true
      readonly result: StorageWorkerResult
    }
  | {
      readonly requestId: string
      readonly ok: false
      readonly error: {
        readonly code: string
        readonly message: string
        readonly retryable: boolean
      }
    }
