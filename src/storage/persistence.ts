import type { ImportBookInput } from '../domain/index.ts'
import type { StorageClient } from './client.ts'

export type PersistenceRequestOutcome =
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'not-requested'

export interface ImportOutcome {
  readonly bookId: string
  readonly persistence: PersistenceRequestOutcome
}

export interface PersistenceManager {
  persist?: () => Promise<boolean>
}

export async function importBookAndRequestPersistence(
  client: StorageClient,
  book: ImportBookInput,
  storage: PersistenceManager | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.storage,
): Promise<ImportOutcome> {
  const bookId = await client.importBook(book)
  if (book.provenance.kind !== 'imported') {
    return { bookId, persistence: 'not-requested' }
  }

  const diagnostics = await client.getDiagnostics()
  if (diagnostics.mode !== 'persistent') {
    return { bookId, persistence: 'not-requested' }
  }

  const claimed = await client.claimPersistenceRequest()
  if (!claimed) return { bookId, persistence: 'not-requested' }
  if (typeof storage?.persist !== 'function') {
    return { bookId, persistence: 'unsupported' }
  }
  return {
    bookId,
    persistence: (await storage.persist()) ? 'granted' : 'denied',
  }
}

