import type {
  Annotation,
  AnnotationColor,
  BookRange,
  BookTarget,
  MutationOrigin,
  MutationReceipt,
  Passage,
  ReaderStyle,
  ReversalAction,
  StudyBoard,
  StudyBoardView,
  StudyItem,
  StudyItemPayload,
  StudyMutation,
  TocItem,
} from '../domain/index.ts'
import {
  DELETE_ACTION,
  HandshakeError,
  RESET_PRESENTATION_ACTION,
  RETURN_TO_SOURCE_ACTION,
  UNDO_ACTION,
  UNDO_BOARD_VIEW_ACTION,
  UNDO_PRESENTATION_ACTION,
} from '../domain/provenance.ts'
import {
  compareQuote,
  rejectSource,
  verifyBookOwnership,
  verifyFingerprint,
} from '../domain/source-verification.ts'
import type { PresentationStore, StyleCommit, StylePatch } from './presentation.ts'
import type { BoardMode, SurfaceStore } from './surface.ts'
import type { ReaderPortBridge } from './reader-bridge.ts'
import type { StorageClient } from '../storage/client.ts'
import { DEFAULT_READER_STYLE } from '../reader/FoliateReaderAdapter.ts'

export interface ReadingContext {
  readonly bookId: string
  readonly title: string
  readonly chapterLabel?: string
  readonly sectionIndex: number
  readonly progressPercent: number
  readonly visible: Passage
  readonly selection?: { readonly quote: string; readonly range: BookRange }
}

/**
 * Who is asking. Defaults to the person, because the interface is the person;
 * only the WebMCP handlers pass `'agent'`, and they always pass it.
 */
export interface CallerIdentity {
  readonly origin?: MutationOrigin
  /** The caller's own name for this action, for retry safety. */
  readonly actionToken?: string
  /** Groups several writes made for one intent. */
  readonly actionGroupId?: string
}

export interface SaveAnnotationInput extends CallerIdentity {
  /**
   * The book the caller believes is open. Required, and checked: a mutation
   * that names the wrong book is a mutation aimed at text the caller has not
   * actually read.
   */
  readonly bookId: string
  readonly range: BookRange
  readonly quote: string
  readonly color?: AnnotationColor
  readonly note?: string
  /** Supplying an existing id edits that annotation instead of adding one. */
  readonly id?: string
}

export interface UpsertStudyItemInput extends CallerIdentity {
  /** An agent revising its own block must present the token it was given. */
  readonly updateToken?: string
  readonly payload: StudyItemPayload
  /** Required whenever `sourceRange` is present; see `SaveAnnotationInput`. */
  readonly bookId?: string
  readonly sourceRange?: BookRange
  /**
   * The exact text `sourceRange` covers. Required whenever `sourceRange` is
   * present, so a block that claims a source can be checked against it.
   */
  readonly sourceQuote?: string
  readonly sourceLabel?: string
  readonly id?: string
  readonly sortOrder?: number
}

/**
 * A presentation change, from either caller.
 *
 * Only named fields are sent. A caller must not restate the fields it did not
 * touch, because restating them means carrying a snapshot forward and writing
 * it back over whatever changed in between — which is precisely how the Text
 * panel used to erase an agent's theme when someone nudged the size slider.
 */
export interface SetReadingStyleInput extends CallerIdentity {
  readonly patch: StylePatch
  /**
   * Required from an agent whenever `patch.customCss` is present: the version
   * string `get_design_context` returned. Named themes and ordinary typography
   * need no handshake, because they cannot express anything the design context
   * would have warned about.
   */
  readonly designContextVersion?: string
}

/** What the board looked like, in the two terms that can differ. */
export interface StudyBoardSnapshot {
  /** The stored layout preference. */
  readonly view: StudyBoardView
  /** Whether the board is on screen right now. */
  readonly open: boolean
}

export interface CommandContext {
  readonly client: StorageClient
  readonly bridge: ReaderPortBridge
  /** The single owner of the reading presentation. */
  readonly presentation: PresentationStore
  /** Which panel is open, shared so a tool can open, focus, and close it. */
  readonly surface: SurfaceStore
  /** The guidance version an agent must echo before writing custom book CSS. */
  readonly designContextVersion: string
  readonly bookId: string
  readonly bookTitle: string
  readonly board: StudyBoard
  readonly now?: () => Date
  readonly newId?: () => string
}

export class ReaderUnavailableError extends Error {
  constructor() {
    super('No book is open')
    this.name = 'ReaderUnavailableError'
  }
}

/**
 * The single place reading and study operations are expressed. The product UI
 * calls these, and the WebMCP tool handlers call exactly the same methods, so
 * an agent can never reach behaviour a person cannot reach — and neither path
 * can drift from the other.
 */
export class BookhandCommands {
  readonly #context: CommandContext
  readonly #listeners = new Set<() => void>()
  /** The live board, so a toggle never reads a preference from a stale render. */
  #board: StudyBoard
  #boardView: StudyBoardView

  constructor(context: CommandContext) {
    this.#context = context
    this.#board = context.board
    this.#boardView = context.board.view
  }

  get bookId(): string {
    return this.#context.bookId
  }

  get boardId(): string {
    return this.#context.board.id
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #changed(): void {
    for (const listener of this.#listeners) listener()
  }

  #adapter() {
    const adapter = this.#context.bridge.adapter
    if (!adapter) throw new ReaderUnavailableError()
    return adapter
  }

  #timestamp(): string {
    return (this.#context.now?.() ?? new Date()).toISOString()
  }

  #id(prefix: string): string {
    return this.#context.newId?.() ?? `${prefix}-${crypto.randomUUID()}`
  }

  async getReadingContext(): Promise<ReadingContext> {
    const adapter = this.#adapter()
    const visible = await adapter.getVisibleContext()
    const location = adapter.getLocation()
    const selection = adapter.getSelection()
    return {
      bookId: this.#context.bookId,
      title: this.#context.bookTitle,
      chapterLabel: location.chapterLabel,
      sectionIndex: location.sectionIndex,
      progressPercent: Math.round(location.fraction * 100),
      visible,
      ...(selection ? { selection: { quote: selection.quote, range: selection.range } } : {}),
    }
  }

  getTableOfContents(): readonly TocItem[] {
    return this.#adapter().getToc()
  }

  async getPassage(range: BookRange): Promise<Passage> {
    return this.#adapter().getPassage(range)
  }

  async navigateBook(target: BookTarget): Promise<ReadingContext> {
    await this.#adapter().navigate(target)
    return this.getReadingContext()
  }

  /**
   * What is stored, not what the adapter happens to be showing. A preview is
   * deliberately invisible here: a caller asking what the reading style is
   * should be told the setting, not a half-finished experiment.
   */
  getReadingStyle(): ReaderStyle {
    return this.#context.presentation.committed
  }

  /** What the book is showing right now, preview included. */
  getVisibleReadingStyle(): ReaderStyle {
    return this.#context.presentation.visible
  }

  async setReadingStyle(input: SetReadingStyleInput): Promise<MutationReceipt<ReaderStyle>> {
    const origin = input.origin ?? 'user'
    if (origin === 'agent' && input.patch.customCss !== undefined) {
      this.#requireDesignContext(input.designContextVersion)
    }
    const commit = await this.#context.presentation.commit(
      input.patch,
      origin,
      input.actionGroupId,
    )
    this.#changed()
    return styleReceipt(commit)
  }

  async resetReadingStyle(caller: CallerIdentity = {}): Promise<MutationReceipt<ReaderStyle>> {
    const commit = await this.#context.presentation.restore(
      DEFAULT_READER_STYLE,
      caller.origin ?? 'user',
      caller.actionGroupId,
    )
    this.#changed()
    return styleReceipt(commit)
  }

  /**
   * Take back the last committed presentation change, whoever made it.
   *
   * Deliberately not scoped to the caller: the point of Undo is that the person
   * can reverse what an agent did, and an agent that has just been told what it
   * replaced should be able to put it back.
   */
  async undoReadingStyle(): Promise<MutationReceipt<ReaderStyle> | undefined> {
    const reversible = this.#context.presentation.view.reversible
    if (!reversible) return undefined
    const commit = await this.#context.presentation.restore(reversible.prior, 'user')
    this.#changed()
    return styleReceipt(commit)
  }

  /**
   * Custom CSS is the one presentation change that can express something the
   * design context exists to prevent — unreadable contrast, a hidden control,
   * a layout that breaks at a phone width. An agent that has not read the
   * current guidance is refused and told exactly how to become able to write
   * it. Nothing changes in the meantime, so a stale call is a no-op the caller
   * can recover from rather than a half-applied style.
   */
  #requireDesignContext(offered: string | undefined): void {
    const current = this.#context.designContextVersion
    if (offered === current) return
    throw new HandshakeError(
      offered === undefined
        ? 'Custom book CSS needs the current design guidance. Call get_design_context, then send its version as designContextVersion. Nothing was changed.'
        : `That design guidance version is out of date. Call get_design_context again for the current one (${current}) and send that. Nothing was changed.`,
    )
  }

  /**
   * Resolve a claimed range against the open book and prove the claimed quote
   * is exactly the text it covers.
   *
   * This runs before any write. A rejection must leave storage, the overlays,
   * and the mounted interface untouched, which is why verification happens here
   * rather than inside the storage worker: nothing has been attempted yet.
   */
  async #verifySource(bookId: string, range: BookRange, quote: string): Promise<void> {
    verifyBookOwnership(bookId, this.#context.bookId)
    let resolved
    try {
      resolved = await this.#adapter().getPassage(range)
    } catch (cause) {
      rejectSource('stale-range', `The range did not resolve: ${String(cause)}`)
    }
    verifyFingerprint(range.textFingerprint, resolved.range.textFingerprint)
    compareQuote(quote, resolved.text)
  }

  async saveAnnotation(input: SaveAnnotationInput): Promise<Annotation> {
    await this.#verifySource(input.bookId, input.range, input.quote)
    const now = this.#timestamp()
    const existing = input.id
      ? (await this.listAnnotations()).find((item) => item.id === input.id)
      : undefined
    const annotation: Annotation = {
      id: input.id ?? this.#id('annotation'),
      origin: input.origin ?? 'user',
      ...(input.actionGroupId ? { actionGroupId: input.actionGroupId } : {}),
      bookId: this.#context.bookId,
      range: input.range,
      quote: input.quote,
      color: input.color ?? existing?.color ?? 'accent',
      ...(input.note === undefined
        ? existing?.note === undefined
          ? {}
          : { note: existing.note }
        : { note: input.note }),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const saved = await this.#context.client.saveAnnotation(annotation)
    this.#changed()
    return saved
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    await this.#context.client.deleteAnnotation(annotationId)
    this.#changed()
  }

  async listAnnotations(): Promise<readonly Annotation[]> {
    return this.#context.client.listAnnotations(this.#context.bookId)
  }

  /**
   * Write a study block and hand back exactly what happened.
   *
   * The receipt is not a convenience. A person who did not perform an action
   * needs to be told what it changed, what it could have reached, what it
   * corrected, and precisely how to take it back — otherwise agent work is
   * something that merely happens to their board.
   *
   * `VAL-ACTION-PROVENANCE-UNDO`.
   */
  async upsertStudyItem(input: UpsertStudyItemInput): Promise<MutationReceipt<StudyItem>> {
    if (input.sourceRange) {
      if (input.bookId === undefined || input.sourceQuote === undefined) {
        rejectSource(
          'invented-quote',
          'A study item carrying a source range must also carry its bookId and the exact quote',
        )
      }
      await this.#verifySource(input.bookId, input.sourceRange, input.sourceQuote)
    }
    const origin = input.origin ?? 'user'
    const now = this.#timestamp()
    const existing = input.id
      ? (await this.listStudyItems()).find((item) => item.id === input.id)
      : undefined
    // An id naming an item that is already there is a revision of it; an id
    // naming nothing is a creation under a caller-chosen name. Both are honest
    // requests, and the repository decides whether this caller may make them.
    const operation = existing ? 'update' : 'create'

    const item: StudyItem = {
      // A create with no id must land on the SAME id when it is retried,
      // otherwise every attempt is a different action and the retry protection
      // protects nothing. Deriving it from the caller's own action token gives
      // a stable name without asking the caller to invent ids.
      id: input.id ?? (input.actionToken ? `item-${input.actionToken}` : this.#id('item')),
      boardId: this.#context.board.id,
      origin: existing?.origin ?? origin,
      revision: existing?.revision ?? 1,
      ...(input.actionGroupId ? { actionGroupId: input.actionGroupId } : {}),
      payload: input.payload,
      ...(input.sourceRange
        ? { sourceRange: input.sourceRange }
        : existing?.sourceRange
          ? { sourceRange: existing.sourceRange }
          : {}),
      ...(input.sourceLabel
        ? { sourceLabel: input.sourceLabel }
        : existing?.sourceLabel
          ? { sourceLabel: existing.sourceLabel }
          : {}),
      sortOrder: input.sortOrder ?? existing?.sortOrder ?? (await this.#nextOrder()),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    const mutation: StudyMutation = {
      operation,
      origin,
      bookId: this.#context.bookId,
      actionToken: input.actionToken ?? this.#id('action'),
      actionGroupId: input.actionGroupId ?? this.#id('group'),
      ...(input.updateToken ? { updateToken: input.updateToken } : {}),
    }
    const commit = await this.#context.client.commitStudyItem(item, mutation)
    this.#changed()

    return {
      operation,
      origin,
      actionGroupId: mutation.actionGroupId,
      ...(commit.prior ? { prior: commit.prior } : {}),
      applied: commit.item,
      ...(commit.updateToken ? { updateToken: commit.updateToken } : {}),
      scope: `The study board for ${this.#context.bookTitle}. Nothing outside this book is reachable.`,
      warnings: commit.replayed
        ? ['This action had already been performed; the earlier result was returned unchanged.']
        : [],
      persisted: true,
      actions: reversalsFor(commit.item),
    }
  }

  /**
   * Take back one study-item write.
   *
   * `expectedRevision` is what the caller believes it is undoing. If the block
   * has been edited since, the repository refuses rather than discarding that
   * edit — an Undo that destroys newer work is not an undo.
   */
  async undoStudyItem(itemId: string, expectedRevision: number): Promise<StudyItem | null> {
    const restored = await this.#context.client.undoStudyItem(itemId, expectedRevision)
    this.#changed()
    return restored
  }

  async deleteStudyItem(itemId: string): Promise<void> {
    await this.#context.client.deleteStudyItem(itemId)
    this.#changed()
  }

  async listStudyItems(): Promise<readonly StudyItem[]> {
    return this.#context.client.listStudyItems(this.#context.board.id)
  }

  /**
   * The four things a caller can ask of the study board.
   *
   * Only two of them are preferences. `focus` and `close` change what is on
   * screen without touching what is stored, so an agent bringing the board
   * forward to show its work does not also decide how the person's reader is
   * laid out from then on.
   */
  async setStudyBoardView(
    mode: BoardMode,
    caller: CallerIdentity = {},
  ): Promise<MutationReceipt<StudyBoardSnapshot>> {
    const origin = caller.origin ?? 'user'
    const actionGroupId = caller.actionGroupId ?? this.#id('view')
    const prior = this.#boardSnapshot()

    let persisted = false
    if (mode === 'docked' || mode === 'expanded') {
      await this.#storeBoardView(mode)
      persisted = true
      this.#context.surface.openBoard()
      // Only a tool change needs taking back; the person just did this one.
      this.#context.surface.recordBoardReversal(
        origin === 'agent'
          ? { origin, actionGroupId, priorView: prior.view, priorOpen: prior.open }
          : undefined,
      )
    } else if (mode === 'focus') {
      this.#context.surface.openBoard({ focus: true })
    } else {
      this.#context.surface.closeBoard()
    }

    this.#changed()
    return this.#boardReceipt({ origin, actionGroupId, prior, persisted })
  }

  /** The board as it stands, whoever changed it last. */
  get studyBoard(): StudyBoard {
    return this.#board
  }

  /** Flip the persistent layout, read from current state rather than a render. */
  async toggleStudyBoardView(
    caller: CallerIdentity = {},
  ): Promise<MutationReceipt<StudyBoardSnapshot>> {
    return this.setStudyBoardView(this.#boardView === 'expanded' ? 'docked' : 'expanded', caller)
  }

  /**
   * Put back the layout an agent changed, including whether the board was on
   * screen at all.
   *
   * Deliberately not routed through `setStudyBoardView`: that always opens the
   * board, so an undo of a change that had opened it would have left it open,
   * and handed back a receipt saying so.
   */
  async undoStudyBoardView(): Promise<MutationReceipt<StudyBoardSnapshot> | undefined> {
    const reversal = this.#context.surface.state.boardReversal
    if (!reversal) return undefined
    const prior = this.#boardSnapshot()

    await this.#storeBoardView(reversal.priorView)
    if (reversal.priorOpen) this.#context.surface.openBoard()
    else this.#context.surface.closeBoard()
    this.#context.surface.recordBoardReversal(undefined)

    this.#changed()
    return this.#boardReceipt({
      origin: 'user',
      actionGroupId: reversal.actionGroupId,
      prior,
      persisted: true,
    })
  }

  async #storeBoardView(view: StudyBoardView): Promise<void> {
    const board = await this.#context.client.setBoardView(this.#context.board.id, view)
    this.#board = board
    this.#boardView = board.view
  }

  #boardSnapshot(): StudyBoardSnapshot {
    return { view: this.#boardView, open: this.#context.surface.boardOpen }
  }

  /** Built from live state, after everything has been applied. */
  #boardReceipt(about: {
    origin: MutationOrigin
    actionGroupId: string
    prior: StudyBoardSnapshot
    persisted: boolean
  }): MutationReceipt<StudyBoardSnapshot> {
    return {
      operation: 'update',
      origin: about.origin,
      actionGroupId: about.actionGroupId,
      prior: about.prior,
      applied: this.#boardSnapshot(),
      scope: about.persisted
        ? 'How the study board is laid out beside the book. The reading position does not change.'
        : 'What is on screen right now. Nothing is stored, deleted, or reordered, and the reading position does not change.',
      warnings: [],
      persisted: about.persisted,
      actions: [UNDO_BOARD_VIEW_ACTION],
    }
  }

  async #nextOrder(): Promise<number> {
    const items = await this.listStudyItems()
    return items.reduce((highest, item) => Math.max(highest, item.sortOrder + 1), 0)
  }
}

/**
 * Return to source is offered only when there is a source to return to; the
 * other two always apply. An action listed but not available would be worse
 * than one not listed at all.
 */
function reversalsFor(item: StudyItem): readonly ReversalAction[] {
  return [
    UNDO_ACTION,
    ...(item.sourceRange ? [RETURN_TO_SOURCE_ACTION] : []),
    DELETE_ACTION,
  ]
}

/**
 * Everything a caller needs to describe the change and take it back, including
 * the honest answer to whether it survives a reload.
 */
function styleReceipt(commit: StyleCommit): MutationReceipt<ReaderStyle> {
  return {
    operation: 'update',
    origin: commit.origin,
    actionGroupId: commit.actionGroupId,
    prior: commit.prior,
    applied: commit.applied,
    scope: commit.applied.customCss
      ? 'The open book’s own document. Custom CSS cannot reach the library, the reader chrome, the panels, or Study.'
      : 'How the open book is presented. Nothing outside the book document changes.',
    warnings: commit.warnings,
    persisted: commit.persisted,
    actions: [UNDO_PRESENTATION_ACTION, RESET_PRESENTATION_ACTION],
  }
}
