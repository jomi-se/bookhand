import { describe, expect, it, vi } from 'vitest'

import type {
  Annotation,
  BookRange,
  ReaderAdapter,
  StudyBoard,
  StudyItem,
} from '../../src/domain/index.ts'
import { BookhandCommands, ReaderUnavailableError } from '../../src/app/commands.ts'
import { SourceVerificationError } from '../../src/domain/source-verification.ts'
import { PresentationStore } from '../../src/app/presentation.ts'
import { ReaderPortBridge } from '../../src/app/reader-bridge.ts'
import { SurfaceStore } from '../../src/app/surface.ts'
import { DEFAULT_READER_STYLE } from '../../src/reader/FoliateReaderAdapter.ts'
import type { StorageClient } from '../../src/storage/client.ts'

const range: BookRange = {
  startCfi: 'epubcfi(/6/4!/4/2,/1:0)',
  endCfi: 'epubcfi(/6/4!/4/2,/1:11)',
  cfi: 'epubcfi(/6/4!/4/2,/1:0,/1:11)',
  sectionIndex: 3,
  textFingerprint: 'fnv1a-0000ffff',
}

const board: StudyBoard = {
  id: 'board-1',
  bookId: 'book-1',
  title: 'Study board',
  view: 'docked',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

function fakeAdapter(overrides: Partial<ReaderAdapter> = {}): ReaderAdapter {
  return {
    open: vi.fn(),
    close: vi.fn(),
    getToc: () => [],
    getLocation: () => ({ cfi: 'x', sectionIndex: 3, fraction: 0.29, chapterLabel: 'Chapter X' }),
    getSelection: () => null,
    getVisibleContext: async () => ({
      text: 'Visible text',
      range,
      chapterBreadcrumb: ['Chapter X'],
    }),
    // The range in these tests resolves to exactly this text, so a quote of
    // 'Alpha exact' verifies and anything else is rejected.
    getPassage: vi.fn(async () => ({
      text: 'Alpha exact',
      range,
      chapterBreadcrumb: ['Chapter X'],
    })),
    listSections: () => [],
    getSectionSnapshot: vi.fn(),
    navigate: vi.fn().mockResolvedValue(undefined),
    applyStyle: vi.fn(),
    getStyle: () => ({
      fontSizePercent: 100,
      lineHeight: 1.55,
      measureCh: 68,
      paragraphSpacingEm: 0.75,
      theme: 'publisher' as const,
    }),
    resetStyle: vi.fn(),
    renderAnnotations: vi.fn(),
    ...overrides,
  } as ReaderAdapter
}

function setup(overrides: Partial<ReaderAdapter> = {}) {
  const annotations: Annotation[] = []
  const items: StudyItem[] = []
  const client = {
    saveAnnotation: vi.fn(async (annotation: Annotation) => {
      const index = annotations.findIndex((a) => a.id === annotation.id)
      if (index >= 0) annotations[index] = annotation
      else annotations.push(annotation)
      return annotation
    }),
    listAnnotations: vi.fn(async () => annotations),
    deleteAnnotation: vi.fn(async (id: string) => {
      annotations.splice(
        annotations.findIndex((a) => a.id === id),
        1,
      )
    }),
    commitStudyItem: vi.fn(async (item: StudyItem) => {
      const index = items.findIndex((i) => i.id === item.id)
      if (index >= 0) items[index] = item
      else items.push(item)
      return { item, replayed: false }
    }),
    undoStudyItem: vi.fn(async (itemId: string) => {
      items.splice(
        items.findIndex((i) => i.id === itemId),
        1,
      )
      return null
    }),
    listStudyItems: vi.fn(async () => items),
    deleteStudyItem: vi.fn(async () => undefined),
    setBoardView: vi.fn(async (_id: string, view: StudyBoard['view']) => ({ ...board, view })),
  } as unknown as StorageClient

  const bridge = new ReaderPortBridge()
  const adapter = fakeAdapter(overrides)
  bridge.attach(adapter)

  let counter = 0
  const presentation = new PresentationStore(DEFAULT_READER_STYLE)
  const surface = new SurfaceStore()
  const commands = new BookhandCommands({
    client,
    bridge,
    presentation,
    surface,
    designContextVersion: 'sha256:test',
    bookId: 'book-1',
    bookTitle: 'Calculus Made Easy',
    board,
    now: () => new Date('2026-09-01T12:00:00.000Z'),
    newId: () => `generated-${++counter}`,
  })
  return { commands, client, bridge, adapter, annotations, items, presentation, surface }
}

describe('the shared command surface', () => {
  it('reports reading context an agent or the UI can act on', async () => {
    const { commands } = setup()
    await expect(commands.getReadingContext()).resolves.toMatchObject({
      bookId: 'book-1',
      title: 'Calculus Made Easy',
      chapterLabel: 'Chapter X',
      sectionIndex: 3,
      progressPercent: 29,
      visible: { text: 'Visible text' },
    })
  })

  it('includes the live selection when there is one', async () => {
    const { commands } = setup({
      getSelection: () => ({ quote: 'Alpha exact', range }),
    })
    const context = await commands.getReadingContext()
    expect(context.selection).toEqual({ quote: 'Alpha exact', range })
  })

  it('refuses to act when no book is open rather than inventing a result', async () => {
    const { commands, bridge, adapter } = setup()
    bridge.detach(adapter)
    await expect(commands.getReadingContext()).rejects.toBeInstanceOf(ReaderUnavailableError)
  })

  it('saves an annotation with a default colour and returns to it by id', async () => {
    const { commands, annotations } = setup()
    const saved = await commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha exact' })

    expect(saved).toMatchObject({
      id: 'generated-1',
      bookId: 'book-1',
      quote: 'Alpha exact',
      color: 'accent',
      createdAt: '2026-09-01T12:00:00.000Z',
    })
    expect(annotations).toHaveLength(1)
  })

  it('edits an existing annotation in place, preserving when it was created', async () => {
    const { commands, annotations } = setup()
    const first = await commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha exact', color: 'sky' })
    const edited = await commands.saveAnnotation({
      id: first.id,
      bookId: 'book-1',
      range,
      quote: 'Alpha exact',
      note: 'The slope at a point',
    })

    expect(annotations).toHaveLength(1)
    expect(edited).toMatchObject({
      id: first.id,
      note: 'The slope at a point',
      color: 'sky',
      createdAt: first.createdAt,
    })
  })

  it('appends study items in order and keeps the source range that links back', async () => {
    const { commands } = setup()
    await commands.upsertStudyItem({
      payload: { kind: 'prose', text: 'First' },
    })
    const second = await commands.upsertStudyItem({
      payload: { kind: 'quotation', text: 'Alpha exact' },
      bookId: 'book-1',
      sourceRange: range,
      sourceQuote: 'Alpha exact',
      sourceLabel: 'Chapter X',
    })

    expect(second.applied.sortOrder).toBe(1)
    expect(second.applied.sourceRange).toEqual(range)
    expect(second.applied.sourceLabel).toBe('Chapter X')
  })

  it('notifies subscribers so every surface reflects one change', async () => {
    const { commands } = setup()
    const listener = vi.fn()
    const unsubscribe = commands.subscribe(listener)

    await commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha exact' })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    await commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha exact' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('navigates and reports where that left the reader', async () => {
    const { commands, adapter } = setup()
    const context = await commands.navigateBook({ kind: 'section', sectionIndex: 3 })
    expect(adapter.navigate).toHaveBeenCalledWith({ kind: 'section', sectionIndex: 3 })
    expect(context.sectionIndex).toBe(3)
  })
})

describe('source ownership at the mutation boundary', () => {
  async function rejectionCode(run: () => Promise<unknown>): Promise<string> {
    try {
      await run()
    } catch (error) {
      if (error instanceof SourceVerificationError) return error.code
      throw error
    }
    throw new Error('expected a rejection')
  }

  it('rejects a mutation naming a different book, without writing anything', async () => {
    const { commands, annotations, client } = setup()
    const code = await rejectionCode(() =>
      commands.saveAnnotation({ bookId: 'book-2', range, quote: 'Alpha exact' }),
    )
    expect(code).toBe('wrong-book')
    expect(annotations).toHaveLength(0)
    expect(client.saveAnnotation).not.toHaveBeenCalled()
  })

  it('rejects a range the open book cannot resolve', async () => {
    const { commands, annotations } = setup({
      getPassage: vi.fn(async () => {
        throw new Error('no such location')
      }),
    })
    const code = await rejectionCode(() =>
      commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha exact' }),
    )
    expect(code).toBe('stale-range')
    expect(annotations).toHaveLength(0)
  })

  it('rejects a range whose text has changed since it was captured', async () => {
    const { commands, annotations } = setup({
      getPassage: vi.fn(async () => ({
        text: 'Alpha exact',
        range: { ...range, textFingerprint: 'fnv1a-changed' },
        chapterBreadcrumb: ['Chapter X'],
      })),
    })
    const code = await rejectionCode(() =>
      commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha exact' }),
    )
    expect(code).toBe('stale-fingerprint')
    expect(annotations).toHaveLength(0)
  })

  it('rejects a quote that covers only part of its range', async () => {
    const { commands, annotations } = setup()
    const code = await rejectionCode(() =>
      commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha' }),
    )
    expect(code).toBe('partial-quote')
    expect(annotations).toHaveLength(0)
  })

  it('rejects a quote the book does not contain', async () => {
    const { commands, annotations } = setup()
    const code = await rejectionCode(() =>
      commands.saveAnnotation({ bookId: 'book-1', range, quote: 'Alpha invented' }),
    )
    expect(code).toBe('invented-quote')
    expect(annotations).toHaveLength(0)
  })

  it('forgives whitespace the typesetter chose', async () => {
    const { commands, annotations } = setup()
    await commands.saveAnnotation({ bookId: 'book-1', range, quote: '  Alpha\n exact  ' })
    expect(annotations).toHaveLength(1)
  })

  it('will not let a study block cite a source it cannot prove', async () => {
    const { commands, items } = setup()
    const code = await rejectionCode(() =>
      commands.upsertStudyItem({
        payload: { kind: 'quotation', text: 'Alpha invented' },
        bookId: 'book-1',
        sourceRange: range,
        sourceQuote: 'Alpha invented',
      }),
    )
    expect(code).toBe('invented-quote')
    expect(items).toHaveLength(0)
  })

  it('will not let a study block claim a source range with no quote at all', async () => {
    const { commands, items } = setup()
    await expect(
      commands.upsertStudyItem({
        payload: { kind: 'prose', text: 'Trust me' },
        sourceRange: range,
      }),
    ).rejects.toBeInstanceOf(SourceVerificationError)
    expect(items).toHaveLength(0)
  })

  it('leaves an unsourced study block alone; it claims nothing to verify', async () => {
    const { commands, items } = setup()
    await commands.upsertStudyItem({ payload: { kind: 'prose', text: 'A note of my own' } })
    expect(items).toHaveLength(1)
  })
})

describe('the reading presentation', () => {
  it('hands back what it replaced, what it applied, and how to take it back', async () => {
    const { commands, presentation } = setup()
    presentation.install({ apply: () => undefined, persist: async () => undefined })

    const receipt = await commands.setReadingStyle({ patch: { theme: 'dark' }, origin: 'agent' })

    expect(receipt.origin).toBe('agent')
    expect(receipt.prior?.theme).toBe('publisher')
    expect(receipt.applied.theme).toBe('dark')
    expect(receipt.persisted).toBe(true)
    expect(receipt.actions.map((action) => action.label)).toEqual([
      'Undo',
      'Reset all text settings',
    ])
    expect(receipt.actionGroupId).toBeTruthy()
  })

  it('says a change is not saved rather than claiming it is', async () => {
    // No reader is mounted, so nothing installed a way to store it. Reporting
    // this honestly is the whole point: the agent has just been told the
    // change is on screen, and it is, and it will not come back.
    const { commands } = setup()
    const receipt = await commands.setReadingStyle({ patch: { theme: 'dark' } })
    expect(receipt.persisted).toBe(false)
  })

  it('refuses custom book CSS from an agent that has not read the design guidance', async () => {
    const { commands, presentation } = setup()
    await expect(
      commands.setReadingStyle({ patch: { customCss: 'p { color: red }' }, origin: 'agent' }),
    ).rejects.toThrow(/get_design_context/)
    expect(presentation.committed.customCss).toBeUndefined()
  })

  it('names the current guidance version when the one offered is stale', async () => {
    const { commands, presentation } = setup()
    await expect(
      commands.setReadingStyle({
        patch: { customCss: 'p { color: red }' },
        origin: 'agent',
        designContextVersion: 'sha256:something-older',
      }),
    ).rejects.toThrow(/sha256:test/)
    expect(presentation.committed.customCss).toBeUndefined()
  })

  it('accepts custom book CSS once the current version is presented', async () => {
    const { commands, presentation } = setup()
    const receipt = await commands.setReadingStyle({
      patch: { customCss: 'p { color: red }' },
      origin: 'agent',
      designContextVersion: 'sha256:test',
    })
    expect(presentation.committed.customCss).toContain('color: red')
    expect(receipt.scope).toContain('cannot reach the library')
  })

  it('asks nothing of a person writing the same CSS through the panel', async () => {
    const { commands, presentation } = setup()
    await commands.setReadingStyle({ patch: { customCss: 'p { color: red }' } })
    expect(presentation.committed.customCss).toContain('color: red')
  })

  it('lets a named theme through without any handshake', async () => {
    const { commands, presentation } = setup()
    await commands.setReadingStyle({ patch: { theme: 'sepia' }, origin: 'agent' })
    expect(presentation.committed.theme).toBe('sepia')
  })

  it('undoes the last change whoever made it, and reports nothing to undo otherwise', async () => {
    const { commands, presentation } = setup()
    expect(await commands.undoReadingStyle()).toBeUndefined()

    await commands.setReadingStyle({ patch: { fontSizePercent: 160 }, origin: 'agent' })
    const undone = await commands.undoReadingStyle()

    expect(undone?.applied.fontSizePercent).toBe(DEFAULT_READER_STYLE.fontSizePercent)
    expect(presentation.committed).toEqual(DEFAULT_READER_STYLE)
  })

  it('reports the setting, not a half-finished preview', async () => {
    const { commands, presentation } = setup()
    presentation.preview({ fontSizePercent: 200 })

    expect(commands.getReadingStyle().fontSizePercent).toBe(
      DEFAULT_READER_STYLE.fontSizePercent,
    )
    expect(commands.getVisibleReadingStyle().fontSizePercent).toBe(200)
  })
})

describe('the study board view', () => {
  it('opens the board and stores the preference for docked and expanded', async () => {
    const { commands, client, surface } = setup()
    const receipt = await commands.setStudyBoardView('expanded', { origin: 'agent' })

    expect(vi.mocked(client.setBoardView)).toHaveBeenCalledWith('board-1', 'expanded')
    expect(surface.boardOpen).toBe(true)
    expect(receipt.applied).toEqual({ view: 'expanded', open: true })
    expect(receipt.prior).toEqual({ view: 'docked', open: false })
    expect(receipt.persisted).toBe(true)
  })

  it('brings the board forward on focus without touching the preference', async () => {
    const { commands, client, surface } = setup()
    const before = surface.state.focusNonce
    const receipt = await commands.setStudyBoardView('focus', { origin: 'agent' })

    expect(vi.mocked(client.setBoardView)).not.toHaveBeenCalled()
    expect(surface.boardOpen).toBe(true)
    expect(surface.state.focusNonce).toBe(before + 1)
    expect(receipt.applied.view).toBe('docked')
    expect(receipt.persisted).toBe(false)
  })

  it('closes the board without changing the preference or the content', async () => {
    const { commands, client, surface, items } = setup()
    await commands.setStudyBoardView('expanded')
    const storedBefore = vi.mocked(client.setBoardView).mock.calls.length

    const receipt = await commands.setStudyBoardView('close', { origin: 'agent' })

    expect(surface.boardOpen).toBe(false)
    expect(vi.mocked(client.setBoardView).mock.calls).toHaveLength(storedBefore)
    expect(vi.mocked(client.deleteStudyItem)).not.toHaveBeenCalled()
    expect(await commands.listStudyItems()).toHaveLength(items.length)
    expect(receipt.applied.view).toBe('expanded')
    expect(receipt.persisted).toBe(false)
  })

  it('offers Undo only for a layout change an agent made', async () => {
    const { commands, surface } = setup()
    await commands.setStudyBoardView('expanded', { origin: 'user' })
    expect(surface.state.boardReversal).toBeUndefined()

    await commands.setStudyBoardView('docked', { origin: 'agent' })
    expect(surface.state.boardReversal).toMatchObject({ origin: 'agent', priorView: 'expanded' })
  })

  it('undoes an agent layout change back to what was there', async () => {
    const { commands, surface } = setup()
    await commands.setStudyBoardView('expanded', { origin: 'agent' })
    const undone = await commands.undoStudyBoardView()

    expect(undone?.applied.view).toBe('docked')
    // The board was closed before the agent opened it, so Undo closes it again.
    expect(surface.boardOpen).toBe(false)
    expect(surface.state.boardReversal).toBeUndefined()
    expect(await commands.undoStudyBoardView()).toBeUndefined()
  })

  it('toggles from the layout in force, not from one read earlier', async () => {
    // The interface used to compute the next view from its last render. A
    // change made in between would be toggled away from the wrong starting
    // point, so the person's click did the opposite of what they saw.
    const { commands } = setup()
    await commands.setStudyBoardView('expanded', { origin: 'agent' })
    const receipt = await commands.toggleStudyBoardView()
    expect(receipt.applied.view).toBe('docked')
  })
})
