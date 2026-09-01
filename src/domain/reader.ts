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

export interface Passage {
  readonly text: string
  readonly range: BookRange
  readonly chapterBreadcrumb: readonly string[]
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

export interface ReaderStyle {
  readonly fontFamily?: string
  readonly fontSizePercent: number
  readonly lineHeight: number
  readonly measureCh: number
  readonly paragraphSpacingEm: number
  readonly theme: ReaderTheme
  readonly customCss?: string
}

/** What the reader needs in order to draw a stored highlight. */
export interface ReaderAnnotationMark {
  readonly id: string
  readonly cfi: string
  readonly color: string
}

export interface ReaderAdapter {
  open(blob: Blob): Promise<BookMetadata>
  close(): Promise<void>
  getToc(): readonly TocItem[]
  getLocation(): ReaderLocation
  getSelection(): ReaderSelection | null
  getVisibleContext(): Promise<Passage>
  getPassage(range: BookRange): Promise<Passage>
  listSections(): readonly BookSection[]
  getSectionSnapshot(sectionIndex: number): Promise<BookSectionSnapshot>
  navigate(target: BookTarget): Promise<void>
  applyStyle(style: ReaderStyle): void
  getStyle(): ReaderStyle
  resetStyle(): void
  renderAnnotations(marks: readonly ReaderAnnotationMark[]): void
}

