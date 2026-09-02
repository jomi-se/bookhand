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

/** One image the diagnosis found, reported without being classified. */
export interface DiagnosedImage {
  readonly target: string
  readonly tex?: string
  readonly alt?: string
  readonly src?: string
  readonly className?: string
  readonly alone: boolean
}

export interface DiagnosedBlock {
  readonly target: string
  readonly tag: string
  readonly className?: string
  readonly text: string
  readonly images: number
}

export interface SectionDiagnosis {
  readonly sectionIndex: number
  readonly counts: {
    readonly blocks: number
    readonly headings: number
    readonly images: number
    readonly imagesWithTex: number
  }
  readonly images: readonly DiagnosedImage[]
  readonly blocks: readonly DiagnosedBlock[]
  readonly truncated: boolean
}

export interface SectionStylesheet {
  readonly name: string
  readonly css: string
}

export interface SectionSource {
  readonly sectionIndex: number
  readonly label?: string
  /** Packaged source: `src` and `href` are still package-relative. */
  readonly html: string
  readonly stylesheets: readonly SectionStylesheet[]
  readonly rewritten: boolean
  readonly bytes: number
}

export interface SectionRewriteResult {
  readonly sectionIndex: number
  readonly applied: boolean
  readonly sanitized: {
    readonly removedElements: Readonly<Record<string, number>>
    readonly removedAttributes: Readonly<Record<string, number>>
    readonly modified: boolean
  }
  /** True when the agent's stylesheet had rules removed. */
  readonly cssModified: boolean
  readonly before: { readonly elements: number; readonly bytes: number }
  readonly after: { readonly elements: number; readonly bytes: number }
}

/** What a person is told about a rewrite, in the agent's own words. */
export interface RewriteSummary {
  readonly sectionIndex: number
  readonly summary?: string
  readonly versions: number
}

/**
 * The remastering surface, as the command layer sees it.
 *
 * Optional on `ReaderAdapter` because a reader that cannot rewrite documents
 * is still a reader; the tools report the capability as unavailable rather
 * than failing.
 */
export interface DocumentRemasterPort {
  diagnoseSection(sectionIndex: number): Promise<SectionDiagnosis>
  getSectionSource(sectionIndex: number): Promise<SectionSource>
  rewriteSection(
    sectionIndex: number,
    html: string,
    options?: { readonly css?: string; readonly summary?: string },
  ): Promise<SectionRewriteResult>
  compileSectionMath(sectionIndex: number): Promise<RemasterReport>
  isShowingRewritten(): boolean
  hasRewrite(sectionIndex: number): boolean
  /** What the agent said it did, and how many revisions deep the section is. */
  describeRewrite(sectionIndex: number): RewriteSummary | undefined
  showRewritten(showRewritten: boolean): Promise<number>
  /** Step back one revision. */
  undoSection(sectionIndex: number): Promise<{ readonly versions: number } | undefined>
  /** Throw every revision away and return to the publisher's markup. */
  resetSection(sectionIndex: number): Promise<boolean>
}
