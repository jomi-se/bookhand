import type { BookMetadata } from '../domain/reader.ts'
import type { FoliateBook, FoliateModule } from './foliate-types.ts'

/** An EPUB that Foliate could not parse at all. */
export class BookUnreadableError extends Error {
  constructor(cause?: unknown) {
    super('That file could not be read as an EPUB', { cause })
    this.name = 'BookUnreadableError'
  }
}

export function localized(
  value: string | Readonly<Record<string, string>> | undefined,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return Object.values(value)[0] ?? ''
}

export function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value as T]
}

function contributorName(
  value: string | { readonly name?: string | Readonly<Record<string, string>> } | undefined,
): string | undefined {
  if (!value) return undefined
  return typeof value === 'string' ? value : localized(value.name) || undefined
}

export async function mapMetadata(book: FoliateBook): Promise<BookMetadata> {
  const metadata = book.metadata
  const contributors = asArray(metadata?.author)
  const cover = await Promise.resolve(book.getCover?.())
  return {
    title: localized(metadata?.title) || 'Untitled Book',
    subtitle: localized(metadata?.subtitle) || undefined,
    authors: contributors.map((author) =>
      typeof author === 'string'
        ? { name: author }
        : {
            name: localized(author.name) || 'Unknown author',
            sortAs: localized(author.sortAs) || undefined,
          },
    ),
    language: asArray(metadata?.language)[0],
    publisher: contributorName(asArray(metadata?.publisher)[0]),
    description: metadata?.description,
    published: metadata?.published,
    modified: metadata?.modified,
    identifier: metadata?.identifier,
    cover: cover
      ? {
          mediaType: cover.type || 'application/octet-stream',
          bytes: new Uint8Array(await cover.arrayBuffer()),
        }
      : undefined,
  }
}

/**
 * Reads catalog metadata without rendering. The library uses this for both the
 * bundled bootstrap and user imports so a stored book always carries the same
 * title, author, and cover the reader would show.
 */
export async function readBookMetadata(
  blob: Blob,
  loadFoliate: () => Promise<FoliateModule> = () => import('./foliate-module.ts'),
): Promise<BookMetadata> {
  const file =
    blob instanceof File
      ? blob
      : new File([blob], 'book.epub', { type: blob.type || 'application/epub+zip' })
  let book: FoliateBook
  try {
    book = await (await loadFoliate()).makeBook(file)
  } catch (error) {
    throw new BookUnreadableError(error)
  }
  try {
    return await mapMetadata(book)
  } catch (error) {
    throw new BookUnreadableError(error)
  } finally {
    book.destroy?.()
  }
}
