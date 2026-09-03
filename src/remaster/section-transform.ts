/**
 * Serving a rewritten section to Foliate before it builds one.
 *
 * `Loader.createURL` dispatches a `data` event on `book.transformTarget` and
 * awaits `detail.data` before creating the blob URL the iframe loads
 * (`node_modules/foliate-js/epub.js:719-726`). Replacing the markup there means
 * Foliate parses, measures, and paginates the agent's document as if the
 * publisher had shipped it.
 *
 * The alternative — swapping the body of an already-rendered section — was
 * tried and does not work. The paginator measures a section once and keeps
 * ranges into the nodes it found; replacing them leaves it describing a
 * document that no longer exists, and the reader is shown an empty column
 * while the reported location drifts into another chapter. Nothing recovers it
 * from the outside, because the damage is to state the paginator owns.
 */

import type { FoliateBook } from '../reader/foliate-types.ts'
import { buildResourceMap, type ResourceMap } from './resources.ts'
import { applyVersion, type SectionVersion } from './rewrite.ts'

/** MIME types whose payload is a section document. */
const SECTION_TYPES = new Set(['application/xhtml+xml', 'text/html'])

interface DataEventDetail {
  data: unknown
  type: unknown
  readonly name: string
}

/**
 * Intercept section markup on its way into the renderer.
 *
 * `resolve` decides what a section should be right now — the agent's current
 * version, or nothing at all when the reader has asked for the original.
 */
export function installSectionTransform(
  book: FoliateBook,
  resolve: (sectionIndex: number) => SectionVersion | undefined,
  onResources?: (sectionIndex: number, resources: ResourceMap) => void,
): () => void {
  const target = book.transformTarget
  if (!target) return () => {}

  const indexByHref = new Map<string, number>()
  book.sections.forEach((section, index) => {
    if (section.id) indexByHref.set(section.id, index)
  })

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<DataEventDetail>).detail
    const sectionIndex = indexByHref.get(detail.name)
    if (sectionIndex === undefined) return
    const original = detail.data
    detail.data = (async () => {
      const type = await detail.type
      const source = await original
      if (typeof source !== 'string' || typeof type !== 'string' || !SECTION_TYPES.has(type)) {
        return source
      }
      try {
        const parsed = new DOMParser().parseFromString(source, type as DOMParserSupportedType)
        if (parsed.querySelector('parsererror')) return source
        // The payload arriving here has already had its resources replaced
        // with blob URLs. The agent's markup is package-relative, as the
        // book's own source is, so pair the two documents to learn what each
        // relative reference became.
        const resources = await resourceMap(book, detail.name, parsed)
        onResources?.(sectionIndex, resources)
        const version = resolve(sectionIndex)
        if (!version) return source
        applyVersion(parsed, version, resources)
        return new XMLSerializer().serializeToString(parsed)
      } catch {
        // A section that will not rewrite must still be readable. The
        // publisher's own markup is always a correct answer here.
        return source
      }
    })()
  }

  target.addEventListener('data', listener)
  return () => target.removeEventListener('data', listener)
}

/**
 * The correspondence between the publisher's own references and the blob URLs
 * the loader just made of them. Empty when the raw source cannot be re-read,
 * which leaves an agent's references untranslated rather than wrong.
 */
async function resourceMap(book: FoliateBook, href: string, loaded: Document) {
  try {
    const rawSource = await book.loadText?.(href)
    if (typeof rawSource !== 'string') return new Map<string, string>()
    const raw = new DOMParser().parseFromString(rawSource, 'application/xhtml+xml')
    if (raw.querySelector('parsererror')) return new Map<string, string>()
    return buildResourceMap(raw, loaded)
  } catch {
    return new Map<string, string>()
  }
}
