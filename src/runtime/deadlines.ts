export const LIBRARY_LOAD_DEADLINE_MS = 5_000
export const BOOK_OPEN_DEADLINE_MS = 10_000

export interface RuntimeClock {
  now(): number
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>
  clearTimeout(handle: ReturnType<typeof setTimeout>): void
}

export const systemClock: RuntimeClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
}

export class DeadlineExceededError extends Error {
  readonly deadlineMs: number

  constructor(deadlineMs: number) {
    super(`Operation exceeded its ${deadlineMs} ms deadline`)
    this.name = 'DeadlineExceededError'
    this.deadlineMs = deadlineMs
  }
}

export function withDeadline<T>(
  operation: Promise<T>,
  deadlineMs: number,
  clock: RuntimeClock = systemClock,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = clock.setTimeout(
      () => reject(new DeadlineExceededError(deadlineMs)),
      deadlineMs,
    )

    operation.then(
      (value) => {
        clock.clearTimeout(handle)
        resolve(value)
      },
      (error: unknown) => {
        clock.clearTimeout(handle)
        reject(error)
      },
    )
  })
}

