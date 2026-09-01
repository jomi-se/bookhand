import type {
  Annotation,
  AnnotationColor,
  BookRange,
  BookTarget,
  Passage,
  ReaderStyle,
  StudyBoard,
  StudyBoardView,
  StudyItem,
  StudyItemPayload,
  TocItem,
} from '../domain/index.ts'
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

export interface SaveAnnotationInput {
  readonly range: BookRange
  readonly quote: string
  readonly color?: AnnotationColor
  readonly note?: string
  /** Supplying an existing id edits that annotation instead of adding one. */
  readonly id?: string
}

export interface UpsertStudyItemInput {
  readonly payload: StudyItemPayload
  readonly sourceRange?: BookRange
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

  setReadingStyle(style: ReaderStyle): void {
    this.#adapter().applyStyle(style)
    this.#changed()
  }

  resetReadingStyle(): void {
    this.#adapter().resetStyle()
    this.#changed()
  }

  async saveAnnotation(input: SaveAnnotationInput): Promise<Annotation> {
    const now = this.#timestamp()
    const existing = input.id
      ? (await this.listAnnotations()).find((item) => item.id === input.id)
      : undefined
    const annotation: Annotation = {
      id: input.id ?? this.#id('annotation'),
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

  async upsertStudyItem(input: UpsertStudyItemInput): Promise<StudyItem> {
    const now = this.#timestamp()
    const existing = input.id
      ? (await this.listStudyItems()).find((item) => item.id === input.id)
      : undefined
    const item: StudyItem = {
      id: input.id ?? this.#id('item'),
      boardId: this.#context.board.id,
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
    const saved = await this.#context.client.upsertStudyItem(item)
    this.#changed()
    return saved
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
