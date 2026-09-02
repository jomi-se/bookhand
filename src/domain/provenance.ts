/**
 * Who did this, and how it is taken back.
 *
 * A study board holds two kinds of work that look identical once written: what
 * the person wrote, and what an agent wrote for them. Once those are
 * indistinguishable the board stops being trustworthy — a person cannot review
 * what they cannot tell apart, and cannot undo what they cannot attribute.
 *
 * So provenance is recorded at the row, not inferred at the surface, and every
 * mutation hands back the exact reversal a person can perform.
 * `VAL-ACTION-PROVENANCE-UNDO` and `VAL-STUDY-ID-OWNERSHIP`.
 */

export type MutationOrigin = 'user' | 'agent'

export type ReversalKind = 'undo' | 'return-to-source' | 'delete' | 'reset'

/**
 * A reversal the interface actually offers, named exactly as it appears.
 *
 * Undo and Delete are deliberately distinct. Undo restores what was there
 * before this action — including putting back a previous version. Delete
 * removes the block outright, whatever its history. Conflating them would make
 * one of the two lie about what it does.
 */
export interface ReversalAction {
  readonly kind: ReversalKind
  readonly label: string
  readonly description: string
}

export interface MutationReceipt<T> {
  readonly operation: 'create' | 'update'
  readonly origin: MutationOrigin
  /** Groups the writes of one intent, so they are undone together. */
  readonly actionGroupId: string
  /** What was there before. Absent on a create, because nothing was. */
  readonly prior?: T
  readonly applied: T
  /**
   * Returned once, on an agent create. An agent may later update only the items
   * it made, and only by presenting this. It is never listed back to an agent,
   * so possession of it is evidence of authorship.
   */
  readonly updateToken?: string
  /** What this mutation could reach, in the words a person would use. */
  readonly scope: string
  /** Anything the input had to be corrected for; empty when it was clean. */
  readonly warnings: readonly string[]
  readonly persisted: boolean
  readonly actions: readonly ReversalAction[]
}

export const UNDO_ACTION: ReversalAction = {
  kind: 'undo',
  label: 'Undo',
  description: 'Put the board back the way it was before this change.',
}

/**
 * Presentation gets its own pair, worded for what they actually do. Reusing
 * the board's Undo here would have promised to restore a board.
 */
export const UNDO_PRESENTATION_ACTION: ReversalAction = {
  kind: 'undo',
  label: 'Undo',
  description: 'Put the text settings back the way they were before this change.',
}

export const RESET_PRESENTATION_ACTION: ReversalAction = {
  kind: 'reset',
  label: 'Reset all text settings',
  description: 'Return to the presentation the publisher intended.',
}

export const UNDO_BOARD_VIEW_ACTION: ReversalAction = {
  kind: 'undo',
  label: 'Undo',
  description: 'Put the study board back the way it was laid out before this change.',
}

export const RETURN_TO_SOURCE_ACTION: ReversalAction = {
  kind: 'return-to-source',
  label: 'Return to source',
  description: 'Open the book at the passage this block came from.',
}

export const DELETE_ACTION: ReversalAction = {
  kind: 'delete',
  label: 'Delete',
  description: 'Remove this block from the board for good.',
}

/**
 * Canonical form of a payload, for deciding whether a retry is the same action.
 *
 * Key order is normalized so that two structurally identical payloads a caller
 * happened to serialize differently are treated as the same intent rather than
 * as a conflict.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]))
}

/**
 * The message is the one written for a person, not the diagnostic.
 *
 * These errors cross a worker boundary, where only `code`, `message`, and
 * `retryable` survive — the class does not. Anything that decides what a person
 * sees by testing `instanceof` therefore works in a unit test and silently
 * fails in the running product, showing an internal string instead. Putting the
 * person's wording in `message` removes that whole failure mode: whatever
 * arrives is already the right thing to show.
 */
export class OwnershipError extends Error {
  readonly code = 'ownership'
  readonly detail: string

  constructor(userMessage: string, detail: string) {
    super(userMessage)
    this.name = 'OwnershipError'
    this.detail = detail
  }

  /** Kept for call sites that want to be explicit about which text they mean. */
  get userMessage(): string {
    return this.message
  }
}

/**
 * A refusal that tells the caller how to become able to do the thing.
 *
 * Like `OwnershipError`, the person-facing wording is the Error's own message,
 * because that is the only field that survives the worker boundary.
 */
export class HandshakeError extends Error {
  readonly code = 'handshake'
  readonly retryable = true

  constructor(message: string) {
    super(message)
    this.name = 'HandshakeError'
  }
}
