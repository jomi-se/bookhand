import type { BookRange, Passage } from '../domain/reader.ts'

const SKIPPED_ELEMENTS = 'script, style, noscript, template, [hidden], [inert]'
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

export function extractDocumentText(document: Document): string {
  const clone = document.body?.cloneNode(true) as HTMLElement | undefined
  if (!clone) return ''
  for (const element of clone.querySelectorAll(SKIPPED_ELEMENTS)) element.remove()
  for (const element of clone.querySelectorAll(BLOCK_ELEMENTS)) {
    element.insertAdjacentText('beforebegin', ' ')
    element.insertAdjacentText('afterend', ' ')
  }
  for (const image of clone.querySelectorAll('img[alt]')) {
    if (!normalizeBookText(image.getAttribute('alt') ?? '')) continue
    image.insertAdjacentText('afterend', ` ${image.getAttribute('alt')} `)
  }
  return normalizeBookText(clone.textContent ?? '')
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
  const text = normalizeBookText(range.toString())
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
