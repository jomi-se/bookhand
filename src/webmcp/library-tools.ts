import type { BookCatalogEntry, StorageDiagnostics } from '../domain/index.ts'
import { authorLine, progressPercent, splitTitle } from '../library/progress.ts'
import { textResult, type ToolDefinition, type ToolResult } from './model-context.ts'
import type { ToolCallReporter } from './useWebMcpTools.ts'

export interface LibraryToolOptions {
  readonly books: () => readonly BookCatalogEntry[]
  readonly diagnostics: () => StorageDiagnostics | undefined
  readonly openBook: (entry: BookCatalogEntry) => void
  readonly report: ToolCallReporter
}

/**
 * Offered from the moment the app loads, so an agent arriving at the library
 * can see what is here and open something, rather than finding no tools at all
 * until a person happens to open a book first.
 */
export function createLibraryTools(options: LibraryToolOptions): readonly ToolDefinition[] {
  const run = async (
    name: string,
    summary: string,
    body: () => Promise<ToolResult>,
  ): Promise<ToolResult> => {
    try {
      const result = await body()
      options.report({ name, summary })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That did not work'
      options.report({ name, summary: message, failed: true })
      return { content: [{ type: 'text', text: message }], isError: true }
    }
  }

  return [
    {
      name: 'list_books',
      description:
        "List the books in this person's local library, with how far through each one they are. Use this to find the book to open before reading anything.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () =>
        run('list_books', 'listed the library', async () => {
          const books = options.books()
          const mode = options.diagnostics()?.mode
          if (books.length === 0) {
            return textResult(
              'The library is empty. The person can add an EPUB with Open EPUB; books stay on their device.',
            )
          }
          const lines = books.map((entry) => {
            const percent = progressPercent(entry)
            return `${entry.id} · ${splitTitle(entry.metadata).title} · ${authorLine(entry)} · ${
              percent === undefined ? 'not started' : `${percent}%`
            }`
          })
          return textResult(
            [`Storage: ${mode ?? 'unknown'}`, `${books.length} book(s):`, ...lines].join('\n'),
          )
        }),
    },
    {
      name: 'open_book',
      description:
        'Open one of the books in the library so its reading tools become available. Identify it by the id from list_books, or by a distinctive part of its title.',
      inputSchema: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: 'An id returned by list_books.' },
          title: { type: 'string', description: 'Part of the title, matched case-insensitively.' },
        },
        additionalProperties: false,
      },
      execute: (input) =>
        run('open_book', 'opened a book', async () => {
          const books = options.books()
          const wanted = typeof input.title === 'string' ? input.title.toLowerCase() : undefined
          const entry =
            books.find((candidate) => candidate.id === input.bookId) ??
            (wanted
              ? books.find((candidate) => candidate.metadata.title.toLowerCase().includes(wanted))
              : undefined)
          if (!entry) throw new Error('No book in the library matches that. Call list_books first.')
          options.openBook(entry)
          return textResult(
            `Opened ${splitTitle(entry.metadata).title}. The reading and study tools are now available.`,
          )
        }),
    },
  ]
}
