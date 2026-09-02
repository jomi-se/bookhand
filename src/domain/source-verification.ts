import type { BookRange } from './reader.ts'

/**
 * Why source verification exists.
 *
 * A source-linked mutation claims that a specific run of text in the open book
 * says something. If that claim is not checked, an agent can attach a highlight
 * or a study block to words the book does not contain — and the interface will
 * render the fabrication with the book's own authority. Verification is what
 * keeps "the book says X" honest.
 *
 * `VAL-RANGE-OWNERSHIP` fixes the comparison exactly, because a normalization
 * that is merely reasonable is one an agent can be wrong about. Two independent
 * implementations must agree on every code point.
 */

/**
 * Unicode NFC, then CRLF/CR to LF, then every run of ASCII whitespace or
 * Unicode category `Zs` to one U+0020 space, then trim.
 *
 * Nothing else is touched. Case, punctuation, zero-width characters, and math
 * symbols all remain significant: `dy/dx` and `dy / dx` are different quotes,
 * and so are `Rate` and `rate`. The whitespace rule alone is forgiving, because
 * a selection's whitespace is an artifact of how the book was typeset, not of
 * what it says.
 */
export function normalizeQuote(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(/(?:[\t\n\v\f\r ]|\p{Zs})+/gu, ' ')
    .trim()
}

export type SourceRejectionCode =
  /** The claim names a book other than the one open. */
  | 'wrong-book'
  /** The range does not resolve against the open book at all. */
  | 'stale-range'
  /** The range resolves, but the text there has changed since it was captured. */
  | 'stale-fingerprint'
  /** The quote is a strict substring of what the range actually covers. */
  | 'partial-quote'
  /** The quote is not what the range covers. */
  | 'invented-quote'

export interface SourceClaim {
  readonly bookId: string
  readonly range: BookRange
  readonly quote: string
}

export class SourceVerificationError extends Error {
  readonly code: SourceRejectionCode
  /** Safe to show a person: it says what was wrong, never what was claimed. */
  readonly userMessage: string

  constructor(code: SourceRejectionCode, userMessage: string, detail: string) {
    super(detail)
    this.name = 'SourceVerificationError'
    this.code = code
    this.userMessage = userMessage
  }
}

const USER_MESSAGES: Record<SourceRejectionCode, string> = {
  'wrong-book': 'That passage belongs to a different book than the one open.',
  'stale-range': 'That location no longer exists in this book.',
  'stale-fingerprint': 'The text at that location has changed since it was captured.',
  'partial-quote': 'That quotation covers only part of the passage it points to.',
  'invented-quote': 'That quotation does not match the text at that location.',
}

export function rejectSource(code: SourceRejectionCode, detail: string): never {
  throw new SourceVerificationError(code, USER_MESSAGES[code], detail)
}

/**
 * Compare a claimed quote against the text the range actually resolves to.
 *
 * `partial-quote` is separated from `invented-quote` deliberately. A partial
 * quote is usually an honest range/quote mismatch worth naming precisely; an
 * invented quote is text that is not there at all. Both are rejected, but a
 * person reading the error deserves to know which happened.
 */
export function compareQuote(claimed: string, actual: string): void {
  const claimedText = normalizeQuote(claimed)
  const actualText = normalizeQuote(actual)
  if (claimedText === actualText) return
  if (claimedText.length === 0) {
    rejectSource('invented-quote', 'The claimed quote is empty after normalization')
  }
  if (actualText.includes(claimedText)) {
    rejectSource(
      'partial-quote',
      `The claimed quote is ${claimedText.length} of ${actualText.length} normalized characters of the range`,
    )
  }
  rejectSource('invented-quote', 'The claimed quote is not the text the range covers')
}

export function verifyBookOwnership(claimedBookId: string, openBookId: string): void {
  if (claimedBookId !== openBookId) {
    rejectSource('wrong-book', `Claimed book ${claimedBookId} is not the open book ${openBookId}`)
  }
}

export function verifyFingerprint(claimed: string, actual: string | undefined): void {
  if (actual === undefined) return
  if (claimed !== actual) {
    rejectSource('stale-fingerprint', 'The range fingerprint does not match the resolved text')
  }
}
