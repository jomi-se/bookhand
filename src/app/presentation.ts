import type { ReaderStyle } from '../domain/reader.ts'
import type { MutationOrigin } from '../domain/provenance.ts'
import { boundCustomCss } from '../reader/custom-css.ts'

/**
 * The one place the reading presentation lives.
 *
 * Before this, the Text panel wrote to React state and a tool call wrote
 * straight to the adapter. Both changed the book, but neither could see the
 * other: an agent's change never reached the controls, was never persisted,
 * and was undone by the next slider drag, which spread a snapshot taken before
 * the agent existed. Two writers and no shared state is not a bug in either
 * path — it is the absence of a path — so both now commit here and read back
 * what this store says is true. `VAL-STYLE-PARITY`.
 */

/** Only the fields a caller actually meant to change. */
export type StylePatch = Partial<ReaderStyle>

export interface StyleMutation {
  readonly origin: MutationOrigin
  readonly actionGroupId: string
  readonly prior: ReaderStyle
  readonly applied: ReaderStyle
}

export interface StyleCommit extends StyleMutation {
  /** What the sanitizer had to remove, in the words shown to a person. */
  readonly warnings: readonly string[]
  /** Whether this reached durable storage, rather than whether it was tried. */
  readonly persisted: boolean
}

export interface PresentationView {
  /** What survives a reload. */
  readonly committed: ReaderStyle
  /** What the book is actually showing, which a preview may differ from. */
  readonly visible: ReaderStyle
  readonly previewing: boolean
  /** What the sanitizer removed from what is on screen, in a person's words. */
  readonly warnings: readonly string[]
  /** The last committed change, while it is still reversible in one action. */
  readonly reversible?: StyleMutation
}

export interface PresentationHooks {
  /** Push a style into the open book. */
  readonly apply: (style: ReaderStyle) => void
  /** Write the committed style where a reload will find it. */
  readonly persist: (style: ReaderStyle) => Promise<void>
}

type Listener = (view: PresentationView) => void

let group = 0

export class PresentationStore {
  #committed: ReaderStyle
  #preview: ReaderStyle | undefined
  #reversible: StyleMutation | undefined
  #hooks: PresentationHooks | undefined
  #settled = false
  #warnings: readonly string[] = []
  readonly #listeners = new Set<Listener>()

  constructor(initial: ReaderStyle) {
    this.#committed = initial
  }

  /**
   * Adopt the style found in storage when the book opens.
   *
   * Ignored once anything has been committed. A book takes time to open, and
   * the tools are offered while it does; without this guard a tool change that
   * landed in that window would be silently overwritten by the restore that
   * finished after it, which is the harder half of this defect — the agent is
   * told the change succeeded, and it did, and then it is gone.
   */
  hydrate(style: ReaderStyle): void {
    if (this.#settled) return
    this.#settled = true
    this.#committed = style
    this.#push()
  }

  install(hooks: PresentationHooks): () => void {
    this.#hooks = hooks
    hooks.apply(this.visible)
    return () => {
      if (this.#hooks === hooks) this.#hooks = undefined
    }
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  get committed(): ReaderStyle {
    return this.#committed
  }

  get visible(): ReaderStyle {
    return this.#preview ?? this.#committed
  }

  get view(): PresentationView {
    return {
      committed: this.#committed,
      visible: this.visible,
      previewing: this.#preview !== undefined,
      warnings: this.#warnings,
      ...(this.#reversible ? { reversible: this.#reversible } : {}),
    }
  }

  /** Show a change without keeping it. Nothing is persisted and nothing is undoable. */
  preview(patch: StylePatch): void {
    const { style, warnings } = sanitize({ ...this.#committed, ...patch })
    this.#preview = style
    this.#warnings = warnings
    this.#hooks?.apply(style)
    this.#push()
  }

  /** Put back what was committed, discarding whatever was being tried. */
  cancelPreview(): void {
    if (this.#preview === undefined) return
    this.#preview = undefined
    this.#warnings = []
    this.#hooks?.apply(this.#committed)
    this.#push()
  }

  /**
   * Change only the named fields, over whatever is committed now.
   *
   * The merge is against current state rather than against a snapshot the
   * caller captured, so a control changing the text size cannot carry a stale
   * theme back over an agent's change made a moment earlier.
   */
  commit(patch: StylePatch, origin: MutationOrigin, actionGroupId?: string): Promise<StyleCommit> {
    return this.#write({ ...this.#committed, ...patch }, origin, actionGroupId)
  }

  /** Replace the whole style, for Reset and for Undo. */
  restore(style: ReaderStyle, origin: MutationOrigin, actionGroupId?: string): Promise<StyleCommit> {
    return this.#write(style, origin, actionGroupId)
  }

  async #write(
    next: ReaderStyle,
    origin: MutationOrigin,
    actionGroupId = `style-${(group += 1)}`,
  ): Promise<StyleCommit> {
    const prior = this.#committed
    const { style, warnings } = sanitize(next)
    this.#settled = true
    this.#committed = style
    this.#preview = undefined
    this.#warnings = warnings
    this.#reversible = { origin, actionGroupId, prior, applied: style }
    this.#hooks?.apply(style)
    this.#push()

    let persisted = false
    if (this.#hooks) {
      try {
        await this.#hooks.persist(style)
        persisted = true
      } catch {
        // Reported as `persisted: false`; the change is still on screen, and
        // saying it was stored when it was not would be the worse failure.
      }
    }
    return { origin, actionGroupId, prior, applied: style, warnings, persisted }
  }

  #push(): void {
    const view = this.view
    for (const listener of this.#listeners) listener(view)
  }
}

/**
 * Sanitizing here rather than in the panel means no caller can route around
 * it. The tool path never touched the panel's sanitizer, so custom CSS from an
 * agent reached the book with its `@import` and remote `url()` intact.
 */
function sanitize(style: ReaderStyle): { style: ReaderStyle; warnings: readonly string[] } {
  if (style.customCss === undefined) return { style, warnings: [] }
  const bounded = boundCustomCss(style.customCss)
  const warnings = bounded.removed.map((what) => `Applied without ${what}.`)
  return { style: { ...style, customCss: bounded.css }, warnings }
}
