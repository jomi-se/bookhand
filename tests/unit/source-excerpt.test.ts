import { describe, expect, it } from 'vitest'

import type { Passage } from '../../src/domain/index.ts'
import {
  createSourceExcerpt,
  SOURCE_EXCERPT_MAX_CHARACTERS,
  SOURCE_SEGMENT_MAX_CHARACTERS,
  SOURCE_SEGMENT_MAX_COUNT,
} from '../../src/domain/source.ts'

const passage: Passage = {
  text: 'Let dy/dx describe the slope.',
  range: {
    startCfi: 'start',
    endCfi: 'end',
    sectionIndex: 2,
    textFingerprint: 'fnv1a-source',
  },
  chapterBreadcrumb: ['Chapter X'],
  segments: [
    { kind: 'text', text: 'Let' },
    { kind: 'math', text: 'dy/dx' },
    { kind: 'text', text: 'describe the slope.' },
  ],
}

describe('canonical source excerpts', () => {
  it('binds canonical text, typed segments, range, book, and extraction version', () => {
    expect(createSourceExcerpt('book-1', passage)).toEqual({
      schemaVersion: 1,
      bookId: 'book-1',
      range: passage.range,
      extractionVersion: 1,
      text: passage.text,
      textFingerprint: passage.range.textFingerprint,
      segments: passage.segments,
      chapterBreadcrumb: ['Chapter X'],
    })
  })

  it('splits a long semantic segment without changing its order or kind', () => {
    const long = 'x'.repeat(SOURCE_SEGMENT_MAX_CHARACTERS + 1)
    const excerpt = createSourceExcerpt('book-1', {
      ...passage,
      text: long,
      segments: [{ kind: 'math', text: long }],
    })
    expect(excerpt.segments).toEqual([
      { kind: 'math', text: 'x'.repeat(SOURCE_SEGMENT_MAX_CHARACTERS) },
      { kind: 'math', text: 'x' },
    ])
  })

  it('rejects excerpts and segment sets outside the persisted bounds', () => {
    expect(() =>
      createSourceExcerpt('book-1', {
        ...passage,
        text: 'x'.repeat(SOURCE_EXCERPT_MAX_CHARACTERS + 1),
      }),
    ).toThrow(/too large/)
    expect(() =>
      createSourceExcerpt('book-1', {
        ...passage,
        text: 'x'.repeat(SOURCE_SEGMENT_MAX_COUNT + 1),
        segments: Array.from({ length: SOURCE_SEGMENT_MAX_COUNT + 1 }, () => ({
          kind: 'text' as const,
          text: 'x',
        })),
      }),
    ).toThrow(/too many semantic segments/)
  })
})
