export type BookIdentifier = string

export interface BookAuthor {
  readonly name: string
  readonly sortAs?: string
}

export interface BookMetadata {
  readonly title: string
  readonly subtitle?: string
  readonly authors: readonly BookAuthor[]
  readonly language?: string
  readonly publisher?: string
  readonly description?: string
  readonly published?: string
  readonly modified?: string
  readonly identifier?: string
  readonly cover?: {
    readonly mediaType: string
    readonly bytes: Uint8Array
  }
}

export interface BookRange {
  readonly startCfi: string
  readonly endCfi: string
  /**
   * The single range CFI spanning start to end. Highlights are anchored by this
   * rather than by the two collapsed endpoints, because the rendering engine
   * resolves one range CFI to the run of text it must draw over.
   */
  readonly cfi?: string
  readonly sectionIndex: number
  readonly textFingerprint: string
}

export type BookTarget =
  | { readonly kind: 'cfi'; readonly cfi: string }
  | { readonly kind: 'href'; readonly href: string }
  | { readonly kind: 'section'; readonly sectionIndex: number }
  | { readonly kind: 'relative'; readonly direction: 'previous' | 'next' }

export interface TocItem {
  readonly id: string
  readonly label: string
  readonly href?: string
  readonly target: BookTarget
  readonly children: readonly TocItem[]
}

export interface ReaderLocation {
  readonly cfi: string
  readonly sectionIndex: number
  readonly fraction: number
  readonly chapterLabel?: string
  readonly textFingerprint?: string
}

export interface ReaderSelection {
  readonly quote: string
  readonly range: BookRange
}

export interface PassageSegment {
  readonly kind: 'text' | 'math' | 'figure'
  readonly text: string
}

export interface Passage {
  readonly text: string
  readonly range: BookRange
  readonly chapterBreadcrumb: readonly string[]
  readonly segments?: readonly PassageSegment[]
}

export interface BookSection {
  readonly index: number
  readonly id?: string
  readonly href: string
  readonly label?: string
  readonly linear: boolean
}

export interface BookSectionSnapshot {
  readonly sectionIndex: number
  readonly text: string
  readonly chapterBreadcrumb: readonly string[]
  readonly startCfi?: string
  readonly endCfi?: string
}

export type ReaderTheme = 'publisher' | 'light' | 'sepia' | 'dark'
export type ReaderPageLayout = 'auto' | 'single' | 'spread'

export interface ReaderStyle {
  readonly fontFamily?: string
  readonly fontSizePercent: number
  readonly lineHeight: number
  readonly measureCh: number
  readonly paragraphSpacingEm: number
  readonly theme: ReaderTheme
  readonly pageLayout?: ReaderPageLayout
  readonly customCss?: string
}

/** What the reader needs in order to draw a stored highlight. */
export interface ReaderAnnotationMark {
  readonly id: string
  readonly cfi: string
  readonly color: string
}

export type TutorCueKind = 'highlight' | 'underline' | 'outline'

/** A runtime-only visual pointer. It is never stored as an annotation. */
export interface TutorCue {
  readonly kind: TutorCueKind
}

/**
 * What the reader needs to know about a book beyond its bytes.
 *
 * Optional throughout: a reader given neither an identity nor a store opens
 * the book and reads it, and simply forgets any rewrite when the page reloads.
 */
export interface ReaderOpenOptions {
  /** The library's id for this book, which saved rewrites are filed under. */
  readonly bookId?: string
  readonly rewrites?: import('./remaster.ts').RemasterStore
}

export interface ReaderAdapter {
  open(blob: Blob, options?: ReaderOpenOptions): Promise<BookMetadata>
  close(): Promise<void>
  getToc(): readonly TocItem[]
  getLocation(): ReaderLocation
  getSelection(): ReaderSelection | null
  getVisibleContext(): Promise<Passage>
  getPassage(range: BookRange): Promise<Passage>
  /** Resolve the stored location without requiring its old fingerprint to match. */
  getPassageAtLocation?(range: BookRange): Promise<Passage>
  listSections(): readonly BookSection[]
  getSectionSnapshot(sectionIndex: number): Promise<BookSectionSnapshot>
  /** Serializable, exact-CFI chunks for the local lexical index. */
  getSectionChunks(sectionIndex: number): Promise<readonly import('./search.ts').SectionChunk[]>
  navigate(target: BookTarget, navigationId?: number): Promise<void>
  applyStyle(style: ReaderStyle): void
  getStyle(): ReaderStyle
  resetStyle(): void
  renderAnnotations(marks: readonly ReaderAnnotationMark[]): void
  /** Runtime-only verified tutor target, visually distinct from durable annotations. */
  setTutorTarget?(passage: Passage | null, cue?: TutorCue): void
  /**
   * Reading and rewriting the book's own markup. Optional: a reader that
   * cannot remaster documents is still a reader.
   */
  readonly remaster?: import('./remaster.ts').DocumentRemasterPort
}
