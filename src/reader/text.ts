import type { BookRange, Passage } from '../domain/reader.ts'

const SKIPPED_ELEMENTS =
  'script, style, noscript, template, [hidden], [inert], [aria-hidden="true"]'
const BLOCK_ELEMENTS =
  'address, article, aside, blockquote, br, dd, div, dl, dt, figcaption, figure, footer, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, td, th, tr, ul'

export function normalizeBookText(value: string): string {
  return value.replace(/[\t\n\f\r ]+/g, ' ').trim()
}

export function fingerprintText(value: string): string {
  const text = normalizeBookText(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * Serialize book content to the text a passage should carry.
 *
 * A calculus book is mostly not prose. Its arguments live in display equations,
 * in inline math, and in figures — and every one of those reaches the DOM as
 * something `textContent` either mangles or drops entirely. `dy/dx` rendered as
 * MathML flattens to `dydx`; rendered as an image it disappears. A passage that
 * loses the mathematics is not a shorter passage, it is a false one, and
 * everything downstream — the search index, a study block's quotation, an
 * agent's reading of the chapter — inherits the falsehood.
 *
 * So each alternative is consulted in order of how much the author put into it:
 * an explicit `data-tex`, then the format's own alternative text, then a
 * caption or description, then the flattened content. Whichever wins REPLACES
 * its element, so a figure's meaning is stated once rather than twice.
 *
 * Anything hidden from a reader is removed before any of this, because text a
 * person cannot see is not text the book is saying. `VAL-MATH-PASSAGE`.
 */
function serializeContent(root: ParentNode): string {
  for (const element of root.querySelectorAll(SKIPPED_ELEMENTS)) element.remove()

  // An explicit `data-tex` is the author stating the content outright. It wins
  // over every inferred alternative, on any element.
  for (const element of root.querySelectorAll('[data-tex]')) {
    replaceWithText(element, element.getAttribute('data-tex'))
  }

  for (const math of root.querySelectorAll('math')) {
    const annotation = math.querySelector('annotation[encoding="application/x-tex"]')
    replaceWithText(
      math,
      math.getAttribute('alttext') ?? annotation?.textContent ?? math.textContent,
    )
  }

  for (const image of root.querySelectorAll('img')) {
    // `alt=""` is the author saying this image carries no meaning. Respect it:
    // inventing text for a decorative rule is its own kind of falsehood.
    //
    // `alt="decorative"` is the same statement in Project Gutenberg's house
    // style, used for chapter ornaments. The word itself says nothing about the
    // book, so passing it through would put a noise word into every passage
    // that happens to span an ornament.
    replaceWithText(image, decorativeAlt(image.getAttribute('alt')))
  }

  for (const svg of root.querySelectorAll('svg')) {
    const title = svg.querySelector('title')?.textContent
    const description = svg.querySelector('desc')?.textContent
    const labelled = [title, description].filter(Boolean).join('. ')
    replaceWithText(svg, labelled || svg.getAttribute('aria-label'))
  }

  // Block boundaries are word boundaries; without this a heading runs into the
  // paragraph beneath it.
  for (const element of root.querySelectorAll(BLOCK_ELEMENTS)) {
    element.insertAdjacentText?.('beforebegin', ' ')
    element.insertAdjacentText?.('afterend', ' ')
  }

  return normalizeBookText(root.textContent ?? '')
}

const DECORATIVE_ALT = new Set(['', 'decorative'])

function decorativeAlt(alt: string | null): string | null {
  return DECORATIVE_ALT.has(normalizeBookText(alt ?? '').toLowerCase()) ? null : alt
}

/**
 * Replace an element with its alternative text. The element's own subtree goes
 * with it, so nothing is stated twice.
 *
 * An element with no alternative still leaves a space behind. `<img alt="">` is
 * a replaced element sitting between two words, and deleting it outright would
 * weld them together — the decorative image would end up changing the prose.
 */
function replaceWithText(element: Element, value: string | null | undefined): void {
  const text = normalizeBookText(value ?? '')
  const document_ = element.ownerDocument
  if (!document_) {
    element.remove()
    return
  }
  element.replaceWith(document_.createTextNode(` ${text} `))
}

export function extractDocumentText(document: Document): string {
  const clone = document.body?.cloneNode(true) as HTMLElement | undefined
  if (!clone) return ''
  return serializeContent(clone)
}

/**
 * Returns an equivalent range whose endpoints are text nodes.
 *
 * A range whose boundaries sit on elements — what a triple-click or
 * select-all produces — yields a CFI that collapses to the element and
 * therefore resolves to no rectangles, so a highlight over it would silently
 * draw nothing. Anchoring to the text itself keeps the drawn highlight and the
 * stored range describing the same characters.
 */
export function toTextRange(range: Range): Range {
  const startIsText = range.startContainer.nodeType === Node.TEXT_NODE
  const endIsText = range.endContainer.nodeType === Node.TEXT_NODE
  if (startIsText && endIsText) return range

  const root = range.commonAncestorContainer
  const document_ = root.ownerDocument
  if (!document_ || root.nodeType === Node.TEXT_NODE) return range

  const walker = document_.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (range.intersectsNode(node) && (node.nodeValue ?? '').trim()) nodes.push(node as Text)
  }
  const first = nodes[0]
  const last = nodes.at(-1)
  if (!first || !last) return range

  const anchored = document_.createRange()
  anchored.setStart(first, startIsText ? range.startOffset : 0)
  anchored.setEnd(last, endIsText ? range.endOffset : (last.nodeValue?.length ?? 0))
  return anchored
}

export function passageFromRange(
  source: Range,
  sectionIndex: number,
  chapterBreadcrumb: readonly string[],
  getCfi: (range: Range) => string,
): Passage {
  const range = toTextRange(source)
  // Serialize the selection as the reader made it, not as it was re-anchored.
  //
  // `toTextRange` narrows the endpoints onto text nodes so the CFIs resolve to
  // rectangles the highlight can be drawn over — necessary for anchoring, and
  // wrong for content. Selecting a figure whose only text is its caption would
  // narrow away the image, and the passage would report the caption while
  // silently dropping what the figure shows. So the CFIs come from the anchored
  // range and the text comes from the original.
  //
  // `range.toString()` is not an option either: it concatenates raw text nodes,
  // losing image alts, `data-tex`, and MathML alternatives while including text
  // hidden from the reader.
  const text = serializeContent(source.cloneContents())
  const start = range.cloneRange()
  start.collapse(true)
  const end = range.cloneRange()
  end.collapse(false)
  const bookRange: BookRange = {
    startCfi: getCfi(start),
    endCfi: getCfi(end),
    cfi: getCfi(range),
    sectionIndex,
    textFingerprint: fingerprintText(text),
  }
  return { text, range: bookRange, chapterBreadcrumb }
}
