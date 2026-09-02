/**
 * Deciding whether a touch was a tap, and where it landed.
 *
 * Foliate handles swiping, but it does nothing at all with a tap: a touch that
 * does not move produces a velocity of zero, so its snap is a no-op. Tapping to
 * turn the page is the near-universal phone reading gesture, and the space it
 * would use was being spent on two permanent side rails. So tap intent is ours,
 * above Foliate's, and it must be careful — it sits over the book text, where
 * getting it wrong steals selection and link taps.
 * `VAL-MOBILE-GESTURES`.
 */

/** A tap moves at most this far, in CSS pixels. Beyond it, this was a drag. */
export const TAP_MOVEMENT_LIMIT = 10
/** And lasts at most this long. Beyond it, this was a press. */
export const TAP_DURATION_LIMIT = 350
/** The outer quarter on each side turns a page; the middle half is chrome. */
export const EDGE_ZONE_FRACTION = 0.25

export type TapZone = 'previous' | 'next' | 'center'

export interface TapStart {
  readonly x: number
  readonly y: number
  readonly at: number
  /** Whether text was already selected. Dismissing a selection is not a tap. */
  readonly hadSelection: boolean
}

export interface TapEnd {
  readonly x: number
  readonly y: number
  readonly at: number
  /**
   * Where along the book host the touch landed: 0 at its left edge, 1 at its
   * right. A fraction rather than a coordinate because the caller has to do
   * the conversion itself — inside Foliate's iframe the touch's own `clientX`
   * is measured against the entire paginated column set, thousands of pixels
   * wide, so anything derived from it there is meaningless.
   */
  readonly fraction: number
}

const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [contenteditable="true"], audio, video'

/** A tap on something the book itself made interactive belongs to the book. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(INTERACTIVE) !== null
}

/**
 * The zone a completed tap fell in, or `undefined` if it was not a tap.
 *
 * Right-to-left books are the caller's business: it passes the zone it wants
 * turned, and this only says which side was touched.
 */
export function tapZone(start: TapStart, end: TapEnd): TapZone | undefined {
  if (start.hadSelection) return undefined
  if (end.at - start.at > TAP_DURATION_LIMIT) return undefined
  if (Math.hypot(end.x - start.x, end.y - start.y) > TAP_MOVEMENT_LIMIT) return undefined
  if (!Number.isFinite(end.fraction)) return undefined

  if (end.fraction < EDGE_ZONE_FRACTION) return 'previous'
  if (end.fraction > 1 - EDGE_ZONE_FRACTION) return 'next'
  return 'center'
}
