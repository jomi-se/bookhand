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

export function passageFromRange(
  range: Range,
  sectionIndex: number,
  chapterBreadcrumb: readonly string[],
  getCfi: (range: Range) => string,
): Passage {
  const text = normalizeBookText(range.toString())
  const start = range.cloneRange()
  start.collapse(true)
  const end = range.cloneRange()
  end.collapse(false)
  const bookRange: BookRange = {
    startCfi: getCfi(start),
    endCfi: getCfi(end),
    sectionIndex,
    textFingerprint: fingerprintText(text),
  }
  return { text, range: bookRange, chapterBreadcrumb }
}
