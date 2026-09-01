import { describe, expect, it } from 'vitest'
import {
  extractDocumentText,
  fingerprintText,
  normalizeBookText,
} from '../../src/reader/index.ts'
import { toTextRange } from '../../src/reader/text.ts'

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
