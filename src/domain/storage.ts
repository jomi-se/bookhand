import type {
  BookIdentifier,
  BookMetadata,
  ReaderLocation,
  ReaderStyle,
} from './reader.ts'

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
}

export type StorageWorkerRequest =
  | { readonly requestId: string; readonly type: 'initialize' }
  | {
      readonly requestId: string
      readonly type: 'put-book'
      readonly book: StoredBook
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

export type StorageWorkerResult =
  | { readonly type: 'initialized'; readonly diagnostics: StorageDiagnostics }
  | { readonly type: 'book-written'; readonly bookId: string }
  | { readonly type: 'book'; readonly book: StoredBook | null }
  | { readonly type: 'book-list'; readonly books: readonly BookCatalogEntry[] }
  | { readonly type: 'reading-state-written'; readonly bookId: string }
  | { readonly type: 'reading-state'; readonly state: ReadingState | null }
  | { readonly type: 'diagnostics'; readonly diagnostics: StorageDiagnostics }

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

