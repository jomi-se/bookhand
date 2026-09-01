import type { BookCatalogEntry, ImportBookInput } from '../domain/index.ts'
import { BookUnreadableError, readBookMetadata } from '../reader/metadata.ts'
import { sha256BookId } from '../storage/hash.ts'
import type { StorageClient } from '../storage/client.ts'
import type { BundledBookRegistration } from './bundled-books.ts'

/** A file the person chose that Bookhand cannot accept, with a reason to show. */
export class ImportRejectedError extends Error {
  readonly reason: 'empty' | 'too-large' | 'unreadable'

  constructor(reason: 'empty' | 'too-large' | 'unreadable', message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'ImportRejectedError'
    this.reason = reason
  }
}

export class BundledBookError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'BundledBookError'
  }
}

const MAXIMUM_EPUB_BYTES = 1_073_741_824

export interface ImportDependencies {
  readonly now?: () => Date
  readonly fetch?: typeof globalThis.fetch
  readonly baseUrl?: string
  readonly readMetadata?: typeof readBookMetadata
}

async function toImportInput(
  bytes: Uint8Array,
  provenance: ImportBookInput['provenance'],
  dependencies: ImportDependencies,
): Promise<ImportBookInput> {
  const readMetadata = dependencies.readMetadata ?? readBookMetadata
  const metadata = await readMetadata(
    new Blob([bytes as unknown as BlobPart], { type: 'application/epub+zip' }),
  )
  return {
    metadata,
    epubBytes: bytes,
    importedAt: (dependencies.now?.() ?? new Date()).toISOString(),
    provenance,
  }
}

/**
 * Imports a person's own EPUB. A file that is not a readable EPUB is reported
 * as a rejection to show, never as an application failure.
 */
export async function importEpubFile(
  client: StorageClient,
  file: File,
  dependencies: ImportDependencies = {},
): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new ImportRejectedError('empty', `${file.name} is empty.`)
  }
  if (bytes.byteLength > MAXIMUM_EPUB_BYTES) {
    throw new ImportRejectedError('too-large', `${file.name} is too large to store.`)
  }

  let input: ImportBookInput
  try {
    input = await toImportInput(
      bytes,
      { kind: 'imported', originalFileName: file.name },
      dependencies,
    )
  } catch (error) {
    if (error instanceof BookUnreadableError) {
      throw new ImportRejectedError(
        'unreadable',
        `${file.name} is not an EPUB Bookhand can open.`,
        error,
      )
    }
    throw error
  }
  return client.importBook(input)
}

/**
 * Registers build-bundled books that are not stored yet. Identity is the
 * content hash, so a book already in the library is never re-fetched and the
 * pinned checksum is verified before anything is stored.
 */
export async function bootstrapBundledBooks(
  client: StorageClient,
  registrations: readonly BundledBookRegistration[],
  stored: readonly BookCatalogEntry[],
  dependencies: ImportDependencies = {},
): Promise<number> {
  const known = new Set(stored.map((entry) => entry.id))
  const fetchResource = dependencies.fetch ?? globalThis.fetch.bind(globalThis)
  let added = 0

  for (const registration of registrations) {
    if (known.has(registration.sha256)) continue
    const url = `${dependencies.baseUrl ?? '/'}${registration.path}`
    const response = await fetchResource(url)
    if (!response.ok) {
      throw new BundledBookError(`Could not load the bundled book (${response.status}).`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const digest = await sha256BookId(bytes)
    if (digest !== registration.sha256) {
      throw new BundledBookError(
        'The bundled book failed its checksum and was not stored.',
      )
    }
    await client.importBook(
      await toImportInput(
        bytes,
        {
          kind: 'bundled',
          sourceUrl: registration.sourceUrl,
          retrievedAt: registration.retrievedAt,
          removeAfterJudging: registration.removeAfterJudging,
        },
        dependencies,
      ),
    )
    added += 1
  }
  return added
}
