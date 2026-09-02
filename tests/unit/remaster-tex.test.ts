import { describe, expect, it } from 'vitest'
import { compileTex, isDisplayTex, parseTex, TexUnsupportedError } from '../../src/remaster/tex.ts'

function mathml(tex: string): string {
  return compileTex(tex, { document }).element.querySelector('semantics')!.firstElementChild!.outerHTML
}

function text(tex: string): string {
  return compileTex(tex, { document }).text
}

describe('TeX to MathML compilation', () => {
  it('compiles a bare variable, the book’s most common case', () => {
    expect(mathml('\\({x}\\)')).toBe('<mi>x</mi>')
    expect(text('\\({x}\\)')).toBe('x')
  })

  it('compiles the fraction forms the book uses interchangeably', () => {
    for (const command of ['frac', 'dfrac', 'tfrac']) {
      expect(mathml(`\\({\\${command}{dy}{dx}}\\)`)).toBe(
        '<mfrac><mrow><mi>d</mi><mi>y</mi></mrow><mrow><mi>d</mi><mi>x</mi></mrow></mfrac>',
      )
    }
  })

  it('gives the search index a linear form instead of TeX source', () => {
    // This is the whole point of `alttext`: before restoration the passage text
    // was the literal string `\({\dfrac{dy}{dx}}\)`.
    expect(text('\\({\\dfrac{dy}{dx}}\\)')).toBe('dy/dx')
    expect(text('\\({x^{2}+a^{2}}\\)')).toBe('x^2+a^2')
    expect(text('\\({\\sqrt{a+x}}\\)')).toBe('√(a+x)')
  })

  it('merges adjacent digits into one number', () => {
    expect(mathml('\\({120}\\)')).toBe('<mn>120</mn>')
  })

  it('merges a subscript and a superscript on one base', () => {
    expect(mathml('\\({x_1^2}\\)')).toBe('<msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup>')
    expect(mathml('\\({x^2_1}\\)')).toBe('<msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup>')
  })

  it('keeps \\left and \\right delimiters as stretchy fences', () => {
    expect(mathml('\\({\\left(x\\right)}\\)')).toBe(
      '<mrow><mo fence="true" stretchy="true">(</mo><mi>x</mi><mo fence="true" stretchy="true">)</mo></mrow>',
    )
  })

  it('sets named operators upright so they are not read as products', () => {
    expect(mathml('\\({\\sin x}\\)')).toBe(
      '<mrow><mi mathvariant="normal">sin</mi><mi>x</mi></mrow>',
    )
  })

  it('compiles a multi-line derivation into a table', () => {
    const compiled = compileTex('\\[ \\begin{aligned} y & = x \\\\ & = 2 \\end{aligned} \\]', {
      document,
    })
    const table = compiled.element.querySelector('mtable')
    expect(table?.getAttribute('columnalign')).toBe('right left')
    expect(table?.querySelectorAll('mtr')).toHaveLength(2)
    expect(compiled.text).toBe('y =x; =2')
  })

  it('marks display TeX as a block equation and inline TeX as inline', () => {
    expect(isDisplayTex('\\[ x \\]')).toBe(true)
    expect(isDisplayTex('\\({x}\\)')).toBe(false)
    expect(compileTex('\\[ x \\]', { document }).element.getAttribute('display')).toBe('block')
    expect(compileTex('\\({x}\\)', { document }).element.getAttribute('display')).toBe('inline')
  })

  it('preserves the source TeX losslessly as a standard annotation', () => {
    const source = '\\({\\dfrac{dy}{dx}}\\)'
    const annotation = compileTex(source, { document }).element.querySelector(
      'annotation[encoding="application/x-tex"]',
    )
    expect(annotation?.textContent).toBe(source)
  })

  it('builds MathML in the MathML namespace, never by parsing a string', () => {
    const math = compileTex('\\({x}\\)', { document }).element
    expect(math.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML')
    expect(math.querySelector('mi')?.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML')
  })

  it('is deterministic: the same source compiles to the same output', () => {
    const source = '\\({\\frac{1}{2} u^{-\\tfrac{1}{2}}}\\)'
    expect(mathml(source)).toBe(mathml(source))
  })

  describe('declining rather than guessing', () => {
    it('names the construct it cannot compile', () => {
      expect(() => parseTex('\\({\\underline{x}}\\)')).toThrowError(TexUnsupportedError)
      try {
        parseTex('\\({\\underline{x}}\\)')
      } catch (error) {
        expect((error as TexUnsupportedError).construct).toBe('\\underline')
      }
    })

    it('refuses unbalanced groups instead of repairing them silently', () => {
      expect(() => parseTex('\\({\\frac{1}{2}')).toThrowError(TexUnsupportedError)
      expect(() => parseTex('x}')).toThrowError(TexUnsupportedError)
    })

    it('bounds hostile input by length, depth, and node count', () => {
      expect(() => parseTex('x'.repeat(5000))).toThrowError(/too long/)
      expect(() => parseTex('{'.repeat(64) + 'x' + '}'.repeat(64))).toThrowError(/too deeply nested/)
    })

    it('cannot emit markup from a hostile data-tex, because it builds nodes', () => {
      // The compiler has no string-to-DOM path at all, so a markup payload is
      // compiled as the characters it is made of rather than as elements.
      const math = compileTex('<script>alert(1)</script>', { document }).element
      expect(math.querySelector('script')).toBeNull()
      expect(math.getElementsByTagName('*').length).toBeGreaterThan(0)
      for (const node of math.querySelectorAll('*')) {
        expect(node.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML')
      }
    })
  })
})
