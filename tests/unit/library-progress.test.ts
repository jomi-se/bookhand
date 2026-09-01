import { describe, expect, it } from 'vitest'

import type { BookCatalogEntry, ReadingState } from '../../src/domain/index.ts'
import {
  authorLine,
  hasMeaningfulProgress,
  lastReadLabel,
  progressPercent,
  relativeTime,
  splitTitle,
} from '../../src/library/progress.ts'

function entry(state?: Partial<ReadingState> & { fraction?: number; sectionIndex?: number }) {
  const base: BookCatalogEntry = {
    id: 'book',
    metadata: { title: 'A Book', authors: [{ name: 'Ada' }] },
    importedAt: '2026-09-01T00:00:00.000Z',
    provenance: { kind: 'imported', originalFileName: 'a.epub' },
  }
  if (!state) return base
  return {
    ...base,
    readingState: {
      bookId: 'book',
      location: {
        cfi: 'x',
        sectionIndex: state.sectionIndex ?? 0,
        fraction: state.fraction ?? 0,
        chapterLabel: state.location?.chapterLabel,
      },
      style: {
        fontSizePercent: 100,
        lineHeight: 1.5,
        measureCh: 68,
        paragraphSpacingEm: 0.75,
        theme: 'publisher' as const,
      },
      updatedAt: state.updatedAt ?? '2026-09-01T00:00:00.000Z',
    },
  }
}

describe('truthful continuation state', () => {
  it('does not claim progress for a book that was opened but never moved through', () => {
    const opened = entry({ fraction: 0, sectionIndex: 0 })
    expect(hasMeaningfulProgress(opened)).toBe(false)
    expect(progressPercent(opened)).toBeUndefined()
    expect(lastReadLabel(opened)).toBeUndefined()
  })

  it('claims progress once the reader is genuinely somewhere in the book', () => {
    expect(hasMeaningfulProgress(entry({ fraction: 0.28 }))).toBe(true)
    expect(progressPercent(entry({ fraction: 0.28 }))).toBe(28)
    expect(hasMeaningfulProgress(entry({ fraction: 0, sectionIndex: 3 }))).toBe(true)
  })

  it('has no progress at all for a book with no reading state', () => {
    expect(hasMeaningfulProgress(entry())).toBe(false)
  })

  it('names the chapter and how long ago it was read', () => {
    const now = new Date('2026-09-03T00:00:00.000Z')
    const reading = entry({
      fraction: 0.28,
      updatedAt: '2026-09-01T00:00:00.000Z',
      location: { chapterLabel: 'Chapter X' } as ReadingState['location'],
    })
    expect(lastReadLabel(reading, now)).toBe('Chapter X · 2 days ago')
  })
})

describe('catalog presentation', () => {
  it('separates a catalogue subtitle carried inside one title field', () => {
    expect(
      splitTitle({ title: 'Calculus Made Easy / Being a very-simplest introduction', authors: [] }),
    ).toEqual({
      title: 'Calculus Made Easy',
      subtitle: 'Being a very-simplest introduction',
    })
  })

  it('leaves an ordinary title untouched', () => {
    expect(splitTitle({ title: 'The Tiny Book of Slopes', authors: [] })).toEqual({
      title: 'The Tiny Book of Slopes',
      subtitle: undefined,
    })
  })

  it('names authors without inventing one', () => {
    expect(authorLine(entry())).toBe('Ada')
    expect(
      authorLine({ ...entry(), metadata: { title: 'x', authors: [] } }),
    ).toBe('Unknown author')
    expect(
      authorLine({
        ...entry(),
        metadata: { title: 'x', authors: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] },
      }),
    ).toBe('A and 2 others')
  })

  it('reads recent activity as recent', () => {
    const now = new Date('2026-09-01T00:00:30.000Z')
    expect(relativeTime('2026-09-01T00:00:00.000Z', now)).toBe('just now')
  })
})
