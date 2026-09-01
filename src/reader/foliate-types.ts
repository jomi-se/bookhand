interface FoliateContributor {
  readonly name?: string | Readonly<Record<string, string>>
  readonly sortAs?: string | Readonly<Record<string, string>>
}

export interface FoliateTocItem {
  readonly id?: string | number
  readonly label?: string | Readonly<Record<string, string>>
  readonly href?: string
  readonly subitems?: readonly FoliateTocItem[]
}

export interface FoliateSection {
  readonly id?: string
  readonly linear?: string
  readonly cfi?: string
  readonly createDocument?: () => Promise<Document>
}

export interface FoliateBook {
  readonly metadata?: {
    readonly title?: string | Readonly<Record<string, string>>
    readonly subtitle?: string | Readonly<Record<string, string>>
    readonly author?: string | FoliateContributor | readonly (string | FoliateContributor)[]
    readonly language?: string | readonly string[]
    readonly publisher?: string | FoliateContributor | readonly FoliateContributor[]
    readonly description?: string
    readonly published?: string
    readonly modified?: string
    readonly identifier?: string
  }
  readonly toc?: readonly FoliateTocItem[]
  readonly sections: readonly FoliateSection[]
  readonly transformTarget?: EventTarget
  getCover?(): Promise<Blob | null> | Blob | null
  resolveCFI?(cfi: string): FoliateResolvedTarget
  resolveHref?(href: string): FoliateResolvedTarget | null
  destroy?(): void
}

export interface FoliateResolvedTarget {
  readonly index: number
  readonly anchor?: number | ((document: Document) => Node | Range)
}

export interface FoliateRelocation {
  readonly cfi?: string
  readonly range?: Range
  readonly fraction?: number
  readonly section?: { readonly current?: number }
  readonly tocItem?: FoliateTocItem
}

export interface FoliateRenderer extends HTMLElement {
  goTo(target: FoliateResolvedTarget): Promise<void>
  prev(distance?: number): Promise<void>
  next(distance?: number): Promise<void>
  getContents(): readonly {
    readonly index: number
    readonly doc: Document
  }[]
  setStyles?(styles: string): void
}

export interface FoliateView extends HTMLElement {
  book: FoliateBook
  renderer: FoliateRenderer
  history: { pushState(target: unknown): void }
  lastLocation?: FoliateRelocation
  open(book: FoliateBook): Promise<void>
  init(options: { lastLocation?: string; showTextStart: boolean }): Promise<void>
  close(): void
  getCFI(index: number, range?: Range): string
  resolveNavigation(target: string | number): FoliateResolvedTarget | undefined
  deselect(): void
}

export interface FoliateModule {
  makeBook(file: File): Promise<FoliateBook>
}
