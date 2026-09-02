/**
 * The security boundary for agent-authored markup.
 *
 * The remastering surface hands an agent the section's real HTML and takes
 * edited HTML back. That is the point of the feature — it is a coding harness
 * inside an EPUB reader, and the agent's judgement is the product. But markup
 * that arrives from a model, exactly like markup that arrives from a book, is
 * untrusted input. This module is where that is enforced, and it is the one
 * part of the surface that does not defer to the agent.
 *
 * The rules are allow-list, not deny-list, because a deny-list is a list of
 * the attacks someone has already thought of:
 *
 * - only known-safe elements survive; everything else is unwrapped or dropped;
 * - only known-safe attributes survive, and never an `on*` handler;
 * - URLs may be `blob:`, `data:image/*`, or a fragment — never `javascript:`,
 *   and never an off-origin fetch that would leak what a person is reading;
 * - `<style>` is allowed, because typography is part of the repair, but its
 *   text is filtered for `@import`, `expression(`, and `url()` targets;
 * - the result is returned as a `DocumentFragment` built by parsing in an
 *   inert document, so nothing runs during sanitization either.
 *
 * Every removal is counted and reported back to the agent, so a proposal that
 * was partly refused is visible rather than silently thinned.
 */

const ALLOWED_ELEMENTS = new Set([
  // Structure
  'div', 'p', 'span', 'section', 'article', 'aside', 'header', 'footer', 'main',
  'figure', 'figcaption', 'blockquote', 'hr', 'br', 'pre', 'details', 'summary',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists and tables
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Inline
  'a', 'em', 'strong', 'i', 'b', 'u', 's', 'small', 'sub', 'sup', 'code', 'kbd',
  'abbr', 'cite', 'q', 'time', 'mark', 'ruby', 'rt', 'rp', 'wbr',
  // Media the book itself supplies
  'img', 'picture', 'source', 'svg', 'g', 'path', 'circle', 'rect', 'line',
  'polyline', 'polygon', 'text', 'tspan', 'defs', 'marker', 'title', 'desc',
  // Mathematics
  'math', 'semantics', 'annotation', 'annotation-xml', 'mrow', 'mi', 'mn', 'mo',
  'mtext', 'mspace', 'ms', 'mfrac', 'msqrt', 'mroot', 'mstyle', 'merror',
  'mpadded', 'mphantom', 'mfenced', 'menclose', 'msub', 'msup', 'msubsup',
  'munder', 'mover', 'munderover', 'mmultiscripts', 'mtable', 'mtr', 'mtd',
  'maction', 'mprescripts', 'none',
  // Presentation
  'style',
])

/** Attributes allowed on any element. */
const GLOBAL_ATTRIBUTES = new Set([
  'class', 'id', 'title', 'lang', 'dir', 'role', 'style',
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
  'aria-level', 'aria-live', 'aria-roledescription',
])

/** Attributes allowed only on particular elements. */
const ELEMENT_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'rel', 'target'],
  img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes', 'loading', 'decoding'],
  source: ['src', 'srcset', 'sizes', 'type', 'media'],
  svg: ['viewBox', 'width', 'height', 'xmlns', 'fill', 'stroke', 'preserveAspectRatio'],
  path: ['d', 'fill', 'stroke', 'stroke-width', 'fill-rule', 'transform'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
  rect: ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width'],
  polygon: ['points', 'fill', 'stroke', 'stroke-width'],
  g: ['transform', 'fill', 'stroke'],
  text: ['x', 'y', 'fill', 'font-size', 'text-anchor'],
  tspan: ['x', 'y', 'dx', 'dy'],
  math: ['display', 'alttext', 'xmlns', 'mathvariant'],
  annotation: ['encoding'],
  'annotation-xml': ['encoding'],
  mi: ['mathvariant'],
  mo: ['fence', 'stretchy', 'separator', 'lspace', 'rspace', 'largeop', 'movablelimits'],
  mstyle: ['mathvariant', 'displaystyle', 'scriptlevel'],
  mspace: ['width', 'height', 'depth'],
  mtable: ['columnalign', 'rowalign', 'columnspacing', 'rowspacing', 'displaystyle'],
  mtd: ['columnalign', 'rowalign', 'columnspan', 'rowspan'],
  mtr: ['columnalign', 'rowalign'],
  mover: ['accent'],
  munder: ['accentunder'],
  munderover: ['accent', 'accentunder'],
  mfrac: ['linethickness', 'numalign', 'denomalign'],
  mroot: ['displaystyle'],
  menclose: ['notation'],
  td: ['colspan', 'rowspan', 'headers', 'scope', 'align'],
  th: ['colspan', 'rowspan', 'headers', 'scope', 'abbr', 'align'],
  col: ['span'],
  colgroup: ['span'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  time: ['datetime'],
  q: ['cite'],
  blockquote: ['cite'],
  details: ['open'],
}

/**
 * Data attributes an agent may set. Book content already uses `data-tex`, and
 * Bookhand's own provenance attributes have to survive a round trip.
 */
const ALLOWED_DATA_PREFIXES = ['data-bookhand-', 'data-tex', 'data-epub']

export interface SanitizeResult {
  /** The sanitized markup, safe to insert. */
  readonly html: string
  /** Elements removed entirely, by tag name, with counts. */
  readonly removedElements: Readonly<Record<string, number>>
  /** Attributes stripped, by name, with counts. */
  readonly removedAttributes: Readonly<Record<string, number>>
  /** True when anything at all was refused. */
  readonly modified: boolean
}

const MAX_HTML = 1_500_000

export class SanitizeError extends Error {}

/**
 * Sanitize agent-authored markup for one section body.
 *
 * Parsing happens in an inert document created by `DOMParser`, which does not
 * execute scripts, fetch resources, or run timers. Only after the tree has
 * been walked and pruned is the result serialized back to a string.
 */
export function sanitizeSectionHtml(html: string): SanitizeResult {
  if (html.length > MAX_HTML) throw new SanitizeError('Proposed markup is too large')
  const parsed = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html',
  )
  const body = parsed.body
  if (!body) throw new SanitizeError('Proposed markup could not be parsed')

  const removedElements: Record<string, number> = {}
  const removedAttributes: Record<string, number> = {}
  const count = (into: Record<string, number>, key: string) => {
    into[key] = (into[key] ?? 0) + 1
  }

  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) walk(child)

    const tag = node.tagName.toLowerCase()
    if (!ALLOWED_ELEMENTS.has(tag)) {
      count(removedElements, tag)
      // Structural containers give up their children rather than take the
      // text with them; anything that can carry behaviour is removed whole.
      if (DISCARD_WHOLE.has(tag)) node.remove()
      else node.replaceWith(...Array.from(node.childNodes))
      return
    }

    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase()
      if (!isAllowedAttribute(tag, name)) {
        count(removedAttributes, name)
        node.removeAttribute(attribute.name)
        continue
      }
      if (name === 'srcset') {
        // A srcset is a list, and one bad candidate must not be waved through
        // because its neighbours are fine — nor take the good ones with it.
        const kept = sanitizeSrcset(attribute.value)
        if (kept === null) {
          count(removedAttributes, 'srcset')
          node.removeAttribute(attribute.name)
        } else {
          if (kept !== attribute.value) count(removedAttributes, 'srcset-candidate')
          node.setAttribute(attribute.name, kept)
        }
        continue
      }
      if (isUrlAttribute(name) && !isAllowedUrl(attribute.value)) {
        count(removedAttributes, name)
        node.removeAttribute(attribute.name)
        continue
      }
      if (name === 'style' && hasUnsafeCss(attribute.value)) {
        count(removedAttributes, 'style')
        node.removeAttribute(attribute.name)
      }
    }

    if (tag === 'style') {
      const filtered = filterCss(node.textContent ?? '')
      if (filtered !== node.textContent) count(removedAttributes, 'style-rule')
      node.textContent = filtered
    }
    if (tag === 'a') {
      // An in-book link may stay; anything else opens somewhere Bookhand
      // cannot vouch for, so it loses its destination but keeps its text.
      const href = node.getAttribute('href')
      if (href && !isAllowedUrl(href)) {
        count(removedAttributes, 'href')
        node.removeAttribute('href')
      }
    }
  }

  for (const child of Array.from(body.children)) walk(child)

  // Comments can carry payloads for other parsers and say nothing to a reader.
  const walker = parsed.createTreeWalker(body, NodeFilter.SHOW_COMMENT)
  const comments: Node[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) comments.push(node)
  for (const comment of comments) comment.parentNode?.removeChild(comment)

  return {
    html: body.innerHTML,
    removedElements,
    removedAttributes,
    modified:
      Object.keys(removedElements).length > 0 || Object.keys(removedAttributes).length > 0,
  }
}

/** Elements whose children are as unwelcome as they are. */
const DISCARD_WHOLE = new Set([
  'script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'select', 'textarea', 'option', 'link', 'meta', 'base', 'template', 'noscript',
  'audio', 'video', 'track', 'canvas', 'dialog', 'slot', 'portal',
])

function isAllowedAttribute(tag: string, name: string): boolean {
  if (name.startsWith('on')) return false
  if (ALLOWED_DATA_PREFIXES.some((prefix) => name.startsWith(prefix))) return true
  if (GLOBAL_ATTRIBUTES.has(name)) return true
  return (ELEMENT_ATTRIBUTES[tag] ?? []).includes(name)
}

function isUrlAttribute(name: string): boolean {
  return name === 'src' || name === 'href' || name === 'poster'
}

/**
 * Split a `srcset`, check every candidate, and keep the ones that are local.
 *
 * Returns the surviving list, or `null` when nothing survives and the whole
 * attribute should go. Validating the raw string as if it were one URL — which
 * is what a naive check does — passes `images/a.png 1x, https://t.example/b 2x`
 * as safe or rejects it whole; neither is right.
 */
export function sanitizeSrcset(value: string): string | null {
  const kept = splitSrcset(value).filter((candidate) => isAllowedUrl(candidateUrl(candidate)))
  return kept.length > 0 ? kept.join(', ') : null
}

/** Candidates are comma-separated, but a URL may itself contain a comma. */
export function splitSrcset(value: string): readonly string[] {
  return value
    .split(/\s*,\s*(?=[^\s,]+(?:\s+[\d.]+[wxh])?\s*(?:,|$))/)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0)
}

export function candidateUrl(candidate: string): string {
  return candidate.split(/\s+/)[0] ?? ''
}

/**
 * Local resources only.
 *
 * A package-relative path is the normal case and the important one: agents are
 * given the book's own raw source, so `src="images/fig4.svg"` is what they
 * write back, and Foliate's loader resolves it exactly as it resolves the
 * publisher's. What is refused is anything that leaves the book: an `http(s)`
 * URL would both leak what a person is reading and break the offline promise,
 * and a `javascript:` URL is not a resource at all.
 */
function isAllowedUrl(value: string): boolean {
  const url = value.trim()
  if (url.length === 0) return false
  if (url.startsWith('#')) return true
  if (url.startsWith('blob:')) return true
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);/i.test(url)) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false
  // Protocol-relative is off-origin by another name.
  return !url.startsWith('//')
}

function hasUnsafeCss(value: string): boolean {
  if (/expression\s*\(|javascript:|@import|behavior\s*:/i.test(value)) return true
  for (const match of value.matchAll(/url\s*\(\s*['"]?([^'")]*)/gi)) {
    if (!isAllowedUrl(match[1] ?? '')) return true
  }
  return false
}

export interface SanitizeCssResult {
  readonly css: string
  readonly modified: boolean
}

/**
 * Stylesheet text an agent wrote.
 *
 * Typography is part of repairing a document, so CSS is a first-class thing an
 * agent may write. What it may not do is reach off-origin: `@import`, remote
 * `url()`, and the legacy IE escape hatches are removed.
 */
export function sanitizeCss(css: string): SanitizeCssResult {
  if (css.length > MAX_HTML) throw new SanitizeError('Proposed stylesheet is too large')
  const filtered = filterCss(css)
  return { css: filtered, modified: filtered !== css }
}

function filterCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]*;?/gi, '')
    .replace(/url\s*\(\s*['"]?([^'")]*)['"]?\s*\)/gi, (whole, url: string) =>
      isAllowedUrl(url) ? whole : 'none',
    )
}
