/**
 * The agent's read/write seam onto a section's real markup.
 *
 * An agent reads the section's actual HTML and CSS, decides what the document
 * should be, and writes it back. Bookhand does not model the repair, restrict
 * it to a vocabulary of verbs, or second-guess the result. What it keeps is
 * the ability to recover: the publisher's markup is archived before the first
 * edit, so undo and reset are always available, and everything an agent sends
 * passes the sanitizer on the way in.
 */

import {
  translateCss,
  translateResources,
  type ResourceMap,
} from './resources.ts'
import { sanitizeCss, sanitizeSectionHtml, type SanitizeResult } from './sanitize.ts'

/** Marks the stylesheet Bookhand injects on an agent's behalf. */
export const REMASTER_STYLE_ID = 'bookhand-remaster-style'

export interface SectionStylesheet {
  /** The packaged path, so the agent can say which sheet it means. */
  readonly name: string
  readonly css: string
}

export interface SectionSource {
  readonly sectionIndex: number
  readonly label?: string
  /**
   * The section body as the publisher packaged it, with `src` and `href` still
   * package-relative. Deliberately not the rendered DOM: that carries `blob:`
   * URLs which mean nothing after a reload and could never be exported.
   */
  readonly html: string
  /** The section's stylesheets, by packaged name. */
  readonly stylesheets: readonly SectionStylesheet[]
  /** Whether this section is currently showing an agent's rewrite. */
  readonly rewritten: boolean
  readonly bytes: number
}

export interface SectionVersion {
  /** The sanitized markup of this version. */
  readonly html: string
  /** Sanitized stylesheet text for this version, if the agent wrote any. */
  readonly css?: string
  /** What the agent said it was doing, in its own words. */
  readonly summary?: string
  readonly at: number
}

/**
 * A section's edit history.
 *
 * The publisher's own markup is version zero and is never overwritten, so
 * Reset is always exact. Each agent edit appends, so Undo steps back one
 * revision at a time rather than throwing the whole session away.
 */
export interface SectionRewrite {
  readonly sectionIndex: number
  readonly original: string
  readonly versions: readonly SectionVersion[]
}

export function currentVersion(rewrite: SectionRewrite): SectionVersion | undefined {
  return rewrite.versions.at(-1)
}

export function currentHtml(rewrite: SectionRewrite): string {
  return currentVersion(rewrite)?.html ?? rewrite.original
}

/** Read a packaged section back out as source an agent can work on. */
export function readSection(
  document_: Document,
  sectionIndex: number,
  options: {
    readonly label?: string
    readonly rewritten: boolean
    readonly stylesheets: readonly SectionStylesheet[]
  },
): SectionSource {
  const body = document_.body ?? document_.documentElement
  const html = body?.innerHTML ?? ''
  return {
    sectionIndex,
    ...(options.label === undefined ? {} : { label: options.label }),
    html,
    stylesheets: options.stylesheets,
    rewritten: options.rewritten,
    bytes: html.length,
  }
}

export interface RewriteResult {
  readonly sectionIndex: number
  readonly applied: boolean
  readonly sanitized: SanitizeResult
  /** True when the agent's stylesheet had rules removed. */
  readonly cssModified: boolean
  /** What the section looked like before, so a caller can describe the change. */
  readonly before: { readonly elements: number; readonly bytes: number }
  readonly after: { readonly elements: number; readonly bytes: number }
}

export interface PreparedRewrite {
  readonly version: SectionVersion
  readonly sanitized: SanitizeResult
  readonly cssModified: boolean
}

/** Check an agent's proposal and turn it into the next version of a section. */
export function prepareRewrite(input: {
  readonly html: string
  readonly css?: string
  readonly summary?: string
}): PreparedRewrite {
  const sanitized = sanitizeSectionHtml(input.html)
  const style = input.css === undefined ? undefined : sanitizeCss(input.css)
  return {
    version: {
      html: sanitized.html,
      ...(style ? { css: style.css } : {}),
      ...(input.summary === undefined ? {} : { summary: input.summary }),
      at: Date.now(),
    },
    sanitized,
    cssModified: style?.modified ?? false,
  }
}

/**
 * Put a version's markup into a section document.
 *
 * The nodes are parsed in an inert HTML document and then *imported* rather
 * than assigned through `innerHTML`. An EPUB section is XHTML, where
 * `innerHTML` runs the XML parser and rejects anything not well formed — so a
 * rewrite containing an ordinary `<img>` or `<br>` would throw, and restoring
 * a figure, the commonest repair of all, is exactly the case that would have
 * broken.
 */
export function applyVersion(
  document_: Document,
  version: SectionVersion,
  resources: ResourceMap = new Map(),
): void {
  const body = document_.body ?? document_.documentElement
  if (!body) return
  replaceBody(document_, body, version.html)
  translateResources(document_, resources)
  applyStyle(document_, version.css ? translateCss(version.css, resources) : undefined)
}

function applyStyle(document_: Document, css?: string): void {
  const head = document_.head ?? document_.documentElement
  document_.getElementById(REMASTER_STYLE_ID)?.remove()
  if (!css || !head) return
  const style = document_.createElementNS('http://www.w3.org/1999/xhtml', 'style')
  style.setAttribute('id', REMASTER_STYLE_ID)
  style.appendChild(document_.createTextNode(css))
  head.appendChild(style)
}

/**
 * Serializing an XHTML document writes an explicit `xmlns` on any element in a
 * foreign namespace — every `<math>`, every `<svg>`. Re-parsing that as HTML
 * turns it back into a literal attribute, which an XML document then refuses
 * on import. The namespace is carried structurally by the HTML parser for
 * exactly these elements, so the attribute is redundant as well as fatal.
 */
function stripNamespaceAttributes(root: ParentNode): void {
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name === 'xmlns' || name.startsWith('xmlns:')) element.removeAttribute(attribute.name)
    }
  }
}

export function replaceBody(document_: Document, body: Element, html: string): void {
  const parsed = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html',
  )
  if (parsed.body) stripNamespaceAttributes(parsed.body)
  const imported = Array.from(parsed.body?.childNodes ?? []).map((node) =>
    document_.importNode(node, true),
  )
  body.replaceChildren(...imported)
}
