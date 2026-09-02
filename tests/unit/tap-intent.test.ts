import { describe, expect, it } from 'vitest'

import {
  TAP_DURATION_LIMIT,
  TAP_MOVEMENT_LIMIT,
  isInteractiveTarget,
  tapZone,
} from '../../src/reader/tap-intent.ts'

/** One touch that lands and lifts in the same place unless told otherwise. */
function tap(
  at: number,
  drift: { x?: number; y?: number; ms?: number; hadSelection?: boolean } = {},
) {
  const started = { x: at, y: 400, at: 0, hadSelection: drift.hadSelection ?? false }
  const ended = {
    x: at + (drift.x ?? 0),
    y: 400 + (drift.y ?? 0),
    at: drift.ms ?? 100,
    fraction: (at + (drift.x ?? 0)) / 400,
  }
  return tapZone(started, ended)
}

describe('tap intent', () => {
  it('turns back from the left quarter and forward from the right quarter', () => {
    expect(tap(40)).toBe('previous')
    expect(tap(360)).toBe('next')
  })

  it('gives the middle half to the chrome, which is the larger target', () => {
    expect(tap(200)).toBe('center')
    // Exactly on a boundary belongs to the centre, so the edges are strictly
    // the outer quarters and never overlap.
    expect(tap(100)).toBe('center')
    expect(tap(300)).toBe('center')
  })

  it('refuses a fraction it cannot trust', () => {
    expect(
      tapZone(
        { x: 0, y: 0, at: 0, hadSelection: false },
        { x: 0, y: 0, at: 10, fraction: Number.NaN },
      ),
    ).toBeUndefined()
  })

  it('holds the boundaries exactly, on both sides of each', () => {
    expect(tap(200, { x: TAP_MOVEMENT_LIMIT })).toBe('center')
    expect(tap(200, { x: TAP_MOVEMENT_LIMIT + 1 })).toBeUndefined()
    expect(tap(200, { ms: TAP_DURATION_LIMIT })).toBe('center')
    expect(tap(200, { ms: TAP_DURATION_LIMIT + 1 })).toBeUndefined()
  })

  it('measures movement diagonally, not per axis', () => {
    // 8 across and 8 down is 11.3 travelled, which is a drag even though
    // neither axis alone passes the limit.
    expect(tap(200, { x: 8, y: 8 })).toBeUndefined()
  })

  it('is not a tap when text was already selected', () => {
    expect(tap(40, { hadSelection: true })).toBeUndefined()
  })

  it('leaves the book’s own controls alone', () => {
    const doc = new DOMParser().parseFromString(
      '<body><p id="prose">text <a href="#x" id="link">note</a></p></body>',
      'text/html',
    )
    expect(isInteractiveTarget(doc.getElementById('link'))).toBe(true)
    expect(isInteractiveTarget(doc.getElementById('prose'))).toBe(false)
    expect(isInteractiveTarget(null)).toBe(false)
  })
})
