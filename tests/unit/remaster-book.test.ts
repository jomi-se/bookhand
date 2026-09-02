import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeBook } from '../../src/reader/foliate-module.ts'
import { extractDocumentText } from '../../src/reader/index.ts'
import { remasterDocument, revertDocument } from '../../src/remaster/document.ts'

/**
 * The restoration measured against the real bundled book, not a fixture that
 * agrees with it. Section 10 is *Calculus Made Easy* chapter III, which the
 * publisher shipped with 161 of its variables and equations as images.
 */
const SECTION = 10

/**
 * Measured against the real chapter, not assumed. Two occurrences of `dy/dx`
 * exist before restoration, both inside the human-written descriptions of
 * Fig. 4 and Fig. 5. Restoration adds eleven more — the chapter's actual
 * derivatives, which were images.
 */
const DERIVATIVES_BEFORE = 2
const DERIVATIVES_ADDED = 11

describe('restoring a real Project Gutenberg section', () => {
  let sectionHtml: string

  beforeAll(async () => {
    const bytes = await readFile('public/books/calculus-made-easy.epub')
    const file = new File([bytes], 'calculus-made-easy.epub', { type: 'application/epub+zip' })
    const book = await makeBook(file)
    const document_ = await book.sections[SECTION]!.createDocument!()
    sectionHtml = document_.documentElement.outerHTML
  }, 60_000)

  const load = () =>
    new DOMParser().parseFromString(sectionHtml, 'text/html')

  it('finds the pathology the chapter actually has', () => {
    const document_ = load()
    expect(document_.querySelectorAll('img[data-tex]').length).toBe(161)
    expect(document_.querySelectorAll('math').length).toBe(0)
  })

  it('restores every one of them deterministically, with no model call', () => {
    const document_ = load()
    const report = remasterDocument(document_, { idPrefix: `s${SECTION}` })

    expect(report.found).toBe(161)
    expect(report.restored).toBe(161)
    expect(report.residues).toEqual([])
    expect(document_.querySelectorAll('math').length).toBe(161)
    expect(document_.querySelectorAll('img[data-tex]').length).toBe(0)
  })

  it('turns TeX control syntax in the indexed text into readable mathematics', () => {
    // The measured baseline matters here. Bookhand already extracted
    // `data-tex` into passage text, so the index was never empty — it was full
    // of TeX source. `src/reader/text.ts` emitted the literal `\({d x}\)`.
    const document_ = load()
    const before = extractDocumentText(document_)
    expect(before).toContain('\\(')
    expect(before).toContain('\\)')

    remasterDocument(document_, { idPrefix: `s${SECTION}` })
    const after = extractDocumentText(document_)

    expect(after).not.toContain('\\(')
    expect(after).not.toContain('\\)')
    expect(after).not.toContain('\\dfrac')
  })

  it('makes the chapter’s derivatives findable the way a reader writes them', () => {
    // Stated carefully, because the naive version of this claim is false.
    // `dy/dx` is already in the indexed text once before restoration — not
    // from any equation, but from the human-written description of Fig. 4.
    // Every one of the chapter's actual derivatives was spelled
    // `\({\dfrac{d y}{d x}}\)`, which no reader types.
    const count = (text: string) => text.split('dy/dx').length - 1
    const document_ = load()
    const before = count(extractDocumentText(document_))
    expect(before).toBe(DERIVATIVES_BEFORE)

    remasterDocument(document_, { idPrefix: `s${SECTION}` })
    const after = count(extractDocumentText(document_))

    expect(after - before).toBe(DERIVATIVES_ADDED)
  })

  it('gives the chapter’s mathematics text a reader can select', () => {
    const document_ = load()
    const imageText = Array.from(document_.querySelectorAll('img[data-tex]'))
      .map((image) => image.textContent ?? '')
      .join('')
    expect(imageText).toBe('')

    remasterDocument(document_, { idPrefix: `s${SECTION}` })
    const mathText = Array.from(document_.querySelectorAll('math'))
      .map((math) => math.textContent ?? '')
      .join('')
    expect(mathText.length).toBeGreaterThan(200)
  })

  it('keeps every restored element addressable by its own original', () => {
    const document_ = load()
    remasterDocument(document_, { idPrefix: `s${SECTION}` })
    const restored = Array.from(document_.querySelectorAll('[data-bookhand-remaster]'))
    expect(restored.length).toBe(161)
    for (const element of restored) {
      expect(element.getAttribute('data-bookhand-original-src')).toBeTruthy()
      expect(element.getAttribute('data-bookhand-tex')).toBeTruthy()
    }
  })

  it('reverts the whole chapter to the publisher’s markup', () => {
    const document_ = load()
    const before = document_.body.innerHTML

    remasterDocument(document_, { idPrefix: `s${SECTION}` })
    expect(revertDocument(document_)).toBe(161)

    expect(document_.querySelectorAll('img[data-tex]').length).toBe(161)
    expect(document_.querySelectorAll('math').length).toBe(0)
    // Attribute order and the added target id aside, the text is identical.
    expect(extractDocumentText(document_)).toBe(
      extractDocumentText(new DOMParser().parseFromString(`<body>${before}</body>`, 'text/html')),
    )
  })

  it('does not disturb the section’s element structure', () => {
    const document_ = load()
    const shape = (doc: Document) =>
      Array.from(doc.querySelectorAll('body *')).map((element) =>
        element.tagName.toLowerCase() === 'img' && element.hasAttribute('data-tex')
          ? 'math'
          : element.tagName.toLowerCase(),
      )
    const before = shape(document_)
    remasterDocument(document_, { idPrefix: `s${SECTION}` })
    const after = Array.from(document_.querySelectorAll('body *'))
      .filter((element) => !element.closest('math') || element.tagName.toLowerCase() === 'math')
      .map((element) => element.tagName.toLowerCase())

    expect(after).toEqual(before)
  })
})
