import type { BookIdentifier, BookRange } from './reader.ts'
import type { MutationOrigin } from './provenance.ts'
import type { SourceLink } from './source.ts'

export type AnnotationColor = 'accent' | 'amber' | 'sky' | 'moss'

export const ANNOTATION_COLORS: readonly AnnotationColor[] = ['accent', 'amber', 'sky', 'moss']

export interface Annotation {
  readonly id: string
  readonly origin: MutationOrigin
  readonly actionGroupId?: string
  readonly bookId: BookIdentifier
  readonly range: BookRange
  readonly quote: string
  readonly source?: SourceLink
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
  readonly origin: MutationOrigin
  readonly actionGroupId?: string
  /**
   * How many times this item has been written. Undo names the revision it means
   * to take back, so an undo arriving after someone else has edited the block
   * is refused instead of quietly discarding the newer work.
   */
  readonly revision: number
  readonly payload: StudyItemPayload
  /** Where in the book this came from, so the reader can always return to it. */
  readonly sourceRange?: BookRange
  readonly sourceLabel?: string
  readonly source?: SourceLink
  readonly sortOrder: number
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * One attempt to write a study item, and the authority behind it.
 *
 * The person sitting at the machine may do anything to their own board. An
 * agent may add blocks and revise the blocks it added, and nothing else — it
 * cannot edit what the person wrote, and it has no delete. That asymmetry is
 * the point: agent work must always be something the person can review and take
 * back, never something that quietly replaces what they did themselves.
 */
export interface StudyMutation {
  readonly operation: 'create' | 'update'
  readonly origin: MutationOrigin
  readonly bookId: BookIdentifier
  /**
   * The caller's own name for this action. A retry carrying the same token and
   * the same payload returns the first result instead of writing twice; the
   * same token with a different payload is rejected, because it is a different
   * action wearing a used name.
   */
  readonly actionToken: string
  /** Correlates writes from one intent for provenance; legacy Undo is per item. */
  readonly actionGroupId: string
  /** An agent must present the token it was given when it created the item. */
  readonly updateToken?: string
}

export interface StudyItemCommit {
  readonly item: StudyItem
  readonly prior?: StudyItem
  /** Returned once, to an agent creating an item. Never listed back out. */
  readonly updateToken?: string
  /** True when this was a retry that wrote nothing new. */
  readonly replayed: boolean
}

/**
 * A composed teaching artifact. Unlike an action group, this is durable
 * learning structure: its title and block order belong together and are
 * written atomically.
 */
export interface StudyExperienceBlock {
  readonly id: string
  readonly payload: StudyItemPayload
}

export interface StudyExperience {
  readonly id: string
  readonly boardId: string
  readonly origin: MutationOrigin
  readonly actionGroupId: string
  readonly revision: number
  readonly title: string
  readonly blocks: readonly StudyExperienceBlock[]
  readonly sourceRange?: BookRange
  readonly sourceLabel?: string
  readonly source?: SourceLink
  readonly sortOrder: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface StudyExperienceMutation {
  readonly origin: MutationOrigin
  readonly bookId: BookIdentifier
  readonly actionToken: string
  readonly actionGroupId: string
}

export interface StudyExperienceCommit {
  readonly experience: StudyExperience
  readonly replayed: boolean
}
