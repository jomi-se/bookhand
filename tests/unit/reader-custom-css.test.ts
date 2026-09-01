import { describe, expect, it } from 'vitest'

import { boundCustomCss, MAXIMUM_CUSTOM_CSS_LENGTH } from '../../src/reader/custom-css.ts'

describe('bounding reader-supplied CSS', () => {
  it('keeps ordinary typographic rules untouched', () => {
    const css = 'p { text-indent: 1.2em; color: #333; }\nh1 { letter-spacing: -0.01em; }'
    expect(boundCustomCss(css)).toEqual({ css, removed: [] })
  })

  it.each([
    ['@import url("https://tracker.invalid/x.css"); p { color: red; }', '@import'],
    ['@import "https://tracker.invalid/x.css";', '@import'],
  ])('removes the import rule in %s', (css, reason) => {
    const bounded = boundCustomCss(css)
    expect(bounded.css).not.toContain('tracker.invalid')
    expect(bounded.removed).toContain(reason)
  })

  it.each([
    'body { background-image: url(https://tracker.invalid/pixel.png); }',
    "body { background: url('//tracker.invalid/pixel.png'); }",
    '@font-face { font-family: X; src: url("https://tracker.invalid/f.woff2"); }',
  ])('neutralizes the remote url() in %s', (css) => {
    const bounded = boundCustomCss(css)
    expect(bounded.css).not.toContain('tracker.invalid')
    expect(bounded.removed).toContain('remote url()')
  })

  it('preserves local data and blob references a person may legitimately use', () => {
    const css = 'li::marker { content: url(data:image/svg+xml;base64,PHN2Zy8+); }'
    expect(boundCustomCss(css).css).toBe(css)
    expect(boundCustomCss(css).removed).toEqual([])
  })

  it('caps runaway input and says that it did', () => {
    const bounded = boundCustomCss('a'.repeat(MAXIMUM_CUSTOM_CSS_LENGTH + 500))
    expect(bounded.css).toHaveLength(MAXIMUM_CUSTOM_CSS_LENGTH)
    expect(bounded.removed).toContain('over-long CSS')
  })
})
