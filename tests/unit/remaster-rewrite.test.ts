import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FoliateReaderAdapter } from '../../src/reader/index.ts'
import type {
  FoliateBook,
  FoliateRenderer,
  FoliateResolvedTarget,
  FoliateView,
} from '../../src/reader/foliate-types.ts'

const SECTION = `<h1 class="ctitle">CHAPTER III</h1><p class="para">The ratio <img alt="d y by d x" data-tex="\\({\\dfrac{dy}{dx}}\\)" src="blob:eq-1"> is what we hunt.</p>`

function makeDocument(markup: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${markup}</body></html>`,
    'text/html',
  )
}

class FakeView extends HTMLElement implements FoliateView {
  book!: FoliateBook
  renderer: FoliateRenderer
  history = { pushState: vi.fn() }
  lastLocation?: never

  constructor() {
    super()
    const renderer = document.createElement('div') as unknown as FoliateRenderer
    let doc = makeDocument(SECTION)
    renderer.getContents = () => [{ index: 0, doc }]
    renderer.setStyles = vi.fn()
    renderer.goTo = vi.fn(async (_target: FoliateResolvedTarget) => {
      doc = makeDocument(SECTION)
      this.dispatchEvent(new CustomEvent('load', { detail: { doc, index: 0 } }))
    })
    renderer.prev = vi.fn(async () => {})
    renderer.next = vi.fn(async () => {})
    this.renderer = renderer
  }

  async open(book: FoliateBook) {
    this.book = book
    this.append(this.renderer)
  }

  async init() {
    await this.renderer.goTo({ index: 0 })
  }

  getCFI() {
    return 'epubcfi(/6/2!/4/2)'
  }

  resolveNavigation = vi.fn(() => undefined)
  goTo = vi.fn(async () => {})
  goLeft = vi.fn(async () => {})
  goRight = vi.fn(async () => {})
  addAnnotation = vi.fn()
  deleteAnnotation = vi.fn()
  select = vi.fn(async () => {})
  deselect = vi.fn()
  close = vi.fn()
}

function makeBook(): FoliateBook {
  return {
    metadata: { title: 'Calculus Made Easy', author: 'Silvanus P. Thompson' },
    toc: [{ id: 'c3', label: 'Chapter III', href: 'ch3.xhtml' }],
    sections: [{ id: 'ch3.xhtml', createDocument: async () => makeDocument(SECTION) }],
    transformTarget: new EventTarget(),
    resolveCFI: () => ({ index: 0 }),
    destroy: vi.fn(),
  }
}

async function openAdapter() {
  const host = document.createElement('div')
  document.body.append(host)
  const adapter = new FoliateReaderAdapter(host, {}, {
    loadFoliate: async () => ({ makeBook: async () => makeBook() }),
  })
  await adapter.open(new Blob(['x'], { type: 'application/epub+zip' }))
  /** The document a reader is actually looking at, in this adapter's host. */
  const rendered = () =>
    (host.querySelector('foliate-view') as unknown as FoliateView).renderer.getContents()[0]!.doc
  return { adapter, rendered }
}

beforeAll(() => {
  if (!customElements.get('foliate-view')) customElements.define('foliate-view', FakeView)
})

describe('the agent’s read and write seam', () => {
  it('hands over the section’s real markup, not a summary', async () => {
    const { adapter } = await openAdapter()
    const source = await adapter.getSectionSource(0)

    expect(source.html).toContain('data-tex')
    expect(source.html).toContain('<h1 class="ctitle">CHAPTER III</h1>')
    expect(source.rewritten).toBe(false)
    expect(source.bytes).toBeGreaterThan(0)
  })

  it('reports the document’s shape without classifying any of it', async () => {
    const { adapter } = await openAdapter()
    const diagnosis = await adapter.diagnoseSection(0)

    expect(diagnosis.counts.images).toBe(1)
    expect(diagnosis.counts.imagesWithTex).toBe(1)
    expect(diagnosis.images[0]?.tex).toBe('\\({\\dfrac{dy}{dx}}\\)')
    expect(diagnosis.blocks.map((block) => block.tag)).toContain('h1')
  })

  it('applies whatever markup the agent decides on', async () => {
    const { adapter, rendered } = await openAdapter()
    const result = adapter.rewriteSection(
      0,
      '<h2>Chapter III</h2><p>The ratio <math><mfrac><mi>d</mi><mi>x</mi></mfrac></math> is what we hunt.</p>',
      'Promoted the chapter title and set the derivative as MathML',
    )

    expect(result.applied).toBe(true)
    expect(rendered().querySelector('h2')?.textContent).toBe('Chapter III')
    expect(rendered().querySelector('math')).not.toBeNull()
    expect(rendered().querySelector('img')).toBeNull()
  })

  it('refuses what could run or reach the network, and says what it removed', async () => {
    const { adapter, rendered } = await openAdapter()
    const result = adapter.rewriteSection(
      0,
      '<p onclick="steal()">text</p><script>fetch("//evil")</script>',
    )

    expect(result.sanitized.modified).toBe(true)
    expect(result.sanitized.removedElements.script).toBe(1)
    expect(result.sanitized.removedAttributes.onclick).toBe(1)
    expect(rendered().querySelector('script')).toBeNull()
    expect(rendered().body.textContent).toContain('text')
  })

  describe('recovery', () => {
    it('flips between the publisher’s version and the agent’s', async () => {
      const { adapter, rendered } = await openAdapter()
      adapter.rewriteSection(0, '<h2>Rewritten</h2>')

      adapter.showRewritten(false)
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
      expect(adapter.isShowingRewritten()).toBe(false)

      adapter.showRewritten(true)
      expect(rendered().querySelector('h2')?.textContent).toBe('Rewritten')
    })

    it('steps back one revision at a time', async () => {
      const { adapter, rendered } = await openAdapter()
      adapter.rewriteSection(0, '<h2>First</h2>')
      adapter.rewriteSection(0, '<h2>Second</h2>')

      expect(adapter.undoSection(0)).toEqual({ versions: 1 })
      expect(rendered().querySelector('h2')?.textContent).toBe('First')

      expect(adapter.undoSection(0)).toEqual({ versions: 0 })
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
      expect(adapter.hasRewrite(0)).toBe(false)
    })

    it('resets to the book as published, however many revisions there were', async () => {
      const { adapter, rendered } = await openAdapter()
      adapter.rewriteSection(0, '<h2>One</h2>')
      adapter.rewriteSection(0, '<h2>Two</h2>')
      adapter.rewriteSection(0, '<h2>Three</h2>')

      expect(adapter.resetSection(0)).toBe(true)
      expect(rendered().querySelector('h1.ctitle')).not.toBeNull()
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
      expect(adapter.hasRewrite(0)).toBe(false)
    })

    it('has nothing to undo or reset in an untouched section', async () => {
      const { adapter } = await openAdapter()
      expect(adapter.undoSection(0)).toBeUndefined()
      expect(adapter.resetSection(0)).toBe(false)
    })
  })

  it('offers the deterministic compile as a shortcut the agent chooses', async () => {
    const { adapter, rendered } = await openAdapter()
    const report = adapter.compileSectionMath(0)

    expect(report).toMatchObject({ found: 1, restored: 1 })
    expect(rendered().querySelector('math')).not.toBeNull()
    // And it is still just a rewrite: the same undo puts the images back.
    adapter.undoSection(0)
    expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
  })

  it('lets extraction read the rewritten document, so the index is the same book', async () => {
    const { adapter } = await openAdapter()
    adapter.rewriteSection(0, '<h2>Chapter III</h2><p>differential coefficient</p>')

    const snapshot = await adapter.getSectionSnapshot(0)
    expect(snapshot.text).toContain('differential coefficient')
    expect(snapshot.text).not.toContain('is what we hunt')
  })
})
