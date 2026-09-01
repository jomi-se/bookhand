import type { BookIdentifier, BookRange } from './reader.ts'

export type AnnotationColor = 'accent' | 'amber' | 'sky' | 'moss'

export const ANNOTATION_COLORS: readonly AnnotationColor[] = ['accent', 'amber', 'sky', 'moss']

export interface Annotation {
  readonly id: string
  readonly bookId: BookIdentifier
  readonly range: BookRange
  readonly quote: string
  readonly color: AnnotationColor
  readonly note?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type StudyBoardView = 'docked' | 'expanded'

export interface StudyBoard {
  readonly id: string
  readonly bookId: BookIdentifier
  readonly title: string
  readonly view: StudyBoardView
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Native blocks cover the common study shapes. Every payload is plain
 * serializable data so the same item can be created by a person or by an agent
 * through WebMCP without a second code path.
 */
export type StudyItemPayload =
  | { readonly kind: 'prose'; readonly text: string }
  | { readonly kind: 'quotation'; readonly text: string; readonly attribution?: string }
  | { readonly kind: 'equation'; readonly expression: string; readonly caption?: string }
  | { readonly kind: 'steps'; readonly title?: string; readonly steps: readonly string[] }
  | { readonly kind: 'question'; readonly prompt: string; readonly answer?: string }

export type StudyItemKind = StudyItemPayload['kind']

export const STUDY_ITEM_KINDS: readonly StudyItemKind[] = [
  'prose',
  'quotation',
  'equation',
  'steps',
  'question',
]

export interface StudyItem {
  readonly id: string
  readonly boardId: string
  readonly payload: StudyItemPayload
  /** Where in the book this came from, so the reader can always return to it. */
  readonly sourceRange?: BookRange
  readonly sourceLabel?: string
  readonly sortOrder: number
  readonly createdAt: string
  readonly updatedAt: string
}
