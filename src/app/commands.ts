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
  RETURN_TO_SOURCE_ACTION,
  UNDO_ACTION,
} from '../domain/provenance.ts'
import {
  compareQuote,
  rejectSource,
  verifyBookOwnership,
  verifyFingerprint,
} from '../domain/source-verification.ts'
import type { ReaderPortBridge } from './reader-bridge.ts'
import type { StorageClient } from '../storage/client.ts'

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

export interface CommandContext {
  readonly client: StorageClient
  readonly bridge: ReaderPortBridge
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

  constructor(context: CommandContext) {
    this.#context = context
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

  getReadingStyle(): ReaderStyle {
    return this.#adapter().getStyle()
  }

  setReadingStyle(style: ReaderStyle): void {
    this.#adapter().applyStyle(style)
    this.#changed()
  }

  resetReadingStyle(): void {
    this.#adapter().resetStyle()
    this.#changed()
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
      id: input.id ?? this.#id('item'),
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

  async setStudyBoardView(view: StudyBoardView): Promise<StudyBoard> {
    const board = await this.#context.client.setBoardView(this.#context.board.id, view)
    this.#changed()
    return board
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
