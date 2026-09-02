import type {
  BookMetadata,
  BookRange,
  ReaderAnnotationMark,
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
  DeadlineExceededError,
  READER_NAVIGATION_DEADLINE_MS,
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
  FoliateDrawDetail,
  FoliateDrawFunction,
  FoliateModule,
  FoliateRelocation,
  FoliateResolvedTarget,
  FoliateTocItem,
  FoliateView,
} from './foliate-types.ts'
import { boundCustomCss } from './custom-css.ts'
import { isInteractiveTarget, tapZone, type TapZone } from './tap-intent.ts'
import { localized, mapMetadata } from './metadata.ts'
import {
  extractDocumentText,
  fingerprintText,
  normalizeBookText,
  passageFromAnchoredRange,
  passageFromRange,
} from './text.ts'
import { buildSectionChunks } from './chunking.ts'

export interface ReaderAdapterEvents {
  /** Return false to reject a retired relocation from the adapter snapshot. */
  readonly onLocationChange?: (location: ReaderLocation, navigationId?: number) => boolean | void
  readonly onSelectionChange?: (selection: ReaderSelection | null) => void
  readonly onSectionError?: (error: ReaderSectionLoadError) => void
  /** A drawn highlight was activated in the book. */
  readonly onAnnotationActivate?: (annotationId: string) => void
  /**
   * A deliberate tap landed on the book. The host decides what each zone
   * means, so the reading surface stays free of policy.
   */
  readonly onTap?: (zone: TapZone) => void
  /** Fired before Foliate handles a swipe or an in-book link. */
  readonly onNavigationIntent?: () => void
  /** Routes in-book links through the same serialized learner navigation path. */
  readonly onNavigationRequest?: (target: BookTarget) => void
}

export interface ReaderFaultHooks {
  readonly beforeOpen?: (blob: Blob) => Promise<void>
  readonly beforeSectionLoad?: (sectionIndex: number) => Promise<void>
}

export interface FoliateReaderAdapterOptions extends ReaderAdapterEvents {
  readonly clock?: RuntimeClock
  readonly openDeadlineMs?: number
  readonly navigationDeadlineMs?: number
  readonly faults?: ReaderFaultHooks
  /** Supplied only by the browser test harness until W9 owns production cues. */
  readonly tutorOverlayRenderer?: FoliateDrawFunction
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
  #marks: readonly ReaderAnnotationMark[] = []
  #overlayer: FoliateModule['Overlayer']
  #disposedViews = new WeakSet<FoliateView>()
  #tutorTarget: Passage | undefined
  #tutorGeneration = 0
  #navigationQueue: Promise<void> = Promise.resolve()
  #activeNavigation: {
    readonly operationId: number
    readonly id?: number
    readonly learnerEpoch: number
    readonly relative: boolean
  } | undefined
  #navigationSequence = 0
  #learnerIntentEpoch = 0
  readonly #relocationProvenance: (number | undefined)[] = []
  #suppressRelocations = 0

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
    if (visibleRange) {
      const visible = passageFromRange(
        visibleRange,
        content.index,
        this.#chapterBreadcrumb(content.index),
        (range) => view.getCFI(content.index, range),
      )
      if (normalizeBookText(visible.text)) return visible
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
    const passage = await this.getPassageAtLocation(range)
    if (passage.range.textFingerprint !== range.textFingerprint) {
      throw new Error(
        `Passage fingerprint mismatch: expected ${range.textFingerprint}, received ${passage.range.textFingerprint}`,
      )
    }
    return passage
  }

  async getPassageAtLocation(range: BookRange): Promise<Passage> {
    const { book, view } = this.#requireActive()
    const document = await this.#createSectionDocument(range.sectionIndex)
    const start = this.#resolveCfi(book, range.startCfi, document, range.sectionIndex)
    const end = this.#resolveCfi(book, range.endCfi, document, range.sectionIndex)
    const resolved = document.createRange()
    resolved.setStart(start.startContainer, start.startOffset)
    resolved.setEnd(end.endContainer, end.endOffset)
    return passageFromAnchoredRange(
      resolved,
      range.sectionIndex,
      this.#chapterBreadcrumb(range.sectionIndex),
      (value) => view.getCFI(range.sectionIndex, value),
    )
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

  async getSectionChunks(sectionIndex: number) {
    const { view } = this.#requireActive()
    const document = await this.#createSectionDocument(sectionIndex)
    const title = this.#sectionLabel(sectionIndex) ?? `Section ${sectionIndex + 1}`
    const chunks = buildSectionChunks(
      document,
      sectionIndex,
      title,
      (range) => view.getCFI(sectionIndex, range),
    )
    // Do not persist an anchor merely because Foliate emitted it. Resolve it
    // through a fresh section document and retain only exact round trips.
    for (const chunk of chunks) {
      const resolved = await this.getPassageAtLocation(chunk.range)
      if (
        resolved.range.textFingerprint !== chunk.range.textFingerprint ||
        !resolved.text.includes(chunk.text)
      ) {
        throw new Error(`Section ${sectionIndex + 1} produced an unstable search anchor.`)
      }
    }
    return chunks
  }

  async navigate(target: BookTarget, navigationId?: number): Promise<void> {
    const revision = this.#revision
    const operation = this.#navigationQueue.then(async () => {
      if (revision !== this.#revision) throw new ReaderClosedError()
      const active = this.#requireActive()
      const operationId = ++this.#navigationSequence
      this.#clearSelection()
      this.#activeNavigation = {
        operationId,
        ...(navigationId === undefined ? {} : { id: navigationId }),
        learnerEpoch: this.#learnerIntentEpoch,
        relative: target.kind === 'relative',
      }
      try {
        await withDeadline(
          this.#navigateActive(active, target),
          this.#options.navigationDeadlineMs ?? READER_NAVIGATION_DEADLINE_MS,
          this.#options.clock ?? systemClock,
        )
      } catch (error) {
        if (error instanceof DeadlineExceededError) {
          if (this.#activeNavigation?.operationId === operationId) {
            this.#activeNavigation = undefined
          }
          await this.#recoverStalledView(active, revision)
        }
        if (error instanceof ReaderSectionLoadError || error instanceof ReaderNavigationError) throw error
        throw new ReaderNavigationError(target, error)
      } finally {
        if (this.#activeNavigation?.operationId === operationId) {
          this.#activeNavigation = undefined
        }
      }
    })
    this.#navigationQueue = operation.catch(() => undefined)
    return operation
  }

  async #navigateActive(active: ActiveReader, target: BookTarget): Promise<void> {
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
    await this.#loadResolvedTarget(active, resolved)
    active.view.history.pushState(navigationTarget)
  }

  applyStyle(style: ReaderStyle): void {
    this.#style = structuredClone(style)
    this.#active?.view.renderer.setStyles?.(makeReaderCss(this.#style, this.#shellPalette()))
  }

  getStyle(): ReaderStyle {
    return structuredClone(this.#style)
  }

  resetStyle(): void {
    this.applyStyle(DEFAULT_READER_STYLE)
  }

  /**
   * Draws stored highlights over the book. Marks whose CFI no longer resolves
   * are skipped rather than throwing: a book that changed underneath an
   * annotation should still be readable.
   */
  renderAnnotations(marks: readonly ReaderAnnotationMark[]): void {
    const previous = this.#marks
    this.#marks = marks
    const view = this.#active?.view
    if (!view?.addAnnotation) return

    const kept = new Set(marks.map((mark) => mark.cfi))
    for (const stale of previous) {
      if (!kept.has(stale.cfi)) void view.deleteAnnotation?.({ value: stale.cfi })?.catch?.(noop)
    }
    for (const mark of marks) {
      void view.addAnnotation({ value: mark.cfi, color: mark.color })?.catch?.(noop)
    }
  }

  setTutorTarget(passage: Passage | null): void {
    this.#tutorGeneration += 1
    this.#clearTutorOverlay()
    this.#tutorTarget = passage ? structuredClone(passage) : undefined
    if (passage) void this.#renderTutorOverlay(this.#tutorGeneration)
  }

  async #openAtRevision(blob: Blob, revision: number): Promise<BookMetadata> {
    await this.#options.faults?.beforeOpen?.(blob)
    this.#assertCurrent(revision)
    const module = await this.#dependencies.loadFoliate()
    this.#overlayer = module.Overlayer
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
    // Foliate's defaults are desktop-shaped: 48px of margin top and bottom,
    // and no page-turn animation at all. On a phone that spent 96px of a 839px
    // screen on nothing, and made every turn snap without transition, which
    // reads as unresponsive rather than fast.
    const cleanups = [...this.#listen(view), configureForViewport(view)]
    this.#active = { book, view, cleanups }
    this.#host.replaceChildren(view)
    try {
      await view.open(book)
      this.#assertCurrent(revision)
      cleanups.push(this.#listenForRendererRelocations(view))
      this.#toc = mapToc(book.toc ?? [])
      this.#sections = mapSections(book.sections, this.#toc)
      view.renderer.setStyles?.(makeReaderCss(this.#style, this.#shellPalette()))
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
      // Taps have to be caught inside the section document: Foliate binds its
      // own touch handling there, and events in the book's iframe never reach
      // the host element.
      sectionCleanups.push(...this.#listenForTaps(detail.doc))
    }
    const onDrawAnnotation = (event: Event) => {
      const detail = (event as CustomEvent<FoliateDrawDetail>).detail
      const overlayer = this.#overlayer
      if (!overlayer) return
      detail.draw(overlayer.highlight, { color: detail.annotation.color ?? 'currentColor' })
    }
    const onShowAnnotation = (event: Event) => {
      const value = (event as CustomEvent<{ value: string }>).detail.value
      const mark = this.#marks.find((candidate) => candidate.cfi === value)
      if (mark) this.#options.onAnnotationActivate?.(mark.id)
    }
    // A newly rendered section has a fresh overlay, so stored marks are drawn
    // again rather than only existing on the section that was open when saved.
    const onCreateOverlay = () => {
      this.renderAnnotations(this.#marks)
      const generation = this.#tutorGeneration
      queueMicrotask(() => void this.#renderTutorOverlay(generation))
    }
    const onLink = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href
      if (href && this.#options.onNavigationRequest) {
        event.preventDefault()
        this.#learnerIntentEpoch += 1
        this.#options.onNavigationRequest({ kind: 'href', href })
        return
      }
      this.#learnerIntentEpoch += 1
      this.#options.onNavigationIntent?.()
    }

    view.addEventListener('relocate', onRelocate)
    view.addEventListener('load', onLoad)
    view.addEventListener('draw-annotation', onDrawAnnotation)
    view.addEventListener('show-annotation', onShowAnnotation)
    view.addEventListener('create-overlay', onCreateOverlay)
    view.addEventListener('link', onLink)
    return [
      () => view.removeEventListener('relocate', onRelocate),
      () => view.removeEventListener('load', onLoad),
      () => view.removeEventListener('draw-annotation', onDrawAnnotation),
      () => view.removeEventListener('show-annotation', onShowAnnotation),
      () => view.removeEventListener('create-overlay', onCreateOverlay),
      () => view.removeEventListener('link', onLink),
      () => {
        while (sectionCleanups.length) sectionCleanups.pop()?.()
      },
    ]
  }

  /**
   * Turn touch activity in one section document into tap intent.
   *
   * Taps have to be caught here, in capture phase, for two reasons. Events in
   * the book's iframe never reach the host element, so this is the only place
   * they exist. And Foliate's own `touchend` handler on this same document
   * calls `snap(0, 0)`, which resolves to the current page and then — because
   * that page is page 0 or the last page — navigates to the adjacent section.
   * So on a phone, *any* tap taken while on a section's first page jumps
   * backwards a whole section. Capture on the document runs before the target,
   * and therefore before Foliate's own listener bubbles back, which is what
   * lets a recognized tap stop it.
   *
   * Only a recognized tap is stopped. Everything else — swipes, presses,
   * selection, a tap on a link — is left exactly as Foliate had it.
   */
  #listenForTaps(doc: Document): readonly (() => void)[] {
    let start: { x: number; y: number; at: number; hadSelection: boolean } | undefined
    let swipeAnnounced = false

    const onStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      const selection = doc.getSelection()
      start =
        event.touches.length > 1 || !touch
          ? undefined
          : {
              x: touch.clientX,
              y: touch.clientY,
              at: event.timeStamp,
              hadSelection: Boolean(selection && !selection.isCollapsed),
            }
      swipeAnnounced = false
    }

    const onMove = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!start || !touch || swipeAnnounced) return
      if (Math.abs(touch.clientX - start.x) < 12) return
      swipeAnnounced = true
      this.#learnerIntentEpoch += 1
      this.#options.onNavigationIntent?.()
    }

    const onEnd = (event: TouchEvent) => {
      const began = start
      start = undefined
      swipeAnnounced = false
      const touch = event.changedTouches[0]
      if (!began || !touch || isInteractiveTarget(event.target)) return
      const zone = tapZone(began, {
        x: touch.clientX,
        y: touch.clientY,
        at: event.timeStamp,
        fraction: this.#hostFraction(doc, touch.clientX),
      })
      if (!zone) return
      event.stopPropagation()
      event.stopImmediatePropagation()
      this.#options.onTap?.(zone)
    }

    const onCancel = () => {
      start = undefined
    }

    doc.addEventListener('touchstart', onStart, { capture: true, passive: true })
    doc.addEventListener('touchend', onEnd, { capture: true })
    doc.addEventListener('touchmove', onMove, { capture: true, passive: true })
    doc.addEventListener('touchcancel', onCancel, { capture: true, passive: true })
    return [
      () => doc.removeEventListener('touchstart', onStart, { capture: true }),
      () => doc.removeEventListener('touchend', onEnd, { capture: true }),
      () => doc.removeEventListener('touchmove', onMove, { capture: true }),
      () => doc.removeEventListener('touchcancel', onCancel, { capture: true }),
    ]
  }

  /**
   * Where a touch landed along the visible book, as a fraction of the host's
   * width.
   *
   * The section document's own coordinates are useless for this: Foliate lays
   * the whole section out as one very wide multi-column canvas and slides it,
   * so a touch on the middle of the fourth page reports a `clientX` of several
   * thousand. Adding the frame's position in this document converts back to
   * where the finger actually was on screen.
   */
  /**
   * The theme the shell is actually painted in, read from the stylesheet.
   *
   * The book had its own copy of the three palettes, and they had already
   * drifted — the shell's sepia was `#f4efe4` and the book's `#f5eddd`, a seam
   * visible down the edge of every page. Reading the live custom properties
   * makes the stylesheet the single source, so the book and its surround can
   * no longer disagree.
   */
  #shellPalette(): ThemePalette | undefined {
    const styles = globalThis.getComputedStyle?.(this.#host)
    if (!styles) return undefined
    const background = styles.getPropertyValue('--canvas').trim()
    const foreground = styles.getPropertyValue('--ink').trim()
    if (!background || !foreground) return undefined
    return { background, foreground }
  }

  #hostFraction(doc: Document, clientX: number): number {
    const frame = doc.defaultView?.frameElement
    const host = this.#host.getBoundingClientRect()
    if (!frame || host.width <= 0) return Number.NaN
    const onScreen = frame.getBoundingClientRect().left + clientX
    return (onScreen - host.left) / host.width
  }

  #captureRelocation(detail?: FoliateRelocation): void {
    if (!detail?.cfi) return
    if (this.#suppressRelocations > 0) return
    const sectionIndex = detail.section?.current ?? this.#active?.view.renderer.getContents()[0]?.index ?? 0
    const location: ReaderLocation = {
      cfi: detail.cfi,
      sectionIndex,
      fraction: Number.isFinite(detail.fraction)
        ? Math.min(1, Math.max(0, detail.fraction ?? 0))
        : 0,
      chapterLabel: localized(detail.tocItem?.label) || this.#sectionLabel(sectionIndex),
      textFingerprint: detail.range ? fingerprintText(detail.range.toString()) : undefined,
    }
    const navigationId = this.#relocationProvenance.shift()
    const accepted = this.#options.onLocationChange?.(structuredClone(location), navigationId)
    if (accepted !== false) this.#location = location
  }

  #listenForRendererRelocations(view: FoliateView): () => void {
    const onRelocate = (event: Event) => {
      // Capture phase runs before Foliate converts the renderer event into the
      // public view relocation. Because adapter navigation is serialized,
      // this is exact provenance rather than a guess based on visible geometry.
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason
      const active = this.#activeNavigation
      const unchangedLearnerEpoch = active?.learnerEpoch === this.#learnerIntentEpoch
      const issuedRelocation =
        active &&
        (reason === 'navigation' ||
          (unchangedLearnerEpoch && reason == null) ||
          (active.relative && unchangedLearnerEpoch && reason === 'page'))
      this.#relocationProvenance.push(issuedRelocation ? active.id : undefined)
    }
    view.renderer.addEventListener('relocate', onRelocate, { capture: true })
    return () => view.renderer.removeEventListener('relocate', onRelocate, { capture: true })
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

  async #renderTutorOverlay(generation: number): Promise<void> {
    const renderer = this.#options.tutorOverlayRenderer
    const target = this.#tutorTarget
    const active = this.#active
    if (!renderer || !target || !active || generation !== this.#tutorGeneration) return
    const content = active.view.renderer
      .getContents()
      .find((candidate) => candidate.index === target.range.sectionIndex)
    if (!content?.overlayer) return
    try {
      const start = this.#resolveCfi(active.book, target.range.startCfi, content.doc, target.range.sectionIndex)
      const end = this.#resolveCfi(active.book, target.range.endCfi, content.doc, target.range.sectionIndex)
      const range = content.doc.createRange()
      range.setStart(start.startContainer, start.startOffset)
      range.setEnd(end.endContainer, end.endOffset)
      const resolved = passageFromRange(
        range,
        target.range.sectionIndex,
        target.chapterBreadcrumb,
        (value) => active.view.getCFI(target.range.sectionIndex, value),
      )
      if (
        generation !== this.#tutorGeneration ||
        this.#active !== active ||
        normalizeBookText(resolved.text) !== normalizeBookText(target.text)
      ) return
      content.overlayer.add('bookhand-tutor-overlay', range, renderer, {
        color: 'currentColor',
      })
    } catch {
      // A transient teaching cue must never make the book unreadable.
    }
  }

  #clearTutorOverlay(): void {
    for (const content of this.#active?.view.renderer.getContents() ?? []) {
      content.overlayer?.remove('bookhand-tutor-overlay')
    }
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

  async #loadResolvedTarget(active: ActiveReader, target: FoliateResolvedTarget): Promise<void> {
    try {
      await this.#options.faults?.beforeSectionLoad?.(target.index)
      await active.view.renderer.goTo(target)
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
    const RangeConstructor = document.defaultView?.Range ?? Range
    if (!(value instanceof RangeConstructor)) throw new ReaderNavigationError({ kind: 'cfi', cfi })
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

  async #recoverStalledView(stalled: ActiveReader, revision: number): Promise<void> {
    if (revision !== this.#revision || this.#active !== stalled) return
    const { book } = stalled
    this.#active = undefined
    this.#dispose(stalled, false)

    const view = document.createElement('foliate-view') as FoliateView
    const cleanups = [...this.#listen(view), configureForViewport(view)]
    const replacement: ActiveReader = { book, view, cleanups }
    this.#active = replacement
    this.#host.replaceChildren(view)
    this.#suppressRelocations += 1
    try {
      await withDeadline(
        view.open(book),
        this.#options.openDeadlineMs ?? BOOK_OPEN_DEADLINE_MS,
        this.#options.clock ?? systemClock,
      )
      if (revision !== this.#revision || this.#active !== replacement) throw new ReaderClosedError()
      cleanups.push(this.#listenForRendererRelocations(view))
      view.renderer.setStyles?.(makeReaderCss(this.#style, this.#shellPalette()))
      await withDeadline(
        view.init({
          ...(this.#location?.cfi ? { lastLocation: this.#location.cfi } : {}),
          showTextStart: true,
        }),
        this.#options.openDeadlineMs ?? BOOK_OPEN_DEADLINE_MS,
        this.#options.clock ?? systemClock,
      )
      if (revision !== this.#revision || this.#active !== replacement) throw new ReaderClosedError()
      this.renderAnnotations(this.#marks)
      if (this.#tutorTarget) void this.#renderTutorOverlay(this.#tutorGeneration)
    } catch (error) {
      if (this.#active === replacement) {
        this.#active = undefined
        this.#dispose(replacement)
        this.#host.replaceChildren()
      }
      throw error
    } finally {
      this.#suppressRelocations = Math.max(0, this.#suppressRelocations - 1)
      this.#relocationProvenance.length = 0
    }
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

  #dispose(active: ActiveReader, destroyBook = true): void {
    if (this.#disposedViews.has(active.view)) return
    this.#disposedViews.add(active.view)
    for (const cleanup of active.cleanups) cleanup()
    active.view.close()
    active.view.remove()
    if (destroyBook) active.book.destroy?.()
  }

  #resetSnapshots(): void {
    this.#tutorGeneration += 1
    this.#tutorTarget = undefined
    this.#relocationProvenance.length = 0
    this.#activeNavigation = undefined
    this.#learnerIntentEpoch = 0
    this.#suppressRelocations = 0
    this.#navigationQueue = Promise.resolve()
    this.#toc = []
    this.#sections = []
    this.#location = undefined
    this.#selection = null
    this.#marks = []
  }
}

function noop(): void {}

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

/** The touch-first condition the reader's own stylesheet uses. Keep in step. */
const COMPACT_QUERY = '(max-width: 860px), (pointer: coarse)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Foliate's paginator is configured entirely through attributes, and Bookhand
 * was setting none of them. These are the four that matter, kept in step with
 * the viewport, since the same element outlives a rotation.
 *
 * `animated` is withheld under reduced motion: the page turn then completes
 * instantly, which is the behaviour that setting asks for.
 */
function configureForViewport(view: FoliateView): () => void {
  const compact = globalThis.matchMedia?.(COMPACT_QUERY)
  const reduced = globalThis.matchMedia?.(REDUCED_MOTION_QUERY)

  const apply = () => {
    const isCompact = compact?.matches ?? false
    const element = view as unknown as HTMLElement
    element.setAttribute('margin', isCompact ? '20px' : '48px')
    element.setAttribute('gap', isCompact ? '5%' : '7%')
    element.setAttribute('max-column-count', isCompact ? '1' : '2')
    if (reduced?.matches) element.removeAttribute('animated')
    else element.setAttribute('animated', '')
  }

  apply()
  compact?.addEventListener('change', apply)
  reduced?.addEventListener('change', apply)
  return () => {
    compact?.removeEventListener('change', apply)
    reduced?.removeEventListener('change', apply)
  }
}

interface ThemePalette {
  readonly background: string
  readonly foreground: string
}

/** Used only when the shell's own tokens cannot be read, as in a unit test. */
const FALLBACK_THEMES: Record<ReaderStyle['theme'], ThemePalette> = {
  publisher: { background: 'transparent', foreground: 'inherit' },
  light: { background: '#fafafa', foreground: '#0f1115' },
  sepia: { background: '#f4efe4', foreground: '#29231b' },
  dark: { background: '#171717', foreground: '#f4efe9' },
}

function makeReaderCss(style: ReaderStyle, shell?: ThemePalette): string {
  // The publisher theme is the book's own design, so it is deliberately not
  // painted over; every named theme takes the shell's live colours.
  const theme =
    style.theme === 'publisher'
      ? FALLBACK_THEMES.publisher
      : (shell ?? FALLBACK_THEMES[style.theme])
  const family = style.fontFamily ? JSON.stringify(style.fontFamily) : 'inherit'
  return `
    :root { color-scheme: ${style.theme === 'dark' ? 'dark' : 'light'}; background: ${theme.background}; color: ${theme.foreground}; }
    body { background: ${theme.background}; color: ${theme.foreground}; }
    body { max-width: ${style.measureCh}ch; margin-inline: auto; font-family: ${family}; font-size: ${style.fontSizePercent}%; }
    p, li, blockquote, dd { line-height: ${style.lineHeight}; }
    p { margin-block: ${style.paragraphSpacingEm}em; }
    img, svg, video { max-inline-size: 100%; block-size: auto; }
    ${
      style.theme === 'dark'
        ? // Inline mathematics in this book, and in anything else produced by
          // the same TeX pipeline, is a monochrome black glyph image. On a dark
          // page it is not dim, it is invisible — a book about dy/dx whose
          // dy/dx cannot be seen. Inverting only these is deliberate: they are
          // known to be black-on-transparent line art, which figures and
          // photographs are not.
          'img[data-tex] { filter: invert(1); }'
        : ''
    }
    /* Chrome for Android inflates text inside an iframe that has no viewport
       meta of its own, by a factor taken from the frame width. The paginator's
       column arithmetic comes from the container, not from the inflated text,
       so the two disagree and lines clip. Pinning it keeps them in step. */
    html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    ${style.customCss ? boundCustomCss(style.customCss).css : ''}
  `
}
