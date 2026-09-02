import type { BookRange, Passage, PassageSegment } from '../domain/reader.ts'

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
interface SerializedContent {
  readonly text: string
  readonly segments: readonly PassageSegment[]
}

function serializeContent(root: ParentNode): SerializedContent {
  for (const element of root.querySelectorAll(SKIPPED_ELEMENTS)) element.remove()

  // An explicit `data-tex` is the author stating the content outright. It wins
  // over every inferred alternative, on any element.
  for (const element of root.querySelectorAll('[data-tex]')) {
    replaceWithSegment(element, 'math', element.getAttribute('data-tex'))
  }

  for (const math of root.querySelectorAll('math')) {
    const annotation = math.querySelector('annotation[encoding="application/x-tex"]')
    replaceWithSegment(
      math,
      'math',
      math.getAttribute('alttext') ??
        annotation?.textContent ??
        math.getAttribute('aria-label') ??
        math.textContent,
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
    replaceWithSegment(image, 'figure', decorativeAlt(image.getAttribute('alt')))
  }

  for (const svg of root.querySelectorAll('svg')) {
    const title = svg.querySelector('title')?.textContent
    const description = svg.querySelector('desc')?.textContent
    const labelled = [title, description].filter(Boolean).join('. ')
    replaceWithSegment(svg, 'figure', labelled || svg.getAttribute('aria-label'))
  }

  // Block boundaries are word boundaries; without this a heading runs into the
  // paragraph beneath it.
  for (const element of root.querySelectorAll(BLOCK_ELEMENTS)) {
    element.insertAdjacentText?.('beforebegin', ' ')
    element.insertAdjacentText?.('afterend', ' ')
  }

  const document_ = root.ownerDocument
  if (!document_) return { text: '', segments: [] }
  const walker = document_.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const segments: PassageSegment[] = []
  let activeKind: PassageSegment['kind'] | undefined
  let activeText = ''
  const flush = () => {
    const text = normalizeBookText(activeText)
    if (text && activeKind) segments.push({ kind: activeKind, text })
    activeText = ''
  }
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = (node as Text).parentElement
    const marker = parent?.closest<HTMLElement>('[data-bookhand-passage-kind]')
    const kind = (marker?.dataset.bookhandPassageKind ?? 'text') as PassageSegment['kind']
    if (activeKind !== kind) {
      flush()
      activeKind = kind
    }
    activeText += node.nodeValue ?? ''
  }
  flush()
  return {
    text: normalizeBookText(segments.map((segment) => segment.text).join(' ')),
    segments,
  }
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
function replaceWithSegment(
  element: Element,
  kind: PassageSegment['kind'],
  value: string | null | undefined,
): void {
  const text = normalizeBookText(value ?? '')
  const document_ = element.ownerDocument
  if (!document_) {
    element.remove()
    return
  }
  const replacement = document_.createElement('span')
  replacement.dataset.bookhandPassageKind = kind
  replacement.textContent = ` ${text} `
  element.replaceWith(replacement)
}

export function extractDocumentText(document: Document): string {
  const clone = document.body?.cloneNode(true) as HTMLElement | undefined
  if (!clone) return ''
  return serializeContent(clone).text
}

/** Canonical text for sizing a transient range without minting or resolving a CFI. */
export function extractRangeText(range: Range): string {
  return serializeContent(range.cloneContents()).text
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

  // Search chunks are normally ranges over adjacent children of one section
  // body. Resolve their edge descendants locally instead of walking and
  // intersect-testing every text node in a long mathematical chapter.
  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.ELEMENT_NODE
  ) {
    const container = range.startContainer
    let first: Text | undefined
    let last: Text | undefined
    for (let index = range.startOffset; index < range.endOffset; index += 1) {
      const child = container.childNodes[index]
      first ??= child ? edgeText(child, 'first') : undefined
      const tail = child ? edgeText(child, 'last') : undefined
      if (tail) last = tail
    }
    if (first && last) {
      const anchored = first.ownerDocument.createRange()
      anchored.setStart(first, 0)
      anchored.setEnd(last, last.nodeValue?.length ?? 0)
      return anchored
    }
  }

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

function edgeText(root: Node, edge: 'first' | 'last'): Text | undefined {
  if (root.nodeType === Node.TEXT_NODE) {
    return (root.nodeValue ?? '').trim() ? (root as Text) : undefined
  }
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  if (!walker) return undefined
  let found: Text | undefined
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node.nodeValue ?? '').trim()) continue
    found = node as Text
    if (edge === 'first') break
  }
  return found
}

const SEMANTIC_ELEMENTS = '[data-tex], math, img, svg'
const SEMANTIC_ENVELOPES = `figure, ${SEMANTIC_ELEMENTS}`

/**
 * Keep replaced semantic elements inside the CFI envelope.
 *
 * Foliate cannot round-trip a CFI whose endpoint is an element-container
 * offset, while anchoring a figure or MathML selection to its descendant text
 * loses the image alternative or aria label. A zero-character envelope from
 * the preceding text end to the following text start gives Foliate stable text
 * endpoints while retaining the semantic element between them.
 */
export function toSemanticTextRange(source: Range): Range {
  const fragment = source.cloneContents()
  if (!fragment.querySelector?.(SEMANTIC_ELEMENTS)) return toTextRange(source)
  // A mixed prose range already has stable text endpoints, and those endpoints
  // naturally keep every semantic element between them. Expanding it would
  // turn a viewport-sized range into a section-sized one on some EPUB CFIs.
  // The special envelope is only needed when the selected meaning is itself a
  // figure/math object (a figure caption counts as part of that object).
  const fragmentDocument = source.commonAncestorContainer.ownerDocument
  if (fragmentDocument) {
    const textWalker = fragmentDocument.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
    for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
      if (!(node.nodeValue ?? '').trim()) continue
      const parent = (node as Text).parentElement
      const semanticAncestor = parent?.closest(SEMANTIC_ELEMENTS)
      const figure = parent ? closestElement(parent, 'figure') : undefined
      if (!semanticAncestor && !figure?.querySelector(SEMANTIC_ELEMENTS)) {
        return preserveSemanticEdges(source, toTextRange(source))
      }
    }
  }

  const document_ = source.commonAncestorContainer.ownerDocument
  const root = document_?.body ?? document_?.documentElement
  if (!document_ || !root) return toTextRange(source)

  const walker = document_.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let previous: Text | undefined
  let first: Text | undefined
  let last: Text | undefined
  let following: Text | undefined
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    if (!(text.nodeValue ?? '').trim()) continue
    const length = text.nodeValue?.length ?? 0
    // Zero-character envelope endpoints belong outside the semantic range.
    // Treating them as intersecting would expand the envelope by one text node
    // every time a stored CFI is resolved and serialized again.
    if (source.startContainer === text && source.startOffset === length) {
      previous = text
      continue
    }
    if (source.endContainer === text && source.endOffset === 0) {
      following = text
      break
    }
    const startPosition = source.comparePoint(text, 0)
    const endPosition = source.comparePoint(text, length)
    if (endPosition < 0) {
      previous = text
    } else if (startPosition > 0) {
      following = text
      break
    } else {
      first ??= text
      last = text
    }
  }
  if ((!first || !last) && (!previous || !following)) return toTextRange(source)

  const anchored = document_.createRange()
  const start = previous ?? first!
  const end = following ?? last!
  anchored.setStart(start, previous ? (previous.nodeValue?.length ?? 0) : 0)
  anchored.setEnd(end, following ? 0 : (end.nodeValue?.length ?? 0))
  return preserveSemanticEdges(source, anchored)
}

/**
 * A mixed selection usually has usable prose endpoints, but not when it starts
 * with a figure followed by its caption (or ends with a replaced object after
 * prose). `toTextRange` would anchor to the caption and silently put the image
 * outside the persisted CFI. Expand only the affected edge to a zero-width
 * text boundary outside the semantic object.
 */
function preserveSemanticEdges(source: Range, anchored: Range): Range {
  const document_ = source.commonAncestorContainer.ownerDocument
  const root = document_?.body ?? document_?.documentElement
  if (!document_ || !root) return anchored
  const semantics = [...root.querySelectorAll(SEMANTIC_ENVELOPES)]
    .filter((element) => source.intersectsNode(element))
    .map((element) => closestElement(element, 'figure') ?? element)
  const first = semantics[0]
  const last = semantics.at(-1)
  if (!first || !last) return anchored

  const needsStart =
    first.contains(anchored.startContainer) ||
    Boolean(
      first.compareDocumentPosition(anchored.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
  const needsEnd =
    last.contains(anchored.endContainer) ||
    Boolean(
      last.compareDocumentPosition(anchored.endContainer) & Node.DOCUMENT_POSITION_PRECEDING,
    )
  if (!needsStart && !needsEnd) return anchored

  let previous: Text | undefined
  let following: Text | undefined
  const before = document_.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  before.currentNode = first
  for (let node = before.previousNode(); node; node = before.previousNode()) {
    const text = node as Text
    if (!first.contains(text) && (text.nodeValue ?? '').trim()) {
      previous = text
      break
    }
  }
  const after = document_.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  after.currentNode = last
  for (let node = after.nextNode(); node; node = after.nextNode()) {
    const text = node as Text
    if (!last.contains(text) && (text.nodeValue ?? '').trim()) {
      following = text
      break
    }
  }

  const result = anchored.cloneRange()
  if (needsStart && previous) result.setStart(previous, previous.nodeValue?.length ?? 0)
  if (needsEnd && following) result.setEnd(following, 0)
  return result
}

function closestElement(element: Element, localName: string): Element | undefined {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.localName.toLowerCase() === localName) return current
  }
  return undefined
}

export function passageFromRange(
  source: Range,
  sectionIndex: number,
  chapterBreadcrumb: readonly string[],
  getCfi: (range: Range) => string,
): Passage {
  const range = toSemanticTextRange(source)
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
  return passageFromPreparedRange(source, range, sectionIndex, chapterBreadcrumb, getCfi)
}

/**
 * Serialize a range that the caller has already made CFI-stable. Search
 * chunking uses this to avoid repeating semantic-edge discovery for every
 * finalized chunk in a large mathematical chapter.
 */
export function passageFromAnchoredRange(
  range: Range,
  sectionIndex: number,
  chapterBreadcrumb: readonly string[],
  getCfi: (range: Range) => string,
): Passage {
  return passageFromPreparedRange(range, range, sectionIndex, chapterBreadcrumb, getCfi)
}

function passageFromPreparedRange(
  source: Range,
  range: Range,
  sectionIndex: number,
  chapterBreadcrumb: readonly string[],
  getCfi: (range: Range) => string,
): Passage {
  const serialized = serializeContent(source.cloneContents())
  const text = serialized.text
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
  return { text, range: bookRange, chapterBreadcrumb, segments: serialized.segments }
}
