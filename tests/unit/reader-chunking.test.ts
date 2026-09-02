import { describe, expect, it } from 'vitest'

import { buildSectionChunks } from '../../src/reader/chunking.ts'

function documentWith(markup: string): Document {
  return new DOMParser().parseFromString(`<html><body>${markup}</body></html>`, 'text/html')
}

function chunksFor(document: Document) {
  return buildSectionChunks(document, 0, 'Test section', () => 'epubcfi(/6/2)')
}

describe('search chunk boundaries', () => {
  it('keeps mixed authored blocks in document order without overlapping content', () => {
    const chunks = chunksFor(
      documentWith(`
        <h2>ORDER_HEADING</h2>
        <p>ORDER_FIRST ${'first '.repeat(90)}</p>
        <figure><img alt="ORDER_FIGURE"><figcaption>ORDER_CAPTION</figcaption></figure>
        <p>ORDER_LAST ${'last '.repeat(90)}</p>
      `),
    )
    const text = chunks.map((chunk) => chunk.text).join(' ')

    expect(text.indexOf('ORDER_HEADING')).toBeLessThan(text.indexOf('ORDER_FIRST'))
    expect(text.indexOf('ORDER_FIRST')).toBeLessThan(text.indexOf('ORDER_FIGURE'))
    expect(text.indexOf('ORDER_FIGURE')).toBeLessThan(text.indexOf('ORDER_LAST'))
    for (const marker of ['ORDER_HEADING', 'ORDER_FIRST', 'ORDER_FIGURE', 'ORDER_CAPTION', 'ORDER_LAST']) {
      expect(text.match(new RegExp(marker, 'g'))).toHaveLength(1)
    }
  })

  it('bounds canonical math and figure alternatives rather than raw DOM text', () => {
    const semanticRuns = Array.from(
      { length: 18 },
      (_, index) =>
        `<span>RUN_${index}</span><img data-tex="\\({${`v_${index}`.repeat(30)}}\\)" alt="ignored">`,
    ).join(' ')
    const chunks = chunksFor(documentWith(`<p>START ${semanticRuns} END</p>`))
    const text = chunks.map((chunk) => chunk.text).join(' ')

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.text.length <= 1_200)).toBe(true)
    for (let index = 0; index < 18; index += 1) {
      expect(text.match(new RegExp(`RUN_${index}(?!\\d)`, 'g'))).toHaveLength(1)
    }
  })

  it('does not cut a citation between adjacent semantic figures', () => {
    const chunks = chunksFor(
      documentWith(`
        <p>${'before '.repeat(150)}</p>
        <figure><img alt="SEMANTIC_NINE"><figcaption>FIGURE_NINE</figcaption></figure>
        <figure><img alt="SEMANTIC_TEN"><figcaption>FIGURE_TEN</figcaption></figure>
        <p>FOLLOWING_PROSE ${'after '.repeat(80)}</p>
      `),
    )
    const semanticChunk = chunks.find((chunk) => chunk.text.includes('SEMANTIC_NINE'))

    expect(semanticChunk?.text).toContain('SEMANTIC_TEN')
    expect(chunks.every((chunk) => chunk.text.length <= 1_200)).toBe(true)
  })

  it('bisects an indivisible long text node at exact character boundaries', () => {
    const chunks = chunksFor(documentWith(`<p>${'a'.repeat(1_500)}SINGLE_NODE_END</p>`))

    expect(chunks.length).toBe(2)
    expect(chunks.every((chunk) => chunk.text.length <= 1_200)).toBe(true)
    expect(chunks.map((chunk) => chunk.text).join('')).toBe(`${'a'.repeat(1_500)}SINGLE_NODE_END`)
  })

  it('keeps a final single authored block after earlier groups flush', () => {
    const chunks = chunksFor(
      documentWith(`<p>${'first '.repeat(220)}</p><p>FINAL_AUTHORED_BLOCK</p>`),
    )

    expect(chunks.some((chunk) => chunk.text.includes('FINAL_AUTHORED_BLOCK'))).toBe(true)
  })
})
