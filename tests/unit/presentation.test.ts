import { describe, expect, it, vi } from 'vitest'

import { PresentationStore } from '../../src/app/presentation.ts'
import { DEFAULT_READER_STYLE } from '../../src/reader/FoliateReaderAdapter.ts'

function store() {
  const applied: unknown[] = []
  const saved: unknown[] = []
  const presentation = new PresentationStore(DEFAULT_READER_STYLE)
  const uninstall = presentation.install({
    apply: (style) => void applied.push(style),
    persist: async (style) => void saved.push(style),
  })
  return { presentation, applied, saved, uninstall }
}

describe('the reading presentation store', () => {
  it('shows a commit to everyone watching, whoever made it', async () => {
    const { presentation, applied } = store()
    const seen: string[] = []
    presentation.subscribe((view) => seen.push(view.visible.theme))

    await presentation.commit({ theme: 'sepia' }, 'agent')

    expect(presentation.committed.theme).toBe('sepia')
    expect(seen).toContain('sepia')
    expect(applied.at(-1)).toMatchObject({ theme: 'sepia' })
  })

  it('changes only the named fields, over whatever is committed now', async () => {
    // The race the Text panel used to lose: a control sends a whole style it
    // read before the agent's change, and the agent's theme disappears.
    const { presentation } = store()
    await presentation.commit({ theme: 'dark' }, 'agent')
    await presentation.commit({ fontSizePercent: 140 }, 'user')

    expect(presentation.committed).toMatchObject({ theme: 'dark', fontSizePercent: 140 })
  })

  it('ignores a restore that finishes after something has been committed', async () => {
    // The book is still opening, the tools are already offered, and an agent
    // changes the theme. The restore that lands afterwards must not win.
    const { presentation } = store()
    await presentation.commit({ theme: 'dark' }, 'agent')

    presentation.hydrate({ ...DEFAULT_READER_STYLE, theme: 'sepia', fontSizePercent: 90 })

    expect(presentation.committed).toMatchObject({ theme: 'dark' })
  })

  it('adopts a restore when nothing has been committed yet', () => {
    const { presentation } = store()
    presentation.hydrate({ ...DEFAULT_READER_STYLE, fontSizePercent: 130 })
    expect(presentation.committed.fontSizePercent).toBe(130)
  })

  it('keeps a preview off the record and out of storage', () => {
    const { presentation, applied, saved } = store()
    presentation.preview({ fontSizePercent: 180 })

    expect(presentation.visible.fontSizePercent).toBe(180)
    expect(presentation.committed.fontSizePercent).toBe(DEFAULT_READER_STYLE.fontSizePercent)
    expect(applied.at(-1)).toMatchObject({ fontSizePercent: 180 })
    expect(saved).toHaveLength(0)
    expect(presentation.view.reversible).toBeUndefined()
  })

  it('puts the committed presentation back when a preview is cancelled', () => {
    const { presentation, applied } = store()
    presentation.preview({ theme: 'dark' })
    presentation.cancelPreview()

    expect(presentation.visible).toEqual(presentation.committed)
    expect(applied.at(-1)).toEqual(presentation.committed)
    expect(presentation.view.previewing).toBe(false)
  })

  it('strips what custom CSS may not do, on whichever path sent it', async () => {
    const { presentation } = store()
    const commit = await presentation.commit(
      { customCss: '@import url("https://fonts.example/x.css"); p { color: red }' },
      'agent',
    )

    expect(commit.applied.customCss).not.toContain('@import')
    expect(commit.applied.customCss).toContain('color: red')
    expect(commit.warnings.join(' ')).toContain('@import')
  })

  it('reports that nothing was saved when saving failed', async () => {
    const presentation = new PresentationStore(DEFAULT_READER_STYLE)
    presentation.install({
      apply: () => undefined,
      persist: () => Promise.reject(new Error('no reading position yet')),
    })

    const commit = await presentation.commit({ theme: 'dark' }, 'agent')

    expect(commit.persisted).toBe(false)
    expect(presentation.committed.theme).toBe('dark')
  })

  it('reports that nothing was saved when no reader is mounted', async () => {
    const presentation = new PresentationStore(DEFAULT_READER_STYLE)
    const commit = await presentation.commit({ theme: 'dark' }, 'agent')
    expect(commit.persisted).toBe(false)
  })

  it('offers the last change back, and forgets it once it is taken', async () => {
    const { presentation, saved } = store()
    await presentation.commit({ theme: 'dark', fontSizePercent: 150 }, 'agent')

    const reversible = presentation.view.reversible
    expect(reversible).toMatchObject({ origin: 'agent' })
    await presentation.restore(reversible!.prior, 'user')

    expect(presentation.committed).toEqual(DEFAULT_READER_STYLE)
    expect(saved.at(-1)).toEqual(DEFAULT_READER_STYLE)
  })

  it('stops writing to a reader that has gone away', async () => {
    const apply = vi.fn()
    const presentation = new PresentationStore(DEFAULT_READER_STYLE)
    const uninstall = presentation.install({ apply, persist: async () => undefined })
    uninstall()
    await presentation.commit({ theme: 'dark' }, 'user')

    expect(apply).toHaveBeenCalledTimes(1) // only the one install performs
  })

  it('starts clean for a different book', () => {
    // The store outlives any one book, but reading style is stored per book.
    // Without this, the second book kept the first one's settings — and, once
    // anything had been committed, `hydrate` would refuse to replace them.
    const { presentation } = store()
    void presentation.commit({ theme: 'dark' }, 'agent')

    presentation.beginBook(DEFAULT_READER_STYLE)

    expect(presentation.committed).toEqual(DEFAULT_READER_STYLE)
    expect(presentation.view.reversible).toBeUndefined()
    presentation.hydrate({ ...DEFAULT_READER_STYLE, theme: 'sepia' })
    expect(presentation.committed.theme).toBe('sepia')
  })
})
