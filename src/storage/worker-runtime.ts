import sqlite3InitModule, {
  type Database,
  type SAHPoolUtil,
  type Sqlite3Static,
} from '@sqlite.org/sqlite-wasm'

import type {
  StorageDiagnostics,
  StorageWorkerRequest,
  StorageWorkerResult,
} from '../domain/index.ts'
import { sha256BookId } from './hash.ts'
import { LibraryRepository } from './library-repository.ts'
import { assertStorageWorkerRequest } from './protocol.ts'
import { initializeSchema, STORAGE_SCHEMA_VERSION } from './schema.ts'

const DATABASE_FILE = '/bookhand-library.sqlite3'
const SAHPOOL_DIRECTORY = '/bookhand-sahpool'
const SAHPOOL_VFS_NAME = 'bookhand-opfs-sahpool'

type SqliteInitializer = () => Promise<Sqlite3Static>

interface InstallOptions {
  readonly name: string
  readonly directory: string
  readonly initialCapacity: number
  readonly forceReinitIfPreviouslyFailed?: boolean
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function hasRequiredOpfsApis(): boolean {
  const fileHandlePrototype =
    typeof FileSystemFileHandle === 'undefined'
      ? undefined
      : (FileSystemFileHandle.prototype as FileSystemFileHandle & {
          createSyncAccessHandle?: unknown
        })
  return (
    typeof FileSystemHandle !== 'undefined' &&
    typeof FileSystemDirectoryHandle !== 'undefined' &&
    typeof fileHandlePrototype?.createSyncAccessHandle === 'function' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  )
}

function isUnavailableError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'NotAllowedError' || error.name === 'SecurityError'
  }
  return error instanceof Error && /missing required opfs apis/i.test(error.message)
}

export function isLockError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'NoModificationAllowedError') {
    return true
  }
  if (!(error instanceof Error)) return false
  if (
    (error as Error & { code?: unknown }).code === 'library-locked' ||
    error.name === 'NoModificationAllowedError'
  ) {
    return true
  }
  return (
    /(?:another|already|currently).{0,48}(?:open )?(?:sync )?access handle/i.test(
      error.message,
    ) ||
    /(?:sync )?access handle.{0,48}(?:in use|already open|currently open|locked)/i.test(
      error.message,
    )
  )
}

function storageError(code: string, message: string, retryable: boolean): Error {
  return Object.assign(new Error(message), { code, retryable })
}

async function initializeOfficialSqlite(): Promise<Sqlite3Static> {
  const initialize = sqlite3InitModule as unknown as (options: {
    locateFile(path: string): string
  }) => Promise<Sqlite3Static>
  return initialize({
    locateFile: (path) => new URL(path, globalThis.location.href).href,
  })
}

export class StorageWorkerRuntime {
  private readonly initializeSqlite: SqliteInitializer
  private sqlite: Sqlite3Static | undefined
  private db: Database | undefined
  private repository: LibraryRepository | undefined
  private pool: SAHPoolUtil | undefined
  private mode: StorageDiagnostics['mode'] | undefined

  constructor(initializeSqlite: SqliteInitializer = initializeOfficialSqlite) {
    this.initializeSqlite = initializeSqlite
  }

  async handle(rawRequest: unknown): Promise<StorageWorkerResult> {
    assertStorageWorkerRequest(rawRequest)
    const request: StorageWorkerRequest = rawRequest
    switch (request.type) {
      case 'initialize':
        return { type: 'initialized', diagnostics: await this.initialize() }
      case 'retry-persistence':
        return { type: 'initialized', diagnostics: await this.retryPersistence() }
      case 'import-book': {
        const repository = this.requireRepository()
        const bookId = await sha256BookId(request.book.epubBytes)
        repository.importBook(bookId, request.book)
        return { type: 'book-written', bookId }
      }
      case 'get-book':
        return { type: 'book', book: this.requireRepository().getBook(request.bookId) }
      case 'list-books':
        return { type: 'book-list', books: this.requireRepository().listBooks() }
      case 'put-reading-state':
        return {
          type: 'reading-state-written',
          bookId: this.requireRepository().putReadingState(request.state),
        }
      case 'get-reading-state':
        return {
          type: 'reading-state',
          state: this.requireRepository().getReadingState(request.bookId),
        }
      case 'get-diagnostics':
        return { type: 'diagnostics', diagnostics: this.diagnostics() }
      case 'claim-persistence-request':
        return {
          type: 'persistence-request-claimed',
          claimed:
            this.mode === 'persistent' &&
            this.requireRepository().claimPersistenceRequest(),
        }
      case 'close':
        this.close()
        return { type: 'closed' }
      case 'save-annotation':
        return {
          type: 'annotation-saved',
          annotation: this.requireRepository().saveAnnotation(request.annotation),
        }
      case 'delete-annotation':
        this.requireRepository().deleteAnnotation(request.annotationId)
        return { type: 'annotation-deleted', annotationId: request.annotationId }
      case 'list-annotations':
        return {
          type: 'annotations',
          annotations: this.requireRepository().listAnnotations(request.bookId),
        }
      case 'get-board':
        return {
          type: 'board',
          board: this.requireRepository().getOrCreateBoard(
            request.bookId,
            new Date().toISOString(),
          ),
        }
      case 'set-board-view':
        return {
          type: 'board',
          board: this.requireRepository().setBoardView(
            request.boardId,
            request.view,
            new Date().toISOString(),
          ),
        }
      case 'upsert-study-item':
        return {
          type: 'study-item-saved',
          item: this.requireRepository().upsertStudyItem(request.item),
        }
      case 'delete-study-item':
        this.requireRepository().deleteStudyItem(request.itemId)
        return { type: 'study-item-deleted', itemId: request.itemId }
      case 'list-study-items':
        return {
          type: 'study-items',
          items: this.requireRepository().listStudyItems(request.boardId),
        }
    }
  }

  private async initialize(): Promise<StorageDiagnostics> {
    if (this.mode) return this.diagnostics()
    this.sqlite ??= await this.initializeSqlite()

    if (!hasRequiredOpfsApis()) {
      this.openSessionDatabase()
      return this.diagnostics()
    }

    try {
      await this.openPersistentDatabase(false)
    } catch (error) {
      if (isUnavailableError(error)) this.openSessionDatabase()
      else if (isLockError(error)) this.mode = 'locked'
      else throw error
    }
    return this.diagnostics()
  }

  private async retryPersistence(): Promise<StorageDiagnostics> {
    if (!this.mode) return this.initialize()
    if (this.mode !== 'locked') return this.diagnostics()
    await this.openPersistentDatabase(true)
    return this.diagnostics()
  }

  private async openPersistentDatabase(forceReinitialize: boolean): Promise<void> {
    const sqlite = this.sqlite
    if (!sqlite) throw new Error('SQLite is not initialized')

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const options: InstallOptions = {
          name: SAHPOOL_VFS_NAME,
          directory: SAHPOOL_DIRECTORY,
          initialCapacity: 6,
          ...(forceReinitialize || attempt > 0
            ? { forceReinitIfPreviouslyFailed: true }
            : {}),
        }
        this.pool = await (
          sqlite.installOpfsSAHPoolVfs as unknown as (
            options: InstallOptions,
          ) => Promise<SAHPoolUtil>
        )(options)
        this.db = new this.pool.OpfsSAHPoolDb(DATABASE_FILE)
        initializeSchema(this.db)
        this.repository = new LibraryRepository(this.db)
        this.mode = 'persistent'
        return
      } catch (error) {
        this.db?.close()
        this.db = undefined
        this.repository = undefined
        lastError = error
        if (isUnavailableError(error)) throw error
        if (attempt === 0) await delay(75)
      }
    }
    if (isLockError(lastError)) {
      throw storageError(
        'library-locked',
        lastError instanceof Error
          ? `This library is open in another tab: ${lastError.message}`
          : 'This library is open in another tab',
        true,
      )
    }
    throw storageError(
      'storage-initialization-failed',
      lastError instanceof Error
        ? `Could not initialize the library database: ${lastError.message}`
        : 'Could not initialize the library database',
      false,
    )
  }

  private openSessionDatabase(): void {
    if (this.db) throw new Error('A storage connection is already open')
    if (!this.sqlite) throw new Error('SQLite is not initialized')
    this.db = new this.sqlite.oo1.DB(':memory:', 'c')
    initializeSchema(this.db)
    this.repository = new LibraryRepository(this.db)
    this.mode = 'session-only'
  }

  private requireRepository(): LibraryRepository {
    if (this.mode === 'locked') {
      throw storageError(
        'library-locked',
        'This library is open in another tab',
        true,
      )
    }
    if (!this.repository) {
      throw storageError('storage-not-initialized', 'Storage is not initialized', true)
    }
    return this.repository
  }

  private diagnostics(): StorageDiagnostics {
    if (!this.sqlite || !this.mode) {
      throw storageError('storage-not-initialized', 'Storage is not initialized', true)
    }
    return {
      mode: this.mode,
      sqliteVersion: this.sqlite.version.libVersion,
      vfsName:
        this.mode === 'persistent'
          ? (this.db?.dbVfsName() ?? this.pool?.vfsName ?? SAHPOOL_VFS_NAME)
          : this.mode === 'session-only'
            ? 'memory'
            : SAHPOOL_VFS_NAME,
      schemaVersion: this.db
        ? Number(this.db.selectValue('PRAGMA user_version') ?? STORAGE_SCHEMA_VERSION)
        : STORAGE_SCHEMA_VERSION,
      connectionOwner: 'dedicated-worker',
      bookCount: this.repository?.countBooks() ?? 0,
    }
  }

  close(): void {
    this.db?.close()
    this.db = undefined
    this.repository = undefined
    this.mode = undefined
  }
}

export function storageWorkerError(error: unknown): {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
} {
  if (error instanceof Error) {
    const details = error as Error & { code?: unknown; retryable?: unknown }
    return {
      code: typeof details.code === 'string' ? details.code : 'storage-error',
      message: error.message,
      retryable: details.retryable === true,
    }
  }
  return { code: 'storage-error', message: 'Unknown storage error', retryable: false }
}
