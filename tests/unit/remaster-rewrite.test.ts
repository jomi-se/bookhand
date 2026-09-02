import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FoliateReaderAdapter } from '../../src/reader/index.ts'
import type {
  RemasterStore,
  SectionRewriteVersion,
  StoredSectionRewrite,
} from '../../src/domain/remaster.ts'
import type {
  FoliateBook,
  FoliateRenderer,
  FoliateResolvedTarget,
  FoliateView,
} from '../../src/reader/foliate-types.ts'

/**
 * The publisher's own section, with package-relative references — an equation
 * image carrying its LaTeX, and an ordinary figure that is not mathematics.
 */
const SECTION = `<h1 class="ctitle">CHAPTER III</h1><p class="para">The ratio <img alt="d y by d x" data-tex="\\({\\dfrac{dy}{dx}}\\)" src="images/eq-1.svg" /> is what we hunt.</p><figure><img src="images/fig4.svg" alt="Fig. 4" /><figcaption>Fig. 4</figcaption></figure>`

/** What Foliate's loader does before the transform sees a section. */
function asLoaded(source: string): string {
  return source.replace(/src="(images\/[^"]+)"/g, (_, path: string) => `src="blob:loaded/${path}"`)
}

function makeDocument(markup: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${markup}</body></html>`,
    'text/html',
  )
}

/**
 * A stand-in that loads sections the way Foliate does: through the loader's
 * `data` event, so the section transform is exercised rather than bypassed.
 * A fake that skipped it would prove the opposite of what these tests claim.
 */
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
      doc = await this.loadSection()
      this.dispatchEvent(new CustomEvent('load', { detail: { doc, index: 0 } }))
    })
    renderer.prev = vi.fn(async () => {})
    renderer.next = vi.fn(async () => {})
    this.renderer = renderer
  }

  /**
   * What `Loader.createURL` does: dispatch `data`, then await `detail.data`.
   * The payload has already been through resource replacement, exactly as it
   * has in the real loader — which is why the transform needs a raw-to-loaded
   * map to make sense of an agent's relative paths.
   */
  async loadSection(): Promise<Document> {
    const source = asLoaded(rawSectionXhtml())
    const detail = { data: source as unknown, type: 'application/xhtml+xml' as unknown }
    Object.defineProperty(detail, 'name', { value: 'ch3.xhtml' })
    this.book?.transformTarget?.dispatchEvent(new CustomEvent('data', { detail }))
    const served = await detail.data
    return new DOMParser().parseFromString(String(served), 'application/xhtml+xml')
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

function rawSectionXhtml(): string {
  return `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><style>.para { text-indent: 1em; }</style></head><body>${SECTION}</body></html>`
}

function makeBook(): FoliateBook {
  return {
    metadata: { title: 'Calculus Made Easy', author: 'Silvanus P. Thompson' },
    toc: [{ id: 'c3', label: 'Chapter III', href: 'ch3.xhtml' }],
    loadText: async () => rawSectionXhtml(),
    sections: [
      {
        id: 'ch3.xhtml',
        createDocument: async () =>
          new DOMParser().parseFromString(rawSectionXhtml(), 'application/xhtml+xml'),
        unload: vi.fn(),
        resolveHref: (href: string) => href,
      },
    ],
    transformTarget: new EventTarget(),
    resolveCFI: () => ({ index: 0 }),
    destroy: vi.fn(),
  }
}

/**
 * A rewrite store held in memory, standing in for the library.
 *
 * It records the calls as well as the contents, because what matters is not
 * only that a rewrite survives but that the reader saved it before it changed
 * what the person is looking at.
 */
function makeStore(seed: readonly StoredSectionRewrite[] = []) {
  const sections = new Map<number, SectionRewriteVersion[]>(
    seed.map((entry) => [entry.sectionIndex, [...entry.versions]]),
  )
  const calls: string[] = []
  let failNext: string | undefined
  const refuse = (name: string) => {
    if (failNext !== name) return
    failNext = undefined
    throw new Error('The library refused that write')
  }
  return {
    calls,
    sections,
    failOn(name: 'append' | 'undo' | 'reset') {
      failNext = name
    },
    store: {
      async load(): Promise<readonly StoredSectionRewrite[]> {
        calls.push('load')
        return [...sections.entries()].map(([sectionIndex, versions]) => ({
          sectionIndex,
          versions: [...versions],
        }))
      },
      async append(_bookId: string, sectionIndex: number, version: SectionRewriteVersion) {
        calls.push('append')
        refuse('append')
        const versions = sections.get(sectionIndex) ?? []
        versions.push(version)
        sections.set(sectionIndex, versions)
        return versions.length
      },
      async undo(_bookId: string, sectionIndex: number) {
        calls.push('undo')
        refuse('undo')
        const versions = sections.get(sectionIndex) ?? []
        versions.pop()
        if (versions.length === 0) sections.delete(sectionIndex)
        return versions.length
      },
      async reset(_bookId: string, sectionIndex: number) {
        calls.push('reset')
        refuse('reset')
        sections.delete(sectionIndex)
      },
    },
  }
}

async function openAdapter(options: { rewrites?: RemasterStore } = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const adapter = new FoliateReaderAdapter(host, {}, {
    loadFoliate: async () => ({ makeBook: async () => makeBook() }),
  })
  await adapter.open(new Blob(['x'], { type: 'application/epub+zip' }), {
    bookId: 'book-1',
    ...(options.rewrites ? { rewrites: options.rewrites } : {}),
  })
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
    expect(source.html).toContain('class="ctitle"')
    expect(source.html).toContain('CHAPTER III')
    expect(source.rewritten).toBe(false)
    expect(source.bytes).toBeGreaterThan(0)
  })

  it('reports the document’s shape without classifying any of it', async () => {
    const { adapter } = await openAdapter()
    const diagnosis = await adapter.diagnoseSection(0)

    // Two images, one carrying LaTeX. Bookhand reports both and calls neither
    // an equation: which is which is the agent's call to make.
    expect(diagnosis.counts.images).toBe(2)
    expect(diagnosis.counts.imagesWithTex).toBe(1)
    expect(diagnosis.images[0]?.tex).toBe('\\({\\dfrac{dy}{dx}}\\)')
    expect(diagnosis.blocks.map((block) => block.tag)).toContain('h1')
  })

  it('reads and diagnoses the agent’s current version, not the publisher’s', async () => {
    // A second pass has to see what the first one wrote. Handing back the
    // publisher's document would make an agent edit a chapter that is no
    // longer on screen.
    const { adapter } = await openAdapter()
    await adapter.rewriteSection(0, '<h2>Rewritten</h2><p>Only prose now.</p>', {
      css: '.para { color: rebeccapurple; }',
    })

    const source = await adapter.getSectionSource(0)
    expect(source.html).toContain('Rewritten')
    expect(source.html).toMatch(/<h2[ >]/)
    expect(source.html).not.toContain('data-tex')
    expect(source.rewritten).toBe(true)
    expect(source.stylesheets.map((sheet) => sheet.name)).toContain('bookhand-remaster')
    expect(
      source.stylesheets.find((sheet) => sheet.name === 'bookhand-remaster')?.css,
    ).toContain('rebeccapurple')

    const diagnosis = await adapter.diagnoseSection(0)
    expect(diagnosis.counts.images).toBe(0)
    expect(diagnosis.blocks.map((block) => block.tag)).toContain('h2')
  })

  it('hands back package-relative source, never the rendered blob URLs', async () => {
    const { adapter, rendered } = await openAdapter()
    // The rendered document does carry blob URLs — that is what makes reading
    // from it the wrong thing to do.
    expect(rendered().querySelector('img')?.getAttribute('src')).toContain('blob:')

    const source = await adapter.getSectionSource(0)
    expect(source.html).toContain('images/eq-1.svg')
    expect(source.html).not.toContain('blob:')
  })

  it('applies whatever markup the agent decides on', async () => {
    const { adapter, rendered } = await openAdapter()
    const result = await adapter.rewriteSection(
      0,
      '<h2>Chapter III</h2><p>The ratio <math><mfrac><mi>d</mi><mi>x</mi></mfrac></math> is what we hunt.</p>',
      { summary: 'Promoted the chapter title and set the derivative as MathML' },
    )

    expect(result.applied).toBe(true)
    expect(rendered().querySelector('h2')?.textContent).toBe('Chapter III')
    expect(rendered().querySelector('math')).not.toBeNull()
    expect(rendered().querySelector('img')).toBeNull()
  })

  it('refuses what could run or reach the network, and says what it removed', async () => {
    const { adapter, rendered } = await openAdapter()
    const result = await adapter.rewriteSection(
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
      await adapter.rewriteSection(0, '<h2>Rewritten</h2>')

      await adapter.showRewritten(false)
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
      expect(adapter.isShowingRewritten()).toBe(false)

      await adapter.showRewritten(true)
      expect(rendered().querySelector('h2')?.textContent).toBe('Rewritten')
    })

    it('steps back one revision at a time', async () => {
      const { adapter, rendered } = await openAdapter()
      await adapter.rewriteSection(0, '<h2>First</h2>')
      await adapter.rewriteSection(0, '<h2>Second</h2>')

      expect(await adapter.undoSection(0)).toEqual({ versions: 1 })
      expect(rendered().querySelector('h2')?.textContent).toBe('First')

      expect(await adapter.undoSection(0)).toEqual({ versions: 0 })
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
      expect(adapter.hasRewrite(0)).toBe(false)
    })

    it('resets to the book as published, however many revisions there were', async () => {
      const { adapter, rendered } = await openAdapter()
      await adapter.rewriteSection(0, '<h2>One</h2>')
      await adapter.rewriteSection(0, '<h2>Two</h2>')
      await adapter.rewriteSection(0, '<h2>Three</h2>')

      expect(await adapter.resetSection(0)).toBe(true)
      expect(rendered().querySelector('h1.ctitle')).not.toBeNull()
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
      expect(adapter.hasRewrite(0)).toBe(false)
    })

    it('has nothing to undo or reset in an untouched section', async () => {
      const { adapter } = await openAdapter()
      expect(await adapter.undoSection(0)).toBeUndefined()
      expect(await adapter.resetSection(0)).toBe(false)
    })
  })

  it('offers the deterministic compile as a shortcut the agent chooses', async () => {
    const { adapter, rendered } = await openAdapter()
    const report = await adapter.compileSectionMath(0)

    expect(report).toMatchObject({ found: 1, restored: 1 })
    expect(rendered().querySelector('math')).not.toBeNull()
    // And it is still just a rewrite: the same undo puts the images back.
    await adapter.undoSection(0)
    expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
  })

  it('compiles from the section’s source, so the saved version stays portable', async () => {
    // Compiling from the rendered DOM would bake `blob:` URLs — dead after a
    // reload, impossible to export — into the stored version, and would take
    // every ordinary figure in the chapter down with the equations.
    const { adapter, rendered } = await openAdapter()
    await adapter.compileSectionMath(0)

    const source = await adapter.getSectionSource(0)
    expect(source.html).not.toContain('blob:')
    expect(source.html).toContain('images/fig4.svg')
    expect(source.html).toContain('<math')

    // And the figure still resolves once the loader has been through it.
    expect(rendered().querySelector('figure img')?.getAttribute('src')).toContain('blob:')
  })

  it('lets extraction read the rewritten document, so the index is the same book', async () => {
    const { adapter } = await openAdapter()
    await adapter.rewriteSection(0, '<h2>Chapter III</h2><p>differential coefficient</p>')

    const snapshot = await adapter.getSectionSnapshot(0)
    expect(snapshot.text).toContain('differential coefficient')
    expect(snapshot.text).not.toContain('is what we hunt')
  })
})

describe('rewrites that outlive the page', () => {
  it('shows a saved rewrite from the very first render', async () => {
    // Hydrating after the first render would show the publisher's markup and
    // then replace it, which reads as the app changing its mind.
    const { store } = makeStore([
      { sectionIndex: 0, versions: [{ html: '<h2>Saved earlier</h2>', at: 1 }] },
    ])
    const { adapter, rendered } = await openAdapter({ rewrites: store })

    expect(rendered().querySelector('h2')?.textContent).toBe('Saved earlier')
    expect(rendered().querySelector('img[data-tex]')).toBeNull()
    expect(adapter.hasRewrite(0)).toBe(true)
  })

  it('restores the whole history, so Undo still walks back', async () => {
    const { store } = makeStore([
      {
        sectionIndex: 0,
        versions: [
          { html: '<h2>First</h2>', at: 1 },
          { html: '<h2>Second</h2>', at: 2 },
        ],
      },
    ])
    const { adapter, rendered } = await openAdapter({ rewrites: store })

    expect(rendered().querySelector('h2')?.textContent).toBe('Second')
    expect(await adapter.undoSection(0)).toEqual({ versions: 1 })
    expect(rendered().querySelector('h2')?.textContent).toBe('First')
  })

  it('restores the agent’s stylesheet and summary with the markup', async () => {
    const { store } = makeStore([
      {
        sectionIndex: 0,
        versions: [
          {
            html: '<h2>Saved</h2>',
            css: '.saved { color: rebeccapurple; }',
            summary: 'Promoted the chapter title',
            at: 1,
          },
        ],
      },
    ])
    const { adapter, rendered } = await openAdapter({ rewrites: store })

    expect(rendered().getElementById('bookhand-remaster-style')?.textContent).toContain(
      'rebeccapurple',
    )
    expect(adapter.describeRewrite(0)?.summary).toBe('Promoted the chapter title')
  })

  it('saves a rewrite, and saves it before showing it', async () => {
    const harness = makeStore()
    const { adapter } = await openAdapter({ rewrites: harness.store })

    await adapter.rewriteSection(0, '<h2>Written now</h2>', { summary: 'Rewrote it' })

    expect(harness.calls).toEqual(['load', 'append'])
    expect(harness.sections.get(0)).toEqual([
      { html: '<h2>Written now</h2>', summary: 'Rewrote it', at: expect.any(Number) },
    ])
    expect(adapter.hasRewrite(0)).toBe(true)
  })

  it('saves what the deterministic shortcut produced', async () => {
    const harness = makeStore()
    const { adapter } = await openAdapter({ rewrites: harness.store })

    await adapter.compileSectionMath(0)

    const saved = harness.sections.get(0)?.at(-1)
    expect(saved?.html).toContain('<math')
    expect(saved?.html).not.toContain('blob:')
    expect(saved?.summary).toContain('Compiled 1 of 1')
  })

  it('forgets a section in the library when it is reset', async () => {
    const harness = makeStore()
    const { adapter, rendered } = await openAdapter({ rewrites: harness.store })
    await adapter.rewriteSection(0, '<h2>Written</h2>')

    expect(await adapter.resetSection(0)).toBe(true)

    expect(harness.sections.has(0)).toBe(false)
    expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
  })

  it('drops one saved revision on undo, not the section', async () => {
    const harness = makeStore()
    const { adapter } = await openAdapter({ rewrites: harness.store })
    await adapter.rewriteSection(0, '<h2>One</h2>')
    await adapter.rewriteSection(0, '<h2>Two</h2>')

    await adapter.undoSection(0)

    expect(harness.sections.get(0)?.map((entry) => entry.html)).toEqual(['<h2>One</h2>'])
  })

  describe('when the library refuses a write', () => {
    it('does not show a rewrite it could not save', async () => {
      // A rewrite the library rejected would vanish on the next reload, so
      // showing it would be a promise the app cannot keep.
      const harness = makeStore()
      const { adapter, rendered } = await openAdapter({ rewrites: harness.store })
      harness.failOn('append')

      await expect(adapter.rewriteSection(0, '<h2>Doomed</h2>')).rejects.toThrow(/refused/)

      expect(adapter.hasRewrite(0)).toBe(false)
      expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
    })

    it('keeps showing the rewrite when a reset could not be saved', async () => {
      const harness = makeStore()
      const { adapter, rendered } = await openAdapter({ rewrites: harness.store })
      await adapter.rewriteSection(0, '<h2>Written</h2>')
      harness.failOn('reset')

      await expect(adapter.resetSection(0)).rejects.toThrow(/refused/)

      expect(adapter.hasRewrite(0)).toBe(true)
      expect(rendered().querySelector('h2')?.textContent).toBe('Written')
    })
  })

  it('reads on without saved rewrites when the library cannot be read', async () => {
    // A person who came to read should not be stopped by a feature they may
    // never use.
    const failing: RemasterStore = {
      load: async () => {
        throw new Error('storage is unavailable')
      },
      append: async () => 0,
      undo: async () => 0,
      reset: async () => {},
    }
    const { adapter, rendered } = await openAdapter({ rewrites: failing })

    expect(rendered().querySelector('img[data-tex]')).not.toBeNull()
    expect(adapter.hasRewrite(0)).toBe(false)
  })

  it('still works with no library behind it at all', async () => {
    const { adapter } = await openAdapter()
    await adapter.rewriteSection(0, '<h2>Session only</h2>')
    expect(adapter.hasRewrite(0)).toBe(true)
  })
})
