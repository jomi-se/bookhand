/**
 * Document restoration, as the rest of the app sees it.
 *
 * The reader repairs broken section markup before Foliate renders it and
 * before Bookhand extracts it. These are the shapes that description travels
 * in: what was found, what was restored, and what was declined.
 */

export type RemasterKind = 'math'

/** Which of the two representations the reader is currently showing. */
export type RemasterMode = 'restored' | 'original'

/** One element the deterministic pass could not restore, and why. */
export interface RemasterResidue {
  /** Stable within a book: the id an agent names when proposing a repair. */
  readonly targetId: string
  readonly kind: RemasterKind
  /** The notation the book supplied, verbatim. */
  readonly source: string
  /** The book's own alternative text, which is all a reader has without this. */
  readonly alt?: string
  /** The construct that was declined, for example `\\underline`. */
  readonly reason: string
}

export interface RemasterReport {
  readonly found: number
  readonly restored: number
  readonly residues: readonly RemasterResidue[]
}

export interface SectionRemasterReport extends RemasterReport {
  readonly sectionIndex: number
}
