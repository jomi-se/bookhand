import { describe, expect, it, vi } from 'vitest'

import type { BookCatalogEntry } from '../../src/domain/index.ts'
import { createLibraryTools } from '../../src/webmcp/library-tools.ts'

const books: readonly BookCatalogEntry[] = [
  {
    id: 'calculus-a',
    metadata: { title: 'Calculus Made Easy', authors: [{ name: 'Silvanus Thompson' }] },
    importedAt: '2026-09-01T00:00:00.000Z',
    provenance: { kind: 'imported', originalFileName: 'calculus.epub' },
  },
  {
    id: 'calculus-b',
    metadata: { title: 'Calculus in Context', authors: [{ name: 'Ada Reader' }] },
    importedAt: '2026-09-01T00:00:00.000Z',
    provenance: { kind: 'imported', originalFileName: 'context.epub' },
  },
]

function setup() {
  const openBook = vi.fn().mockResolvedValue(undefined)
  const reports: { name: string; summary: string; failed?: boolean }[] = []
  const tools = createLibraryTools({
    books: () => books,
    diagnostics: () => undefined,
    openBook,
    report: (record) => reports.push(record),
  })
  const tool = (name: string) => tools.find((candidate) => candidate.name === name)!
  return { tool, openBook, reports }
}

describe('library WebMCP contracts', () => {
  it('requires exactly one selector even when the browser ignores the schema', async () => {
    const { tool, openBook } = setup()
    expect((await tool('open_book').execute({})).isError).toBe(true)
    expect(
      (await tool('open_book').execute({ bookId: 'calculus-a', title: 'easy' })).isError,
    ).toBe(true)
    expect(openBook).not.toHaveBeenCalled()
  })

  it('returns bounded structured candidates and opens nothing when a title is ambiguous', async () => {
    const { tool, openBook, reports } = setup()
    const result = await tool('open_book').execute({ title: 'calculus' })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({
      ok: false,
      code: 'ambiguous-title',
      candidates: [
        { bookId: 'calculus-a', title: 'Calculus Made Easy' },
        { bookId: 'calculus-b', title: 'Calculus in Context' },
      ],
    })
    expect(openBook).not.toHaveBeenCalled()
    expect(reports.at(-1)?.failed).toBe(true)
  })

  it('opens exact identity and preserves actionable structured output', async () => {
    const { tool, openBook } = setup()
    const result = await tool('open_book').execute({ bookId: 'calculus-a' })
    expect(result.structuredContent).toMatchObject({
      ok: true,
      bookId: 'calculus-a',
      title: 'Calculus Made Easy',
    })
    expect(openBook).toHaveBeenCalledWith(books[0])
  })

  it('does not report the book open before the reading surface is ready', async () => {
    let ready!: () => void
    const openBook = vi.fn(() => new Promise<void>((resolve) => { ready = resolve }))
    const tools = createLibraryTools({
      books: () => books,
      diagnostics: () => undefined,
      openBook,
      report: vi.fn(),
    })
    const pending = tools.find((tool) => tool.name === 'open_book')!.execute({ bookId: 'calculus-a' })
    let settled = false
    void pending.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    ready()
    expect((await pending).isError).toBeFalsy()
  })

  it('rejects unknown fields and records the failed boundary call', async () => {
    const { tool, reports } = setup()
    const result = await tool('list_books').execute({ debug: true })
    expect(result.isError).toBe(true)
    expect(reports.at(-1)).toMatchObject({ name: 'list_books', failed: true })
  })
})
