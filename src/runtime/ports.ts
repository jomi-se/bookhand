import type {
  BookCatalogEntry,
  BookMetadata,
  StorageDiagnostics,
} from '../domain/index.ts'

/**
 * Narrow dependency ports used by the later storage and reader compositions.
 * Tests wrap these ports; production code never parses fault names, URLs, or
 * ambient globals to decide which implementation to use.
 */
export interface PersistenceBootstrapPort {
  initialize(): Promise<StorageDiagnostics>
}

export interface LibraryQueryPort {
  listBooks(): Promise<readonly BookCatalogEntry[]>
}

export interface ReaderEnginePort {
  openBook(blob: Blob): Promise<BookMetadata>
  loadSection(sectionIndex: number): Promise<void>
}

export interface RuntimePorts {
  readonly persistence: PersistenceBootstrapPort
  readonly library: LibraryQueryPort
  readonly reader: ReaderEnginePort
}

