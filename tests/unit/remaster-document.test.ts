import { describe, expect, it } from 'vitest'
import {
  isRemastered,
  remasterDocument,
  restoreTarget,
  revertDocument,
} from '../../src/remaster/document.ts'

function sectionDocument(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html',
  )
}

const MATH_IMAGE =
  '<img alt="d y by d x" data-tex="\\({\\dfrac{dy}{dx}}\\)" src="eq-1.svg" style="width: 2.4ex;"/>'

describe('section document restoration', () => {
  it('replaces a math image with namespaced MathML', () => {
    const document_ = sectionDocument(`<p>Consider ${MATH_IMAGE} closely.</p>`)
    const report = remasterDocument(document_)

    expect(report).toMatchObject({ found: 1, restored: 1, residues: [] })
    const math = document_.querySelector('math')
    expect(math?.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML')
    expect(document_.querySelector('img')).toBeNull()
  })

  it('gives the mathematics selectable, reflowable text where an image had none', () => {
    const before = sectionDocument(`<p>Consider ${MATH_IMAGE} closely.</p>`)
    // This is the reader-facing loss the restoration repairs: an image
    // contributes no text, so it cannot be selected, spoken, or reflowed.
    expect(before.querySelector('img')!.textContent).toBe('')

    remasterDocument(before)
    expect(before.querySelector('math')!.textContent).toContain('d')
    expect(before.body.textContent).toContain('Consider')
  })

  it('keeps the surrounding prose and its order untouched', () => {
    const document_ = sectionDocument(`<p>before ${MATH_IMAGE} after</p>`)
    remasterDocument(document_)
    const paragraph = document_.querySelector('p')!
    expect(paragraph.childNodes[0]!.textContent).toBe('before ')
    expect((paragraph.childNodes[1] as Element).tagName.toLowerCase()).toBe('math')
    expect(paragraph.childNodes[2]!.textContent).toBe(' after')
  })

  describe('the one-for-one invariant that keeps CFIs valid', () => {
    it('does not change the child count or the position of any sibling', () => {
      const document_ = sectionDocument(
        `<p><span>a</span>${MATH_IMAGE}<span>b</span>${MATH_IMAGE}<span>c</span></p>`,
      )
      const paragraph = document_.querySelector('p')!
      const before = paragraph.childNodes.length
      const beforeShape = Array.from(paragraph.children).map((child) => child.tagName.toLowerCase())

      remasterDocument(document_)

      expect(paragraph.childNodes.length).toBe(before)
      expect(Array.from(paragraph.children).map((child) => child.tagName.toLowerCase())).toEqual(
        beforeShape.map((tag) => (tag === 'img' ? 'math' : tag)),
      )
    })

    it('leaves every text node in the section exactly as it was', () => {
      const document_ = sectionDocument(`<p>one ${MATH_IMAGE} two</p><p>three</p>`)
      const textNodes = (doc: Document) => {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
        const values: string[] = []
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          values.push(node.textContent ?? '')
        }
        return values
      }
      const before = textNodes(document_)
      remasterDocument(document_)
      const after = textNodes(document_).filter(
        (value) => !document_.querySelector('math')!.textContent?.includes(value) || value.trim() === '',
      )
      expect(before.every((value) => textNodes(document_).includes(value))).toBe(true)
      expect(after.length).toBeGreaterThan(0)
    })
  })

  describe('reversibility', () => {
    it('restores the publisher’s original element exactly', () => {
      const original = `<p>Consider ${MATH_IMAGE} closely.</p>`
      const document_ = sectionDocument(original)
      const reference = sectionDocument(original)

      remasterDocument(document_)
      expect(isRemastered(document_)).toBe(true)
      const reverted = revertDocument(document_)

      expect(reverted).toBe(1)
      expect(isRemastered(document_)).toBe(false)
      const image = document_.querySelector('img')!
      const source = reference.querySelector('img')!
      expect(image.getAttribute('src')).toBe(source.getAttribute('src'))
      expect(image.getAttribute('alt')).toBe(source.getAttribute('alt'))
      expect(image.getAttribute('style')).toBe(source.getAttribute('style'))
      expect(image.getAttribute('data-tex')).toBe(source.getAttribute('data-tex'))
    })

    it('survives repeated round trips without drifting', () => {
      const document_ = sectionDocument(`<p>${MATH_IMAGE}</p>`)
      remasterDocument(document_)
      const restoredOnce = document_.querySelector('math')!.outerHTML
      revertDocument(document_)
      remasterDocument(document_)
      expect(document_.querySelector('math')!.outerHTML).toBe(restoredOnce)
    })

    it('preserves the source TeX so the original notation is never lost', () => {
      const document_ = sectionDocument(`<p>${MATH_IMAGE}</p>`)
      remasterDocument(document_)
      expect(
        document_.querySelector('annotation[encoding="application/x-tex"]')?.textContent,
      ).toBe('\\({\\dfrac{dy}{dx}}\\)')
    })
  })

  describe('what it declines', () => {
    const HOSTILE = '<img alt="x" data-tex="\\({\\underline{x}}\\)" src="eq-2.svg"/>'

    it('leaves an expression it cannot compile exactly as the book shipped it', () => {
      const document_ = sectionDocument(`<p>${HOSTILE}</p>`)
      const report = remasterDocument(document_)

      expect(report).toMatchObject({ found: 1, restored: 0 })
      expect(report.residues[0]).toMatchObject({ kind: 'math', reason: '\\underline' })
      expect(document_.querySelector('img')?.getAttribute('src')).toBe('eq-2.svg')
    })

    it('restores the rest of the section around a declined element', () => {
      const document_ = sectionDocument(`<p>${MATH_IMAGE}${HOSTILE}${MATH_IMAGE}</p>`)
      const report = remasterDocument(document_)
      expect(report).toMatchObject({ found: 3, restored: 2 })
      expect(document_.querySelectorAll('math')).toHaveLength(2)
      expect(document_.querySelectorAll('img')).toHaveLength(1)
    })

    it('names each declined element so an agent can address it', () => {
      const document_ = sectionDocument(`<p>${MATH_IMAGE}${HOSTILE}</p>`)
      const report = remasterDocument(document_, { idPrefix: 'section-4' })
      expect(report.residues[0]!.targetId).toBe('section-4-1')
      expect(document_.querySelector('img')?.getAttribute('data-bookhand-target')).toBe('section-4-1')
    })
  })

  describe('bounded agent repair', () => {
    it('compiles an agent’s proposed TeX through the same validated compiler', () => {
      const document_ = sectionDocument(
        '<p><img alt="x" data-tex="\\({\\underline{x}}\\)" src="eq-2.svg"/></p>',
      )
      remasterDocument(document_, { idPrefix: 's' })

      const result = restoreTarget(document_, 's-0', '\\({x_1}\\)')

      expect(result?.text).toBe('x_1')
      expect(document_.querySelector('msub')).not.toBeNull()
      expect(document_.querySelector('img')).toBeNull()
    })

    it('rejects a proposal it cannot compile, leaving the element alone', () => {
      const document_ = sectionDocument(
        '<p><img alt="x" data-tex="\\({\\underline{x}}\\)" src="eq-2.svg"/></p>',
      )
      remasterDocument(document_, { idPrefix: 's' })

      expect(() => restoreTarget(document_, 's-0', '\\({\\underline{x}}\\)')).toThrowError()
      expect(document_.querySelector('img')?.getAttribute('src')).toBe('eq-2.svg')
    })

    it('reports an unknown target rather than repairing something else', () => {
      const document_ = sectionDocument(`<p>${MATH_IMAGE}</p>`)
      remasterDocument(document_, { idPrefix: 's' })
      expect(restoreTarget(document_, 's-99', '\\({x}\\)')).toBeUndefined()
    })

    it('cannot be steered out of its element by a crafted target id', () => {
      const document_ = sectionDocument(`<p>${MATH_IMAGE}</p>`)
      remasterDocument(document_, { idPrefix: 's' })
      expect(restoreTarget(document_, '"] , p [x="', '\\({x}\\)')).toBeUndefined()
    })
  })

  it('reports an empty document honestly', () => {
    const document_ = sectionDocument('<p>No mathematics here.</p>')
    expect(remasterDocument(document_)).toEqual({ found: 0, restored: 0, residues: [] })
  })
})
