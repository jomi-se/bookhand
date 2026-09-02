import { describe, expect, it } from 'vitest'
import {
  extractDocumentText,
  fingerprintText,
  normalizeBookText,
} from '../../src/reader/index.ts'
import { passageFromRange, toSemanticTextRange, toTextRange } from '../../src/reader/text.ts'

describe('reader text snapshots', () => {
  it('normalizes visible content while excluding active and hidden content', () => {
    const document = new DOMParser().parseFromString(
      `<html><body>
        <p> First\n paragraph. </p>
        <script>window.bad = true</script>
        <style>.bad { display: block }</style>
        <p hidden>Hidden sentence</p>
        <figure><img alt="An increasing curve"><figcaption>Figure 7</figcaption></figure>
      </body></html>`,
      'text/html',
    )
    expect(extractDocumentText(document)).toBe(
      'First paragraph. An increasing curve Figure 7',
    )
  })

  it('produces a stable short fingerprint from normalized text', () => {
    expect(normalizeBookText(' Alpha\n exact  ')).toBe('Alpha exact')
    expect(fingerprintText(' Alpha\n exact  ')).toBe(fingerprintText('Alpha exact'))
    expect(fingerprintText('Alpha exact')).not.toBe(fingerprintText('Beta exact'))
  })
})

describe('anchoring a range to its text', () => {
  function fixture(markup: string): Document {
    return new DOMParser().parseFromString(`<html><body>${markup}</body></html>`, 'text/html')
  }

  it('leaves a selection that already ends on text alone', () => {
    const doc = fixture('<p>Alpha beta gamma.</p>')
    const text = doc.querySelector('p')!.firstChild!
    const range = doc.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    expect(toTextRange(range)).toBe(range)
  })

  it('moves element boundaries onto the text they contain', () => {
    const doc = fixture('<p>Alpha beta gamma.</p>')
    const paragraph = doc.querySelector('p')!
    const range = doc.createRange()
    range.selectNodeContents(paragraph)

    const anchored = toTextRange(range)
    expect(anchored.startContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(anchored.endContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(anchored.toString()).toBe('Alpha beta gamma.')
  })

  it('spans across elements without losing either end', () => {
    const doc = fixture('<p>First part</p><p>second part</p>')
    const range = doc.createRange()
    range.setStartBefore(doc.querySelectorAll('p')[0]!)
    range.setEndAfter(doc.querySelectorAll('p')[1]!)

    const anchored = toTextRange(range)
    expect(anchored.startContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(anchored.endContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(anchored.toString()).toContain('First part')
    expect(anchored.toString()).toContain('second part')
  })
})

describe('math-faithful passage serialization', () => {
  function fixture(markup: string): Document {
    return new DOMParser().parseFromString(`<html><body>${markup}</body></html>`, 'text/html')
  }

  function wholeBody(doc: Document): string {
    const range = doc.createRange()
    range.selectNodeContents(doc.body)
    return passageFromRange(range, 3, ['Chapter X'], () => 'epubcfi(/6/4)').text
  }

  it('prefers an explicit data-tex over anything the renderer produced', () => {
    const doc = fixture(
      '<p>The rate is <span data-tex="dy/dx"><i>dy</i><i>dx</i></span> at that point.</p>',
    )
    expect(wholeBody(doc)).toBe('The rate is dy/dx at that point.')
  })

  it('reads MathML alttext rather than flattening the markup', () => {
    const doc = fixture(
      '<p>Let <math alttext="dy/dx"><mi>d</mi><mi>y</mi><mi>d</mi><mi>x</mi></math> grow.</p>',
    )
    expect(wholeBody(doc)).toBe('Let dy/dx grow.')
  })

  it('falls back to a TeX annotation when there is no alttext', () => {
    const doc = fixture(
      '<p>Let <math><mi>x</mi><annotation encoding="application/x-tex">\\frac{dy}{dx}</annotation></math> grow.</p>',
    )
    expect(wholeBody(doc)).toContain('\\frac{dy}{dx}')
  })

  it('uses a MathML aria-label when no stronger mathematical alternative exists', () => {
    const doc = fixture(
      '<p>Let <math aria-label="m equals delta y over delta x"><mi>m</mi><mfrac><mi>y</mi><mi>x</mi></mfrac></math> be the slope.</p>',
    )
    expect(wholeBody(doc)).toContain('m equals delta y over delta x')
  })

  it('keeps an equation image that would otherwise vanish entirely', () => {
    const doc = fixture('<p>so that <img alt="dy/dx = 2x"> holds.</p>')
    expect(wholeBody(doc)).toBe('so that dy/dx = 2x holds.')
  })

  it('states a figure once, not once per alternative', () => {
    const doc = fixture(
      '<figure><img alt="A curve rising to the right"><figcaption>Fig. 7</figcaption></figure>',
    )
    const text = wholeBody(doc)
    expect(text).toBe('A curve rising to the right Fig. 7')
    expect(text.match(/A curve rising/gu)).toHaveLength(1)
  })

  it('keeps semantic element kinds in their original order', () => {
    const doc = fixture(
      '<p>Before <math alttext="dy/dx"><mi>x</mi></math> beside <img alt="a tangent figure"> after.</p>',
    )
    const range = doc.createRange()
    range.selectNodeContents(doc.body)
    const passage = passageFromRange(range, 3, [], () => 'epubcfi(/6/4)')
    expect(passage.segments).toEqual([
      { kind: 'text', text: 'Before' },
      { kind: 'math', text: 'dy/dx' },
      { kind: 'text', text: 'beside' },
      { kind: 'figure', text: 'a tangent figure' },
      { kind: 'text', text: 'after.' },
    ])
  })

  it('envelopes a figure-only range with stable text endpoints', () => {
    const doc = fixture('<p>Before.</p><figure><img alt="A curve"><figcaption>Fig. 1</figcaption></figure><p>After.</p>')
    const range = doc.createRange()
    range.selectNode(doc.querySelector('img')!)
    const anchored = toSemanticTextRange(range)
    expect(anchored.startContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(anchored.endContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(anchored.startContainer.nodeValue).toContain('Before')
    expect(anchored.endContainer.nodeValue).toContain('After.')
    const repeated = toSemanticTextRange(anchored)
    expect(repeated.startContainer).toBe(anchored.startContainer)
    expect(repeated.startOffset).toBe(anchored.startOffset)
    expect(repeated.endContainer).toBe(anchored.endContainer)
    expect(repeated.endOffset).toBe(anchored.endOffset)
  })

  it('says nothing for a decorative image the author marked as empty', () => {
    const doc = fixture('<p>Before<img alt="">after.</p>')
    expect(wholeBody(doc)).toBe('Before after.')
  })

  it('reads an SVG figure through its title and description', () => {
    const doc = fixture(
      '<p><svg><title>A tangent line</title><desc>Touching the curve at one point</desc><path/></svg></p>',
    )
    expect(wholeBody(doc)).toBe('A tangent line. Touching the curve at one point')
  })

  it('does not quote text the reader cannot see', () => {
    const doc = fixture(
      '<p>Visible.</p><p hidden>Hidden.</p><p aria-hidden="true">Also hidden.</p>',
    )
    expect(wholeBody(doc)).toBe('Visible.')
  })

  it('keeps prose in document order across blocks', () => {
    const doc = fixture('<h2>Chapter X</h2><p>First.</p><p>Second.</p>')
    expect(wholeBody(doc)).toBe('Chapter X First. Second.')
  })

  it('fingerprints the serialized text, so a lost equation changes the range', () => {
    const withMath = fixture('<p>The ratio <math alttext="dy/dx"><mi>x</mi></math> matters.</p>')
    const withoutMath = fixture('<p>The ratio matters.</p>')
    const range = withMath.createRange()
    range.selectNodeContents(withMath.body)
    const other = withoutMath.createRange()
    other.selectNodeContents(withoutMath.body)

    const a = passageFromRange(range, 3, [], () => 'epubcfi(/6/4)')
    const b = passageFromRange(other, 3, [], () => 'epubcfi(/6/4)')
    expect(a.text).toBe('The ratio dy/dx matters.')
    expect(a.range.textFingerprint).not.toBe(b.range.textFingerprint)
  })
})

describe('the bundled book’s own math markup', () => {
  it('reads Project Gutenberg equation images as TeX rather than spoken alt text', () => {
    // Verbatim from Chapter X of the bundled Calculus Made Easy.
    const doc = new DOMParser().parseFromString(
      `<html><body><p>the ratio <span class="nowrap"><img alt="StartFraction d y Over d x EndFraction" data-tex="\\({\\dfrac{dy}{d x}}\\)" src="i.svg"/></span> is the rate.</p></body></html>`,
      'text/html',
    )
    const range = doc.createRange()
    range.selectNodeContents(doc.body)
    const text = passageFromRange(range, 9, ['Chapter X'], () => 'epubcfi(/6/4)').text

    expect(text).toContain('\\dfrac{dy}{d x}')
    expect(text).toContain('dy')
    expect(text).toContain('d x')
    // The spoken-word alt is a worse statement of the same thing; only one wins.
    expect(text).not.toContain('StartFraction')
  })

  it('drops the chapter ornaments Gutenberg marks as decorative', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><p>Before<img alt="decorative" src="i_001.jpg"/>after.</p></body></html>',
      'text/html',
    )
    const range = doc.createRange()
    range.selectNodeContents(doc.body)
    expect(passageFromRange(range, 9, [], () => 'epubcfi(/6/4)').text).toBe('Before after.')
  })
})
