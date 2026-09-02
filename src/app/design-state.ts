import type { StudyBoardView } from '../domain/index.ts'

/**
 * What the reader surface is currently showing, for `get_design_context` to
 * read at call time.
 *
 * This is a mutable holder rather than React state on purpose. Routing the
 * open panel through the composition root would change the tool factory on
 * every panel toggle, and changing the tool factory re-registers every tool
 * with the agent runtime. The store is written from an effect and read only
 * inside a tool call, so no render depends on it.
 *
 * Presentation is deliberately *not* held here. A tool call changes the
 * adapter's style without passing through React, so React's copy can be stale
 * — that gap is W2's `VAL-STYLE-PARITY`. Until it closes, the design context
 * reads the style from the adapter, which is right either way.
 */
export interface ReaderDesignState {
  readonly surface: 'reader' | 'study'
  readonly boardView?: StudyBoardView
}

export class DesignStateStore {
  #state: ReaderDesignState | undefined

  set(state: ReaderDesignState): void {
    this.#state = state
  }

  clear(): void {
    this.#state = undefined
  }

  /** Undefined whenever no book is open, which the context reports as such. */
  get current(): ReaderDesignState | undefined {
    return this.#state
  }
}
