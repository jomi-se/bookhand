import type {
  BookMetadata,
  BookRange,
  BookSection,
  BookSectionSnapshot,
  BookTarget,
  Passage,
  ReaderAdapter,
  ReaderLocation,
  ReaderSelection,
  ReaderStyle,
  TocItem,
} from '../domain/reader.ts'
import {
  BOOK_OPEN_DEADLINE_MS,
  systemClock,
  withDeadline,
  type RuntimeClock,
} from '../runtime/deadlines.ts'
import {
  ReaderClosedError,
  ReaderNavigationError,
  ReaderNotOpenError,
  ReaderSectionLoadError,
} from './errors.ts'
import type {
  FoliateBook,
  FoliateModule,
  FoliateRelocation,
  FoliateResolvedTarget,
  FoliateTocItem,
  FoliateView,
} from './foliate-types.ts'
import { boundCustomCss } from './custom-css.ts'
import { localized, mapMetadata } from './metadata.ts'
import {
  extractDocumentText,
  fingerprintText,
  normalizeBookText,
  passageFromRange,
} from './text.ts'

export interface ReaderAdapterEvents {
  readonly onLocationChange?: (location: ReaderLocation) => void
  readonly onSelectionChange?: (selection: ReaderSelection | null) => void
  readonly onSectionError?: (error: ReaderSectionLoadError) => void
}

export interface ReaderFaultHooks {
  readonly beforeOpen?: (blob: Blob) => Promise<void>
  readonly beforeSectionLoad?: (sectionIndex: number) => Promise<void>
}

export interface FoliateReaderAdapterOptions extends ReaderAdapterEvents {
  readonly clock?: RuntimeClock
  readonly openDeadlineMs?: number
  readonly faults?: ReaderFaultHooks
}

interface FoliateReaderDependencies {
  readonly loadFoliate: () => Promise<FoliateModule>
}

interface ActiveReader {
  readonly book: FoliateBook
  readonly view: FoliateView
  readonly cleanups: readonly (() => void)[]
}

export const DEFAULT_READER_STYLE: ReaderStyle = {
  fontSizePercent: 100,
  lineHeight: 1.55,
  measureCh: 68,
  paragraphSpacingEm: 0.75,
  theme: 'publisher',
}

export class FoliateReaderAdapter implements ReaderAdapter {
  readonly #host: HTMLElement
  readonly #options: FoliateReaderAdapterOptions
  readonly #dependencies: FoliateReaderDependencies
  #active: ActiveReader | undefined
  #revision = 0
  #toc: readonly TocItem[] = []
  #sections: readonly BookSection[] = []
  #location: ReaderLocation | undefined
  #selection: ReaderSelection | null = null
  #style = DEFAULT_READER_STYLE
  #disposedViews = new WeakSet<FoliateView>()

  constructor(
    host: HTMLElement,
    options: FoliateReaderAdapterOptions = {},
    dependencies: FoliateReaderDependencies = { loadFoliate },
  ) {
    this.#host = host
    this.#options = options
    this.#dependencies = dependencies
  }

  async open(blob: Blob): Promise<BookMetadata> {
    const revision = ++this.#revision
    this.#destroyActive()
    this.#resetSnapshots()

    const operation = this.#openAtRevision(blob, revision)
    try {
      return await withDeadline(
        operation,
        this.#options.openDeadlineMs ?? BOOK_OPEN_DEADLINE_MS,
        this.#options.clock ?? systemClock,
      )
    } catch (error) {
      if (revision === this.#revision) {
        this.#revision += 1
        this.#destroyActive()
        this.#resetSnapshots()
      }
      throw error
    }
  }

  async close(): Promise<void> {
    this.#revision += 1
    this.#destroyActive()
    this.#resetSnapshots()
  }

  getToc(): readonly TocItem[] {
    return this.#toc
  }

  getLocation(): ReaderLocation {
    if (!this.#location) throw new ReaderNotOpenError()
    return this.#location
  }

  getSelection(): ReaderSelection | null {
    return this.#selection
  }

  async getVisibleContext(): Promise<Passage> {
    const { view } = this.#requireActive()
    const content = view.renderer.getContents()[0]
    if (!content) throw new ReaderNotOpenError()
    const visibleRange = view.lastLocation?.range
    if (visibleRange && normalizeBookText(visibleRange.toString())) {
      return passageFromRange(
        visibleRange,
        content.index,
        this.#chapterBreadcrumb(content.index),
        (range) => view.getCFI(content.index, range),
      )
    }
    const snapshot = await this.getSectionSnapshot(content.index)
    return {
      text: snapshot.text,
      range: {
        startCfi: snapshot.startCfi ?? view.getCFI(content.index),
        endCfi: snapshot.endCfi ?? view.getCFI(content.index),
        sectionIndex: content.index,
        textFingerprint: fingerprintText(snapshot.text),
      },
      chapterBreadcrumb: snapshot.chapterBreadcrumb,
    }
  }

  async getPassage(range: BookRange): Promise<Passage> {
    const { book, view } = this.#requireActive()
    const document = await this.#createSectionDocument(range.sectionIndex)
    const start = this.#resolveCfi(book, range.startCfi, document, range.sectionIndex)
    const end = this.#resolveCfi(book, range.endCfi, document, range.sectionIndex)
    const resolved = document.createRange()
    resolved.setStart(start.startContainer, start.startOffset)
    resolved.setEnd(end.endContainer, end.endOffset)
    const passage = passageFromRange(
      resolved,
      range.sectionIndex,
      this.#chapterBreadcrumb(range.sectionIndex),
      (value) => view.getCFI(range.sectionIndex, value),
    )
    if (passage.range.textFingerprint !== range.textFingerprint) {
      throw new Error(
        `Passage fingerprint mismatch: expected ${range.textFingerprint}, received ${passage.range.textFingerprint}`,
      )
    }
    return passage
  }

  listSections(): readonly BookSection[] {
    return this.#sections
  }

  async getSectionSnapshot(sectionIndex: number): Promise<BookSectionSnapshot> {
    const { view } = this.#requireActive()
    const document = await this.#createSectionDocument(sectionIndex)
    const text = extractDocumentText(document)
    const body = document.body ?? document.documentElement
    const range = document.createRange()
    range.selectNodeContents(body)
    const start = range.cloneRange()
    start.collapse(true)
    const end = range.cloneRange()
    end.collapse(false)
    return {
      sectionIndex,
      text,
      chapterBreadcrumb: this.#chapterBreadcrumb(sectionIndex),
      startCfi: view.getCFI(sectionIndex, start),
      endCfi: view.getCFI(sectionIndex, end),
    }
  }

  async navigate(target: BookTarget): Promise<void> {
    const active = this.#requireActive()
    this.#clearSelection()
    try {
      if (target.kind === 'relative') {
        await (target.direction === 'previous'
          ? active.view.renderer.prev()
          : active.view.renderer.next())
        return
      }

      const navigationTarget =
        target.kind === 'section' ? target.sectionIndex : target.kind === 'cfi' ? target.cfi : target.href
      const resolved = active.view.resolveNavigation(navigationTarget)
      if (!resolved || !this.#isValidSection(resolved.index)) {
        throw new ReaderNavigationError(target)
      }
      await this.#loadResolvedTarget(resolved)
      active.view.history.pushState(navigationTarget)
    } catch (error) {
      if (error instanceof ReaderSectionLoadError || error instanceof ReaderNavigationError) throw error
      throw new ReaderNavigationError(target, error)
    }
  }

  applyStyle(style: ReaderStyle): void {
    this.#style = structuredClone(style)
    this.#active?.view.renderer.setStyles?.(makeReaderCss(this.#style))
  }

  resetStyle(): void {
    this.applyStyle(DEFAULT_READER_STYLE)
  }

  async #openAtRevision(blob: Blob, revision: number): Promise<BookMetadata> {
    await this.#options.faults?.beforeOpen?.(blob)
    this.#assertCurrent(revision)
    const module = await this.#dependencies.loadFoliate()
    this.#assertCurrent(revision)
    const file =
      blob instanceof File
        ? blob
        : new File([blob], 'book.epub', { type: blob.type || 'application/epub+zip' })
    const book = await module.makeBook(file)
    if (revision !== this.#revision) {
      book.destroy?.()
      throw new ReaderClosedError()
    }

    blockPackagedScripts(book)
    const view = document.createElement('foliate-view') as FoliateView
    const cleanups = this.#listen(view)
    this.#active = { book, view, cleanups }
    this.#host.replaceChildren(view)
    try {
      await view.open(book)
      this.#assertCurrent(revision)
      this.#toc = mapToc(book.toc ?? [])
      this.#sections = mapSections(book.sections, this.#toc)
      view.renderer.setStyles?.(makeReaderCss(this.#style))
      await view.init({ showTextStart: true })
      this.#assertCurrent(revision)
      this.#captureRelocation(view.lastLocation)
      return await mapMetadata(book)
    } catch (error) {
      if (revision === this.#revision) this.#destroyActive()
      else this.#dispose({ book, view, cleanups })
      throw error
    }
  }

  #listen(view: FoliateView): readonly (() => void)[] {
    const sectionCleanups: (() => void)[] = []
    const onRelocate = (event: Event) => {
      // Relocation is not deselection. The paginator relocates whenever its box
      // changes, so clearing here would drop the reader's selection every time
      // a panel opened. Genuine deselection arrives through `selectionchange`,
      // and deliberate navigation clears the selection itself.
      this.#captureRelocation((event as CustomEvent<FoliateRelocation>).detail)
    }
    const onLoad = (event: Event) => {
      while (sectionCleanups.length) sectionCleanups.pop()?.()
      const detail = (event as CustomEvent<{ doc: Document; index: number }>).detail
      const onSelectionChange = () => this.#captureSelection(view, detail.doc, detail.index)
      detail.doc.addEventListener('selectionchange', onSelectionChange)
      sectionCleanups.push(() =>
        detail.doc.removeEventListener('selectionchange', onSelectionChange),
      )
    }
    view.addEventListener('relocate', onRelocate)
    view.addEventListener('load', onLoad)
    return [
      () => view.removeEventListener('relocate', onRelocate),
      () => view.removeEventListener('load', onLoad),
      () => {
        while (sectionCleanups.length) sectionCleanups.pop()?.()
      },
    ]
  }

  #captureRelocation(detail?: FoliateRelocation): void {
    if (!detail?.cfi) return
    const sectionIndex = detail.section?.current ?? this.#active?.view.renderer.getContents()[0]?.index ?? 0
    this.#location = {
      cfi: detail.cfi,
      sectionIndex,
      fraction: Number.isFinite(detail.fraction)
        ? Math.min(1, Math.max(0, detail.fraction ?? 0))
        : 0,
      chapterLabel: localized(detail.tocItem?.label) || this.#sectionLabel(sectionIndex),
      textFingerprint: detail.range ? fingerprintText(detail.range.toString()) : undefined,
    }
    this.#options.onLocationChange?.(structuredClone(this.#location))
  }

  #captureSelection(view: FoliateView, document: Document, sectionIndex: number): void {
    const selection = document.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) {
      this.#clearSelection()
      return
    }
    const range = selection.getRangeAt(0)
    const passage = passageFromRange(
      range,
      sectionIndex,
      this.#chapterBreadcrumb(sectionIndex),
      (value) => view.getCFI(sectionIndex, value),
    )
    if (!passage.text) {
      this.#clearSelection()
      return
    }
    this.#selection = { quote: passage.text, range: passage.range }
    this.#options.onSelectionChange?.(structuredClone(this.#selection))
  }

  async #createSectionDocument(sectionIndex: number): Promise<Document> {
    const { book } = this.#requireActive()
    if (!this.#isValidSection(sectionIndex)) throw new ReaderSectionLoadError(sectionIndex)
    try {
      await this.#options.faults?.beforeSectionLoad?.(sectionIndex)
      const create = book.sections[sectionIndex]?.createDocument
      if (!create) throw new Error('The EPUB section has no document source')
      return await create()
    } catch (error) {
      const wrapped = new ReaderSectionLoadError(sectionIndex, this.#sectionLabel(sectionIndex), error)
      this.#options.onSectionError?.(wrapped)
      throw wrapped
    }
  }

  async #loadResolvedTarget(target: FoliateResolvedTarget): Promise<void> {
    try {
      await this.#options.faults?.beforeSectionLoad?.(target.index)
      await this.#requireActive().view.renderer.goTo(target)
    } catch (error) {
      const wrapped = new ReaderSectionLoadError(target.index, this.#sectionLabel(target.index), error)
      this.#options.onSectionError?.(wrapped)
      throw wrapped
    }
  }

  #resolveCfi(book: FoliateBook, cfi: string, document: Document, sectionIndex: number): Range {
    const target = book.resolveCFI?.(cfi)
    if (!target || target.index !== sectionIndex || typeof target.anchor !== 'function') {
      throw new ReaderNavigationError({ kind: 'cfi', cfi })
    }
    const value = target.anchor(document)
    if (!(value instanceof Range)) throw new ReaderNavigationError({ kind: 'cfi', cfi })
    return value
  }

  #chapterBreadcrumb(sectionIndex: number): readonly string[] {
    const label = this.#sectionLabel(sectionIndex)
    return label ? [label] : []
  }

  #sectionLabel(sectionIndex: number): string | undefined {
    return this.#sections[sectionIndex]?.label
  }

  #isValidSection(sectionIndex: number): boolean {
    return Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < this.#sections.length
  }

  #requireActive(): ActiveReader {
    if (!this.#active) throw new ReaderNotOpenError()
    return this.#active
  }

  #assertCurrent(revision: number): void {
    if (revision !== this.#revision) throw new ReaderClosedError()
  }

  #clearSelection(): void {
    if (!this.#selection) return
    this.#selection = null
    this.#active?.view.deselect()
    this.#options.onSelectionChange?.(null)
  }

  #destroyActive(): void {
    const active = this.#active
    this.#active = undefined
    if (!active) {
      this.#host.replaceChildren()
      return
    }
    this.#dispose(active)
    this.#host.replaceChildren()
  }

  #dispose(active: ActiveReader): void {
    if (this.#disposedViews.has(active.view)) return
    this.#disposedViews.add(active.view)
    for (const cleanup of active.cleanups) cleanup()
    active.view.close()
    active.view.remove()
    active.book.destroy?.()
  }

  #resetSnapshots(): void {
    this.#toc = []
    this.#sections = []
    this.#location = undefined
    this.#selection = null
  }
}

async function loadFoliate(): Promise<FoliateModule> {
  return import('./foliate-module.ts')
}

function blockPackagedScripts(book: FoliateBook): void {
  book.transformTarget?.addEventListener('load', (event) => {
    const detail = (event as CustomEvent<{ isScript?: boolean; allow: boolean }>).detail
    if (detail.isScript) detail.allow = false
  })
}

function mapToc(items: readonly FoliateTocItem[], parent = 'toc'): readonly TocItem[] {
  return items.map((item, index) => {
    const id = `${parent}-${item.id ?? index}`
    const children = mapToc(item.subitems ?? [], id)
    const href = item.href ?? firstTocHref(children)
    return {
      id,
      label: localized(item.label) || `Section ${index + 1}`,
      href,
      target: href ? { kind: 'href' as const, href } : { kind: 'section' as const, sectionIndex: index },
      children,
    }
  })
}

function mapSections(sections: readonly FoliateBook['sections'][number][], toc: readonly TocItem[]): readonly BookSection[] {
  const labels = new Map<string, string>()
  const collect = (items: readonly TocItem[]) => {
    for (const item of items) {
      if (item.href) {
        const sectionHref = item.href.split('#')[0] ?? item.href
        if (!labels.has(sectionHref)) labels.set(sectionHref, item.label)
      }
      collect(item.children)
    }
  }
  collect(toc)
  return sections.map((section, index) => ({
    index,
    id: section.id,
    href: section.id ?? `section-${index}`,
    label: section.id ? labels.get(section.id) : undefined,
    linear: section.linear !== 'no',
  }))
}

function firstTocHref(items: readonly TocItem[]): string | undefined {
  for (const item of items) {
    if (item.href) return item.href
    const nested = firstTocHref(item.children)
    if (nested) return nested
  }
  return undefined
}

function makeReaderCss(style: ReaderStyle): string {
  const themes = {
    publisher: { background: 'transparent', foreground: 'inherit' },
    light: { background: '#fafafa', foreground: '#0f1115' },
    sepia: { background: '#f5eddd', foreground: '#342b20' },
    dark: { background: '#171717', foreground: '#ece8e1' },
  } as const
  const theme = themes[style.theme]
  const family = style.fontFamily ? JSON.stringify(style.fontFamily) : 'inherit'
  return `
    :root { color-scheme: ${style.theme === 'dark' ? 'dark' : 'light'}; background: ${theme.background}; color: ${theme.foreground}; }
    body { max-width: ${style.measureCh}ch; margin-inline: auto; font-family: ${family}; font-size: ${style.fontSizePercent}%; }
    p, li, blockquote, dd { line-height: ${style.lineHeight}; }
    p { margin-block: ${style.paragraphSpacingEm}em; }
    img, svg, video { max-inline-size: 100%; block-size: auto; }
    ${style.customCss ? boundCustomCss(style.customCss).css : ''}
  `
}
