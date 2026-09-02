import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { extractDocumentText } from '../../src/reader/index.ts'
import {
  passageFromAnchoredRange,
  passageFromRange,
  toSemanticTextRange,
} from '../../src/reader/text.ts'
import { makeBook } from '../../src/reader/foliate-module.ts'
import { buildSectionChunks } from '../../src/reader/chunking.ts'
import { fingerprintText } from '../../src/reader/text.ts'

describe('pinned Foliate fixture baseline', () => {
  it('parses real package metadata, nested navigation, XHTML, and accessible figure text', async () => {
    const bytes = await readFile('tests/fixtures/epub/tiny-book.epub')
    const file = new File([bytes], 'tiny-book.epub', {
      type: 'application/epub+zip',
    })

    const book = await makeBook(file)
    try {
      expect(book.metadata?.title).toBe('The Tiny Book of Slopes')
      expect(book.metadata?.author).toBe('Bookhand Fixture Authors')
      expect(book.toc?.[0]?.label).toBe('Foundations')
      expect(book.toc?.[0]?.subitems?.map((item) => item.label)).toEqual([
        'Rise and run',
        'Notation',
      ])
      expect(book.sections.map((section) => section.id)).toEqual([
        'OEBPS/chapter-1.xhtml',
        'OEBPS/chapter-2.xhtml',
      ])

      const document = await book.sections[0]?.createDocument?.()
      expect(document).toBeDefined()
      expect(extractDocumentText(document!)).toContain(
        'A slope compares a vertical change with a horizontal change.',
      )
      expect(extractDocumentText(document!)).toContain(
        'A line rising two units for every three units across',
      )
      expect(document!.querySelector('figure img')?.getAttribute('src')).toBe('slope.svg')

      // Upstream ships browser-native JavaScript without declarations.
      // @ts-expect-error foliate-js does not publish declaration files
      const CFI = await import('foliate-js/epubcfi.js')
      const anchor = document!.querySelector('#selection-anchor')!.firstChild!
      const selected = document!.createRange()
      selected.setStart(anchor, 0)
      selected.setEnd(anchor, 15)
      const cfi = CFI.joinIndir(book.sections[0]!.cfi!, CFI.fromRange(selected))
      const fresh = await book.sections[0]!.createDocument!()
      const resolveAnchor = book.resolveCFI!(cfi).anchor as (document: Document) => Range
      const roundTrip = resolveAnchor(fresh)
      expect(roundTrip.toString()).toBe('A slope compare')

      const figure = document!.querySelector('figure img')!
      const figureRange = document!.createRange()
      figureRange.selectNode(figure)
      const figureCfi = CFI.joinIndir(
        book.sections[0]!.cfi!,
        CFI.fromRange(toSemanticTextRange(figureRange)),
      )
      const figureDocument = await book.sections[0]!.createDocument!()
      const figureRoundTrip = (book.resolveCFI!(figureCfi).anchor as (document: Document) => Range)(
        figureDocument,
      )
      const figurePassage = passageFromRange(figureRoundTrip, 0, ['Foundations'], () => figureCfi)
      expect(figurePassage.text).toContain(
        'A line rising two units for every three units across',
      )
      expect(figurePassage.text).toContain('A packaged SVG with a readable caption.')

      const mixedRange = document!.createRange()
      mixedRange.setStart(anchor, 0)
      mixedRange.setEndAfter(document!.querySelector('math')!)
      const mixedCfi = CFI.joinIndir(
        book.sections[0]!.cfi!,
        CFI.fromRange(toSemanticTextRange(mixedRange)),
      )
      const mixedDocument = await book.sections[0]!.createDocument!()
      const mixedRoundTrip = (book.resolveCFI!(mixedCfi).anchor as (document: Document) => Range)(
        mixedDocument,
      )
      const mixedPassage = passageFromRange(mixedRoundTrip, 0, ['Foundations'], () => mixedCfi)
      expect(mixedPassage.text).toContain('A slope compares')
      expect(mixedPassage.text).toContain('m equals delta y over delta x')
    } finally {
      book.destroy?.()
    }
  })

  it('builds serializable exact-CFI chunks from the real tiny-book section', async () => {
    const bytes = await readFile('tests/fixtures/epub/tiny-book.epub')
    const book = await makeBook(new File([bytes], 'tiny-book.epub', { type: 'application/epub+zip' }))
    try {
      const section = book.sections[0]!
      const document = await section.createDocument!()
      // @ts-expect-error foliate-js does not publish declaration files
      const CFI = await import('foliate-js/epubcfi.js')
      const chunks = buildSectionChunks(document, 0, 'Foundations', (range) =>
        CFI.joinIndir(section.cfi!, CFI.fromRange(range)),
      )
      const expected = chunks.find((chunk) => chunk.text.includes('deterministic selection anchor'))
      expect(expected).toBeDefined()
      const fresh = await section.createDocument!()
      const start = (book.resolveCFI!(expected!.range.startCfi).anchor as (document: Document) => Range)(fresh)
      const end = (book.resolveCFI!(expected!.range.endCfi).anchor as (document: Document) => Range)(fresh)
      const resolved = fresh.createRange()
      resolved.setStart(start.startContainer, start.startOffset)
      resolved.setEnd(end.endContainer, end.endOffset)
      const passage = passageFromRange(resolved, 0, ['Foundations'], (range) => CFI.joinIndir(section.cfi!, CFI.fromRange(range)))
      expect(passage.text).toContain('This sentence is the deterministic selection anchor.')
      expect(fingerprintText(passage.text)).toBe(expected!.range.textFingerprint)
      expect(() => structuredClone(chunks)).not.toThrow()
    } finally { book.destroy?.() }
  })

  it('keeps every Section 11 anchor stable and bounds the large Section 23 workload', async () => {
    const bytes = await readFile('public/books/calculus-made-easy.epub')
    const book = await makeBook(
      new File([bytes], 'calculus-made-easy.epub', { type: 'application/epub+zip' }),
    )
    try {
      // @ts-expect-error foliate-js does not publish declaration files
      const CFI = await import('foliate-js/epubcfi.js')
      for (const [sectionIndex, deadline] of [[10, 5_000], [22, 15_000]] as const) {
        const section = book.sections[sectionIndex]!
        const started = performance.now()
        const document = await section.createDocument!()
        const chunks = buildSectionChunks(document, sectionIndex, `Section ${sectionIndex + 1}`, (range) =>
          CFI.joinIndir(section.cfi!, CFI.fromRange(range)),
        )
        const fresh = await section.createDocument!()
        for (const chunk of chunks) {
          const start = (book.resolveCFI!(chunk.range.startCfi).anchor as (document: Document) => Range)(fresh)
          const end = (book.resolveCFI!(chunk.range.endCfi).anchor as (document: Document) => Range)(fresh)
          const range = fresh.createRange()
          range.setStart(start.startContainer, start.startOffset)
          range.setEnd(end.endContainer, end.endOffset)
          const resolved = passageFromAnchoredRange(range, sectionIndex, [], () => chunk.range.startCfi)
          expect(resolved.range.textFingerprint).toBe(chunk.range.textFingerprint)
          expect(resolved.text).toContain(chunk.text)
          expect(chunk.text.length).toBeLessThanOrEqual(1_200)
        }
        expect(performance.now() - started).toBeLessThan(deadline)
      }
    } finally {
      book.destroy?.()
    }
  }, 30_000)


  it('round-trips the bundled Chapter XIX figure and mathematics without semantic loss', async () => {
    const bytes = await readFile('public/books/calculus-made-easy.epub')
    const book = await makeBook(
      new File([bytes], 'calculus-made-easy.epub', { type: 'application/epub+zip' }),
    )
    try {
      const sectionIndex = book.sections.findIndex(
        (section) => section.id === 'OEBPS/7731425094544341602_33283-h-26.htm.xhtml',
      )
      expect(sectionIndex).toBeGreaterThanOrEqual(0)
      const section = book.sections[sectionIndex]!
      const document = await section.createDocument!()
      const figure = document.querySelector('#i_203a')!
      const finalParagraph = [...document.querySelectorAll('p')].find((node) =>
        node.textContent?.includes('Then call'),
      )!
      const source = document.createRange()
      source.setStartBefore(figure)
      source.setEndAfter(finalParagraph)

      // @ts-expect-error foliate-js does not publish declaration files
      const CFI = await import('foliate-js/epubcfi.js')
      const cfi = CFI.joinIndir(section.cfi!, CFI.fromRange(toSemanticTextRange(source)))
      const fresh = await section.createDocument!()
      const roundTrip = (book.resolveCFI!(cfi).anchor as (document: Document) => Range)(fresh)
      const passage = passageFromRange(roundTrip, sectionIndex, ['Chapter XIX'], () => cfi)

      for (const expected of [
        'A curve from A to B with shaded area',
        'Fig. 52',
        '\\({A B}\\)',
        '\\({x}\\)',
        '\\({P}\\)',
        '\\({Q}\\)',
        '\\({O M=x_{1}}\\)',
        '\\({P M=y_{1}}\\)',
      ]) {
        expect(passage.text).toContain(expected)
      }
      expect(passage.segments?.some((segment) => segment.kind === 'figure')).toBe(true)
      expect(passage.segments?.some((segment) => segment.kind === 'math')).toBe(true)
    } finally {
      book.destroy?.()
    }
  })
})
