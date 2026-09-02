import { describe, expect, it } from 'vitest'
import {
  sanitizeSectionHtml,
  sanitizeSrcset,
  SanitizeError,
} from '../../src/remaster/sanitize.ts'

const clean = (html: string) => sanitizeSectionHtml(html).html

describe('sanitizing agent-authored markup', () => {
  it('passes through the semantic HTML a repair is made of', () => {
    const html =
      '<section><h2>On relative growings</h2><p>The ratio <math><mi>x</mi></math> matters.</p></section>'
    expect(clean(html)).toBe(html)
    expect(sanitizeSectionHtml(html).modified).toBe(false)
  })

  it('keeps MathML structure and its TeX annotation intact', () => {
    const html =
      '<math display="block" alttext="dy/dx"><semantics><mfrac><mi>d</mi><mi>x</mi></mfrac>' +
      '<annotation encoding="application/x-tex">\\frac{dy}{dx}</annotation></semantics></math>'
    expect(clean(html)).toBe(html)
  })

  it('keeps the blob URLs that make the book’s own figures work', () => {
    const html = '<figure><img src="blob:http://localhost/abc-123" alt="Fig. 4"></figure>'
    expect(clean(html)).toBe(html)
  })

  describe('what it refuses', () => {
    it('removes a script and everything in it', () => {
      const result = sanitizeSectionHtml('<p>before</p><script>fetch("/steal")</script><p>after</p>')
      expect(result.html).toBe('<p>before</p><p>after</p>')
      expect(result.removedElements.script).toBe(1)
      expect(result.modified).toBe(true)
    })

    it('removes event handlers while keeping the element', () => {
      const result = sanitizeSectionHtml('<p onclick="steal()" class="para">text</p>')
      expect(result.html).toBe('<p class="para">text</p>')
      expect(result.removedAttributes.onclick).toBe(1)
    })

    it('refuses a javascript: URL', () => {
      const result = sanitizeSectionHtml('<a href="javascript:alert(1)">click</a>')
      expect(result.html).toBe('<a>click</a>')
    })

    it('refuses an off-origin image, which would leak the reading position', () => {
      const result = sanitizeSectionHtml('<img src="https://tracker.example/pixel.gif" alt=""/>')
      expect(result.html).toBe('<img alt="">')
      expect(result.removedAttributes.src).toBe(1)
    })

    it('refuses an off-origin link but keeps its words', () => {
      expect(clean('<a href="https://example.com/x">the text</a>')).toBe('<a>the text</a>')
    })

    it('removes iframes, forms, and inputs entirely', () => {
      const result = sanitizeSectionHtml(
        '<p>a</p><iframe src="blob:x"></iframe><form><input name="p"/></form><p>b</p>',
      )
      expect(result.html).toBe('<p>a</p><p>b</p>')
      expect(result.removedElements).toMatchObject({ iframe: 1, form: 1, input: 1 })
    })

    it('unwraps an unknown element rather than losing the reader’s text', () => {
      const result = sanitizeSectionHtml('<p>Consider <marquee>this passage</marquee> closely.</p>')
      expect(result.html).toBe('<p>Consider this passage closely.</p>')
      expect(result.removedElements.marquee).toBe(1)
    })

    it('strips @import and remote url() from a stylesheet but keeps the typography', () => {
      const result = sanitizeSectionHtml(
        '<style>@import url("https://evil.example/x.css"); p { color: red; background: url(https://t.example/p.gif); }</style>',
      )
      expect(result.html).toContain('color: red')
      expect(result.html).not.toContain('@import')
      expect(result.html).not.toContain('evil.example')
      expect(result.html).not.toContain('t.example')
    })

    it('refuses an inline style that tries to fetch', () => {
      const result = sanitizeSectionHtml('<p style="background: url(https://t.example/p.gif)">x</p>')
      expect(result.html).toBe('<p>x</p>')
    })

    it('removes comments, which say nothing to a reader', () => {
      expect(clean('<p>a<!-- payload -->b</p>')).toBe('<p>ab</p>')
    })

    it('refuses markup that is too large to be a section', () => {
      expect(() => sanitizeSectionHtml('<p>x</p>'.repeat(300_000))).toThrowError(SanitizeError)
    })

    it('survives markup that is not well formed', () => {
      // A model producing unbalanced tags must not be able to break the reader.
      expect(() => sanitizeSectionHtml('<p><div><span>text')).not.toThrow()
      expect(clean('<p><div><span>text')).toContain('text')
    })
  })

  it('reports every refusal so a partly rejected proposal is visible', () => {
    const result = sanitizeSectionHtml(
      '<script>a()</script><p onclick="b()">text</p><iframe></iframe>',
    )
    expect(result.removedElements).toMatchObject({ script: 1, iframe: 1 })
    expect(result.removedAttributes).toMatchObject({ onclick: 1 })
    expect(result.modified).toBe(true)
  })
})

describe('package-relative resources', () => {
  it('keeps the relative paths an agent reads out of the book’s own source', () => {
    // Agents are handed the packaged XHTML, so this is the normal case: the
    // reference has to survive for Foliate's loader to resolve it.
    const html = '<figure><img src="images/fig4.svg" alt="Fig. 4"></figure>'
    expect(sanitizeSectionHtml(html).html).toBe(html)
    expect(sanitizeSectionHtml('<a href="chapter-4.xhtml#top">next</a>').html).toBe(
      '<a href="chapter-4.xhtml#top">next</a>',
    )
  })

  it('still refuses anything that leaves the book', () => {
    expect(sanitizeSectionHtml('<img src="https://t.example/p.gif">').html).toBe('<img>')
    expect(sanitizeSectionHtml('<img src="//t.example/p.gif">').html).toBe('<img>')
    expect(sanitizeSectionHtml('<a href="javascript:x()">t</a>').html).toBe('<a>t</a>')
  })

  it('keeps a relative url() in a stylesheet and drops a remote one', () => {
    const result = sanitizeSectionHtml(
      '<style>.a { background: url(images/rule.png); } .b { background: url(https://t.example/x.png); }</style>',
    )
    expect(result.html).toContain('url(images/rule.png)')
    expect(result.html).not.toContain('t.example')
  })
})

describe('srcset, which is a list and not a URL', () => {
  it('keeps the local candidates and drops only the ones that leave the book', () => {
    // Checking the raw attribute as if it were one URL is the bug this guards:
    // it either waves the whole list through or throws all of it away.
    expect(sanitizeSrcset('images/a.png 1x, https://t.example/b.png 2x')).toBe('images/a.png 1x')
    expect(sanitizeSrcset('images/a.png 1x, images/b.png 2x')).toBe(
      'images/a.png 1x, images/b.png 2x',
    )
  })

  it('removes the attribute when no candidate survives', () => {
    expect(sanitizeSrcset('https://t.example/a.png 1x, //t.example/b.png 2x')).toBeNull()
  })

  it('strips a hostile candidate out of a section’s markup', () => {
    const result = sanitizeSectionHtml(
      '<img srcset="images/fig.png 1x, https://t.example/pixel.gif 2x" alt="Fig">',
    )
    expect(result.html).toContain('images/fig.png 1x')
    expect(result.html).not.toContain('t.example')
    expect(result.removedAttributes['srcset-candidate']).toBe(1)
  })

  it('drops a srcset whose every candidate is off-origin', () => {
    const result = sanitizeSectionHtml('<img srcset="https://t.example/a.png 1x" alt="Fig">')
    expect(result.html).toBe('<img alt="Fig">')
    expect(result.removedAttributes.srcset).toBe(1)
  })
})
