import type { BookRange, Passage, PassageSegment } from './reader.ts'

/** Bump whenever accessible book serialization changes meaning. */
export const SOURCE_EXTRACTION_VERSION = 1
export const SOURCE_EXCERPT_MAX_CHARACTERS = 32_000
export const SOURCE_SEGMENT_MAX_CHARACTERS = 8_000
export const SOURCE_SEGMENT_MAX_COUNT = 64

export type SourceOwnership = 'derived' | 'authored'

export interface SourceExcerpt {
  readonly schemaVersion: 1
  readonly bookId: string
  readonly range: BookRange
  readonly extractionVersion: number
  readonly text: string
  readonly textFingerprint: string
  readonly segments: readonly PassageSegment[]
  readonly chapterBreadcrumb: readonly string[]
}

export type SourceLink =
  | {
      readonly status: 'resolved'
      readonly ownership: SourceOwnership
      readonly excerpt: SourceExcerpt
    }
  | {
      readonly status: 'pending-legacy'
      readonly ownership: SourceOwnership
    }
  | {
      readonly status: 'stale'
      readonly ownership: SourceOwnership
      readonly reason: 'range-unresolved' | 'book-unavailable'
    }

export function createSourceExcerpt(bookId: string, passage: Passage): SourceExcerpt {
  if (passage.text.length > SOURCE_EXCERPT_MAX_CHARACTERS) {
    throw new Error(
      `That source passage is too large to keep (${passage.text.length} characters; maximum ${SOURCE_EXCERPT_MAX_CHARACTERS}).`,
    )
  }
  const sourceSegments = passage.segments ?? [{ kind: 'text' as const, text: passage.text }]
  const segments = sourceSegments.flatMap(splitSegment)
  if (segments.length > SOURCE_SEGMENT_MAX_COUNT) {
    throw new Error(
      `That source passage has too many semantic segments (${segments.length}; maximum ${SOURCE_SEGMENT_MAX_COUNT}).`,
    )
  }
  return {
    schemaVersion: 1,
    bookId,
    range: passage.range,
    extractionVersion: SOURCE_EXTRACTION_VERSION,
    text: passage.text,
    textFingerprint: passage.range.textFingerprint,
    segments,
    chapterBreadcrumb: passage.chapterBreadcrumb,
  }
}

function splitSegment(segment: PassageSegment): readonly PassageSegment[] {
  if (segment.text.length <= SOURCE_SEGMENT_MAX_CHARACTERS) return [segment]
  const result: PassageSegment[] = []
  for (let start = 0; start < segment.text.length; start += SOURCE_SEGMENT_MAX_CHARACTERS) {
    result.push({
      kind: segment.kind,
      text: segment.text.slice(start, start + SOURCE_SEGMENT_MAX_CHARACTERS),
    })
  }
  return result
}
