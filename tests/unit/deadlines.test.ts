import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BOOK_OPEN_DEADLINE_MS,
  DeadlineExceededError,
  LIBRARY_LOAD_DEADLINE_MS,
  withDeadline,
} from '../../src/runtime/deadlines.ts'

describe('runtime deadlines', () => {
  afterEach(() => vi.useRealTimers())

  it('publishes the deterministic Slice 1 deadlines', () => {
    expect(LIBRARY_LOAD_DEADLINE_MS).toBe(5_000)
    expect(BOOK_OPEN_DEADLINE_MS).toBe(10_000)
  })

  it('can reach an unresolved-operation deadline with a shared fake clock', async () => {
    vi.useFakeTimers()
    const result = withDeadline(new Promise<never>(() => undefined), 5_000)
    const rejection = expect(result).rejects.toEqual(new DeadlineExceededError(5_000))
    await vi.advanceTimersByTimeAsync(5_000)
    await rejection
  })
})
