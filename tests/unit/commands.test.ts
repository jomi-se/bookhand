import { describe, expect, it, vi } from 'vitest'

import type {
  Annotation,
  BookRange,
  ReaderAdapter,
  StudyBoard,
  StudyItem,
} from '../../src/domain/index.ts'
import { BookhandCommands, ReaderUnavailableError } from '../../src/app/commands.ts'
import { ReaderPortBridge } from '../../src/app/reader-bridge.ts'
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
    getPassage: vi.fn(),
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
    upsertStudyItem: vi.fn(async (item: StudyItem) => {
      const index = items.findIndex((i) => i.id === item.id)
      if (index >= 0) items[index] = item
      else items.push(item)
      return item
    }),
    listStudyItems: vi.fn(async () => items),
    deleteStudyItem: vi.fn(async () => undefined),
    setBoardView: vi.fn(async () => ({ ...board, view: 'expanded' as const })),
  } as unknown as StorageClient

  const bridge = new ReaderPortBridge()
  const adapter = fakeAdapter(overrides)
  bridge.attach(adapter)

  let counter = 0
  const commands = new BookhandCommands({
    client,
    bridge,
    bookId: 'book-1',
    bookTitle: 'Calculus Made Easy',
    board,
    now: () => new Date('2026-09-01T12:00:00.000Z'),
    newId: () => `generated-${++counter}`,
  })
  return { commands, client, bridge, adapter, annotations, items }
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
    const saved = await commands.saveAnnotation({ range, quote: 'Alpha exact' })

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
    const first = await commands.saveAnnotation({ range, quote: 'Alpha exact', color: 'sky' })
    const edited = await commands.saveAnnotation({
      id: first.id,
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
      sourceRange: range,
      sourceLabel: 'Chapter X',
    })

    expect(second.sortOrder).toBe(1)
    expect(second.sourceRange).toEqual(range)
    expect(second.sourceLabel).toBe('Chapter X')
  })

  it('notifies subscribers so every surface reflects one change', async () => {
    const { commands } = setup()
    const listener = vi.fn()
    const unsubscribe = commands.subscribe(listener)

    await commands.saveAnnotation({ range, quote: 'Alpha exact' })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    await commands.saveAnnotation({ range, quote: 'Beta' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('navigates and reports where that left the reader', async () => {
    const { commands, adapter } = setup()
    const context = await commands.navigateBook({ kind: 'section', sectionIndex: 3 })
    expect(adapter.navigate).toHaveBeenCalledWith({ kind: 'section', sectionIndex: 3 })
    expect(context.sectionIndex).toBe(3)
  })
})
