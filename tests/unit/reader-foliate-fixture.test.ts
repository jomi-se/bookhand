import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { extractDocumentText } from '../../src/reader/index.ts'
import { makeBook } from '../../src/reader/foliate-module.ts'

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
    } finally {
      book.destroy?.()
    }
  })
})
