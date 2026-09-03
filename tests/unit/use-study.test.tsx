// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GuidanceController } from '../../src/app/guidance.ts'
import { PresentationStore } from '../../src/app/presentation.ts'
import { ReaderPortBridge } from '../../src/app/reader-bridge.ts'
import { SurfaceStore } from '../../src/app/surface.ts'
import type { BookCatalogEntry, StudyBoard } from '../../src/domain/index.ts'
import { DEFAULT_READER_STYLE } from '../../src/reader/FoliateReaderAdapter.ts'
import type { StorageClient } from '../../src/storage/client.ts'
import { useStudy } from '../../src/study/useStudy.ts'

const board: StudyBoard = {
  id: 'board-book-1',
  bookId: 'book-1',
  title: 'Study board',
  view: 'docked',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
}

describe('Study availability boundary', () => {
  it('keeps the book command surface alive when the board cannot load, then recovers', async () => {
    const client = {
      getBoard: vi.fn()
        .mockRejectedValueOnce(new Error('Local Study storage did not open'))
        .mockResolvedValueOnce(board),
      listAnnotations: vi.fn().mockResolvedValue([]),
      listStudyItems: vi.fn().mockResolvedValue([]),
      listStudyExperiences: vi.fn().mockResolvedValue([]),
    } as unknown as StorageClient
    const options = {
      entry: {
        id: 'book-1',
        metadata: { title: 'Calculus Made Easy' },
      } as BookCatalogEntry,
      client,
      bridge: new ReaderPortBridge(),
      presentation: new PresentationStore(DEFAULT_READER_STYLE),
      surface: new SurfaceStore(),
      guidance: new GuidanceController(),
    }

    const { result } = renderHook(() => useStudy(options))

    await waitFor(() => expect(result.current.error).toContain('Local Study storage'))
    expect(result.current.commands?.bookId).toBe('book-1')
    expect(result.current.board?.id).toBe('board-book-1')

    act(() => result.current.retryLoad())

    await waitFor(() => expect(result.current.error).toBeUndefined())
    expect(result.current.commands?.studyBoard).toEqual(board)
    expect(client.getBoard).toHaveBeenCalledTimes(2)
  })

  it('keeps successful Study streams when lesson loading fails', async () => {
    const client = {
      getBoard: vi.fn().mockResolvedValue(board),
      listAnnotations: vi.fn().mockResolvedValue([
        {
          id: 'annotation-1',
          bookId: 'book-1',
          origin: 'user',
          range: { startCfi: 'a', endCfi: 'b', sectionIndex: 1, textFingerprint: 'x' },
          quote: 'Kept annotation',
          color: 'amber',
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
        },
      ]),
      listStudyItems: vi.fn().mockResolvedValue([
        {
          id: 'item-1',
          boardId: board.id,
          origin: 'user',
          revision: 1,
          payload: { kind: 'prose', text: 'Kept note' },
          sortOrder: 0,
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
        },
      ]),
      listStudyExperiences: vi.fn().mockRejectedValue(new Error('Lessons could not load')),
    } as unknown as StorageClient
    const options = {
      entry: { id: 'book-1', metadata: { title: 'Calculus Made Easy' } } as BookCatalogEntry,
      client,
      bridge: new ReaderPortBridge(),
      presentation: new PresentationStore(DEFAULT_READER_STYLE),
      surface: new SurfaceStore(),
      guidance: new GuidanceController(),
    }
    const { result } = renderHook(() => useStudy(options))
    await waitFor(() => expect(result.current.error).toContain('Lessons could not load'))
    expect(result.current.annotations).toHaveLength(1)
    expect(result.current.items).toHaveLength(1)
    expect(result.current.experiences).toEqual([])
  })
})
