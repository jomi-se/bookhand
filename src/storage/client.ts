import type {
  Annotation,
  BookCatalogEntry,
  ImportBookInput,
  StudyBoard,
  StudyBoardView,
  StudyItem,
  StudyItemCommit,
  StudyMutation,
  ReadingState,
  StorageDiagnostics,
  StoredBook,
  StorageWorkerRequest,
  StorageWorkerResponse,
  StorageWorkerResult,
} from '../domain/index.ts'
import {
  BOOK_IMPORT_DEADLINE_MS,
  DeadlineExceededError,
  LIBRARY_LOAD_DEADLINE_MS,
  systemClock,
  withDeadline,
  type RuntimeClock,
} from '../runtime/deadlines.ts'
import { assertStorageWorkerResponse } from './protocol.ts'

export class StorageClientError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(
    code: string,
    message: string,
    retryable: boolean,
  ) {
    super(message)
    this.name = 'StorageClientError'
    this.code = code
    this.retryable = retryable
  }
}

type RequestWithoutId = StorageWorkerRequest extends infer Request
  ? Request extends StorageWorkerRequest
    ? Omit<Request, 'requestId'>
    : never
  : never

interface WorkerLike {
  postMessage(message: unknown): void
  addEventListener(
    type: 'message' | 'error',
    listener: EventListenerOrEventListenerObject,
  ): void
  removeEventListener(
    type: 'message' | 'error',
    listener: EventListenerOrEventListenerObject,
  ): void
  terminate(): void
}

export interface StorageClientOptions {
  readonly clock?: RuntimeClock
  /** Bounds every request except `import-book`. */
  readonly deadlineMs?: number
  readonly importDeadlineMs?: number
}

function expectResult<T extends StorageWorkerResult['type']>(
  result: StorageWorkerResult,
  type: T,
): Extract<StorageWorkerResult, { type: T }> {
  if (result.type !== type) {
    throw new StorageClientError(
      'invalid-worker-response',
      `Expected ${type}, received ${result.type}`,
      false,
    )
  }
  return result as Extract<StorageWorkerResult, { type: T }>
}

export class StorageClient {
  private readonly worker: WorkerLike
  private readonly clock: RuntimeClock
  private readonly deadlineMs: number
  private readonly importDeadlineMs: number
  private readonly pending = new Map<
    string,
    {
      resolve(value: StorageWorkerResult): void
      reject(reason: unknown): void
    }
  >()
  private nextRequest = 0
  /** Set once the worker can no longer answer; every later request fails fast. */
  private failure: StorageClientError | undefined
  private disposal: Promise<void> | undefined

  private readonly onMessage = (event: Event) => {
    const rawResponse = (event as MessageEvent<unknown>).data
    const requestId =
      typeof rawResponse === 'object' &&
      rawResponse !== null &&
      'requestId' in rawResponse &&
      typeof rawResponse.requestId === 'string'
        ? rawResponse.requestId
        : undefined
    if (!requestId) return
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    try {
      assertStorageWorkerResponse(rawResponse)
    } catch (error) {
      pending.reject(
        new StorageClientError(
          'invalid-worker-response',
          error instanceof Error ? error.message : 'Invalid storage worker response',
          false,
        ),
      )
      return
    }
    const response: StorageWorkerResponse = rawResponse
    if (response.ok) pending.resolve(response.result)
    else {
      pending.reject(
        new StorageClientError(
          response.error.code,
          response.error.message,
          response.error.retryable,
        ),
      )
    }
  }

  private readonly onError = (event: Event) => {
    this.fail(
      new StorageClientError(
        'storage-worker-failed',
        event instanceof ErrorEvent && event.message
          ? event.message
          : 'Storage worker failed',
        true,
      ),
    )
  }

  constructor(worker: WorkerLike = createStorageWorker(), options: StorageClientOptions = {}) {
    this.worker = worker
    this.clock = options.clock ?? systemClock
    this.deadlineMs = options.deadlineMs ?? LIBRARY_LOAD_DEADLINE_MS
    this.importDeadlineMs = options.importDeadlineMs ?? BOOK_IMPORT_DEADLINE_MS
    worker.addEventListener('message', this.onMessage)
    worker.addEventListener('error', this.onError)
  }

  async initialize(): Promise<StorageDiagnostics> {
    const result = expectResult(await this.request({ type: 'initialize' }), 'initialized')
    return result.diagnostics
  }

  async retryPersistence(): Promise<StorageDiagnostics> {
    const result = expectResult(
      await this.request({ type: 'retry-persistence' }),
      'initialized',
    )
    return result.diagnostics
  }

  async importBook(book: ImportBookInput): Promise<string> {
    return expectResult(
      await this.request({ type: 'import-book', book }, this.importDeadlineMs),
      'book-written',
    ).bookId
  }

  async getBook(bookId: string): Promise<StoredBook | null> {
    return expectResult(
      await this.request({ type: 'get-book', bookId }),
      'book',
    ).book
  }

  async listBooks(): Promise<readonly BookCatalogEntry[]> {
    return expectResult(await this.request({ type: 'list-books' }), 'book-list')
      .books
  }

  async putReadingState(state: ReadingState): Promise<string> {
    return expectResult(
      await this.request({ type: 'put-reading-state', state }),
      'reading-state-written',
    ).bookId
  }

  async getReadingState(bookId: string): Promise<ReadingState | null> {
    return expectResult(
      await this.request({ type: 'get-reading-state', bookId }),
      'reading-state',
    ).state
  }

  async getDiagnostics(): Promise<StorageDiagnostics> {
    return expectResult(
      await this.request({ type: 'get-diagnostics' }),
      'diagnostics',
    ).diagnostics
  }

  async claimPersistenceRequest(): Promise<boolean> {
    return expectResult(
      await this.request({ type: 'claim-persistence-request' }),
      'persistence-request-claimed',
    ).claimed
  }

  async saveAnnotation(annotation: Annotation): Promise<Annotation> {
    return expectResult(
      await this.request({ type: 'save-annotation', annotation }),
      'annotation-saved',
    ).annotation
  }

  async repairAnnotationSource(annotation: Annotation): Promise<Annotation> {
    return expectResult(
      await this.request({ type: 'repair-annotation-source', annotation }),
      'annotation-saved',
    ).annotation
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    expectResult(
      await this.request({ type: 'delete-annotation', annotationId }),
      'annotation-deleted',
    )
  }

  async listAnnotations(bookId: string): Promise<readonly Annotation[]> {
    return expectResult(await this.request({ type: 'list-annotations', bookId }), 'annotations')
      .annotations
  }

  async getBoard(bookId: string): Promise<StudyBoard> {
    return expectResult(await this.request({ type: 'get-board', bookId }), 'board').board
  }

  async setBoardView(boardId: string, view: StudyBoardView): Promise<StudyBoard> {
    return expectResult(
      await this.request({ type: 'set-board-view', boardId, view }),
      'board',
    ).board
  }

  async commitStudyItem(item: StudyItem, mutation: StudyMutation): Promise<StudyItemCommit> {
    return expectResult(
      await this.request({ type: 'commit-study-item', item, mutation }),
      'study-item-committed',
    ).commit
  }

  async repairStudyItemSource(item: StudyItem): Promise<StudyItem> {
    return expectResult(
      await this.request({ type: 'repair-study-item-source', item }),
      'study-item-repaired',
    ).item
  }

  async undoStudyItem(itemId: string, expectedRevision: number): Promise<StudyItem | null> {
    return expectResult(
      await this.request({ type: 'undo-study-item', itemId, expectedRevision }),
      'study-item-undone',
    ).item
  }

  async deleteStudyItem(itemId: string): Promise<void> {
    expectResult(await this.request({ type: 'delete-study-item', itemId }), 'study-item-deleted')
  }

  async listStudyItems(boardId: string): Promise<readonly StudyItem[]> {
    return expectResult(await this.request({ type: 'list-study-items', boardId }), 'study-items')
      .items
  }

  /** Idempotent, and never rejects: teardown must be safe from a cleanup path. */
  dispose(): Promise<void> {
    this.disposal ??= this.performDispose()
    return this.disposal
  }

  private async performDispose(): Promise<void> {
    try {
      expectResult(await this.request({ type: 'close' }), 'closed')
    } catch {
      // A worker that cannot acknowledge the close is torn down regardless.
    } finally {
      this.fail(
        new StorageClientError(
          'storage-client-disposed',
          'Storage client is disposed',
          false,
        ),
      )
      this.worker.removeEventListener('message', this.onMessage)
      this.worker.removeEventListener('error', this.onError)
      this.worker.terminate()
    }
  }

  private fail(error: StorageClientError): void {
    this.failure ??= error
    const reason = this.failure
    for (const pending of this.pending.values()) pending.reject(reason)
    this.pending.clear()
  }

  private request(
    request: RequestWithoutId,
    deadlineMs = this.deadlineMs,
  ): Promise<StorageWorkerResult> {
    if (this.failure) return Promise.reject(this.failure)
    const requestId = `storage-${++this.nextRequest}`
    const answer = new Promise<StorageWorkerResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ ...request, requestId })
    })
    return withDeadline(answer, deadlineMs, this.clock).catch((error: unknown) => {
      if (!(error instanceof DeadlineExceededError)) throw error
      this.pending.delete(requestId)
      throw new StorageClientError(
        'storage-request-timed-out',
        `The library did not answer ${request.type} within ${deadlineMs} ms`,
        true,
      )
    })
  }
}

export function createStorageWorker(): Worker {
  return new Worker(new URL('./storage.worker.ts', import.meta.url), {
    type: 'module',
    name: 'bookhand-storage',
  })
}
