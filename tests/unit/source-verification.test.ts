import { describe, expect, it } from 'vitest'

import {
  compareQuote,
  normalizeQuote,
  SourceVerificationError,
  verifyBookOwnership,
  verifyFingerprint,
} from '../../src/domain/source-verification.ts'

/**
 * Written from `VAL-RANGE-OWNERSHIP`'s prose, not from the implementation.
 * If the two ever disagree the contract is the authority, and this test is how
 * that disagreement surfaces instead of being absorbed silently.
 */
function independentlyNormalize(value: string): string {
  const nfc = value.normalize('NFC')
  const unixNewlines = nfc.split('\r\n').join('\n').split('\r').join('\n')
  const collapsed = [...unixNewlines]
    .map((char) => (/[\t\n\v\f\r ]/u.test(char) || /\p{Zs}/u.test(char) ? ' ' : char))
    .join('')
    .replace(/ {2,}/gu, ' ')
  return collapsed.replace(/^ +| +$/gu, '')
}

function codeOf(run: () => void): string {
  try {
    run()
  } catch (error) {
    if (error instanceof SourceVerificationError) return error.code
    throw error
  }
  throw new Error('expected a rejection')
}

describe('quote normalization', () => {
  const cases: readonly [string, string][] = [
    ['plain text', 'plain text'],
    ['  leading and trailing  ', 'leading and trailing'],
    ['tabs\tand\nnewlines', 'tabs and newlines'],
    ['windows\r\nline\rendings', 'windows line endings'],
    ['non breaking space', 'non breaking space'],
    ['collapse     long     runs', 'collapse long runs'],
    ['é composes', 'é composes'],
  ]

  it.each(cases)('normalizes %j', (input, expected) => {
    expect(normalizeQuote(input)).toBe(expected)
  })

  it.each(cases)('agrees with an independent implementation on %j', (input) => {
    expect(normalizeQuote(input)).toBe(independentlyNormalize(input))
  })

  it('leaves everything the contract calls significant alone', () => {
    // Case, punctuation, zero-width characters, and math symbols survive.
    for (const value of ['Rate', 'rate', 'dy/dx', 'dy / dx', 'a​b', '∫ f(x) dx', 'ẋ']) {
      expect(normalizeQuote(value)).toBe(value.normalize('NFC'))
    }
  })

  it('does not treat differently-cased or differently-punctuated quotes as equal', () => {
    expect(normalizeQuote('Rate')).not.toBe(normalizeQuote('rate'))
    expect(normalizeQuote('dy/dx')).not.toBe(normalizeQuote('dy / dx'))
  })
})

describe('source claim rejection', () => {
  it('accepts a quote that differs from the source only in whitespace', () => {
    expect(() => compareQuote('  the   slope\nat a point ', 'the slope at a point')).not.toThrow()
  })

  it('names a partial quote as partial rather than invented', () => {
    expect(codeOf(() => compareQuote('the slope', 'the slope at a point'))).toBe('partial-quote')
  })

  it('rejects a quote the range does not contain', () => {
    expect(codeOf(() => compareQuote('the curvature', 'the slope at a point'))).toBe(
      'invented-quote',
    )
  })

  it('rejects an empty quote rather than matching everything', () => {
    expect(codeOf(() => compareQuote('   ', 'the slope at a point'))).toBe('invented-quote')
  })

  it('rejects invented math even when the surrounding words are right', () => {
    expect(codeOf(() => compareQuote('dy/dz is the rate', 'dy/dx is the rate'))).toBe(
      'invented-quote',
    )
  })

  it('rejects a claim naming a book other than the one open', () => {
    expect(codeOf(() => verifyBookOwnership('book-2', 'book-1'))).toBe('wrong-book')
    expect(() => verifyBookOwnership('book-1', 'book-1')).not.toThrow()
  })

  it('rejects a stale fingerprint but tolerates a source that reports none', () => {
    expect(codeOf(() => verifyFingerprint('fnv1a-old', 'fnv1a-new'))).toBe('stale-fingerprint')
    expect(() => verifyFingerprint('fnv1a-old', undefined)).not.toThrow()
  })

  it('carries a message safe to show a person, separate from the detail', () => {
    try {
      compareQuote('invented', 'actual')
    } catch (error) {
      const rejection = error as SourceVerificationError
      expect(rejection.userMessage).toBe('That quotation does not match the text at that location.')
      // The message shown to a person never repeats what the caller claimed.
      expect(rejection.userMessage).not.toContain('invented')
    }
  })
})
