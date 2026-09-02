import type { SectionChunk } from '../domain/search.ts'
import {
  extractRangeText,
  passageFromAnchoredRange,
  passageFromRange,
  toSemanticTextRange,
  toTextRange,
} from './text.ts'

const BLOCK_SELECTOR =
  'h1,h2,h3,h4,h5,h6,p,blockquote,pre,figure,table,ul,ol,dl,address'
const SEMANTIC_BOUNDARY_SELECTOR = 'figure,[data-tex],math,svg'
const MIN_CHARACTERS = 400
const MAX_CHARACTERS = 1_200
// Leave room for a semantic edge's stable Foliate envelope. The hard public
// bound remains MAX_CHARACTERS; this target avoids re-splitting most groups.
const TARGET_CHARACTERS = 600

/**
 * Build coherent chunks from authored block boundaries.
 *
 * Foliate's XML-backed documents do not necessarily return a comma-separated
 * selector in document order: Chapter X, for example, can yield every
 * paragraph followed by every figure. Enumerating all elements first and then
 * matching preserves the order the author actually wrote.
 */
export function buildSectionChunks(
  document: Document,
  sectionIndex: number,
  sectionTitle: string,
  getCfi: (range: Range) => string,
): readonly SectionChunk[] {
  const body = document.body ?? document.documentElement
  const candidates = Array.from(body.querySelectorAll('*'))
    .filter((element) => element.matches(BLOCK_SELECTOR))
    .filter((element) => !element.parentElement?.closest(BLOCK_SELECTOR))
  if (candidates.length === 0) candidates.push(body)

  const blocks = candidates.flatMap((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const text = extractRangeText(range)
    return text ? [{ element, length: text.length }] : []
  })
  const groups: Element[][] = []
  let active: Element[] = []
  let length = 0
  for (const block of blocks) {
    if (
      active.length > 0 &&
      !active.at(-1)?.matches(SEMANTIC_BOUNDARY_SELECTOR) &&
      length >= MIN_CHARACTERS &&
      length + block.length > TARGET_CHARACTERS
    ) {
      groups.push(active)
      active = []
      length = 0
    }
    active.push(block.element)
    length += block.length + 1
  }
  if (active.length > 0) groups.push(active)

  const passages = groups.flatMap((elements) => {
    const first = elements[0]
    const last = elements.at(-1)
    if (!first || !last) return []
    const range = document.createRange()
    range.setStartBefore(first)
    range.setEndAfter(last)
    const passage = stablePassage(range, sectionIndex, sectionTitle, getCfi)
    if (!passage.text) return []
    if (passage.text.length <= MAX_CHARACTERS) return [passage]
    return splitLongRange(range, sectionIndex, sectionTitle, getCfi, passage)
  })
  return passages.map((passage, sectionChunkIndex) => ({
    sectionIndex,
    sectionTitle,
    sectionChunkIndex,
    text: passage.text,
    range: passage.range,
  }))
}

function splitLongRange(
  range: Range,
  sectionIndex: number,
  sectionTitle: string,
  getCfi: (range: Range) => string,
  initial?: ReturnType<typeof passageFromRange>,
): ReturnType<typeof passageFromRange>[] {
  const document = range.commonAncestorContainer.ownerDocument
  if (!document) return [stablePassage(range, sectionIndex, sectionTitle, getCfi)]
  const passage = initial ?? stablePassage(range, sectionIndex, sectionTitle, getCfi)
  if (passage.text.length <= MAX_CHARACTERS) return passage.text ? [passage] : []

  const nodes = splittableTextNodes(range)
  const middle = nodes[Math.floor(nodes.length / 2)]
  if (!middle) return boundedExcerpts(passage)
  const length = middle.nodeValue?.length ?? 0
  const offset =
    nodes.length > 1
      ? length
      : Math.max(1, wordBoundary(middle.nodeValue ?? '', Math.floor(length / 2)))
  const left = document.createRange()
  left.setStart(range.startContainer, range.startOffset)
  left.setEnd(middle, offset)
  const right = document.createRange()
  right.setStart(middle, offset)
  right.setEnd(range.endContainer, range.endOffset)
  if (left.collapsed || right.collapsed) return boundedExcerpts(passage)
  return [
    ...splitLongRange(left, sectionIndex, sectionTitle, getCfi),
    ...splitLongRange(right, sectionIndex, sectionTitle, getCfi),
  ]
}

function wordBoundary(text: string, preferred: number): number {
  for (let distance = 0; distance < text.length; distance += 1) {
    const before = preferred - distance
    if (before > 0 && /\s/u.test(text[before - 1] ?? '')) return before
    const after = preferred + distance
    if (after > 0 && after < text.length && /\s/u.test(text[after - 1] ?? '')) return after
  }
  return preferred
}

function splittableTextNodes(range: Range): Text[] {
  const document = range.commonAncestorContainer.ownerDocument
  if (!document) return []
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    if (
      range.intersectsNode(text) &&
      (text.nodeValue ?? '').trim() &&
      !text.parentElement?.closest(SEMANTIC_BOUNDARY_SELECTOR)
    ) nodes.push(text)
  }
  return nodes
}

function stablePassage(
  range: Range,
  sectionIndex: number,
  sectionTitle: string,
  getCfi: (range: Range) => string,
) {
  const anchored = hasSemanticEdge(range) ? toSemanticTextRange(range) : toTextRange(range)
  // Foliate resolves an end CFI at offset zero to the containing text anchor,
  // which includes that anchor's text when start/end CFIs are recombined. Make
  // the indexed citation describe the same stable envelope up front.
  if (
    anchored.endContainer.nodeType === Node.TEXT_NODE &&
    anchored.endOffset === 0
  ) {
    anchored.setEnd(anchored.endContainer, anchored.endContainer.nodeValue?.length ?? 0)
  }
  return passageFromAnchoredRange(
    anchored,
    sectionIndex,
    [sectionTitle],
    getCfi,
  )
}

function hasSemanticEdge(range: Range): boolean {
  const startsWith =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer.childNodes[range.startOffset]
      : range.startContainer
  const endsWith =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer.childNodes[range.endOffset - 1]
      : range.endContainer
  return edgeIsSemantic(startsWith) || edgeIsSemantic(endsWith)
}

function edgeIsSemantic(node: Node | undefined): boolean {
  if (!(node instanceof Element)) return Boolean(node?.parentElement?.closest(SEMANTIC_BOUNDARY_SELECTOR))
  if (node.matches(SEMANTIC_BOUNDARY_SELECTOR)) return true
  if (!node.querySelector(SEMANTIC_BOUNDARY_SELECTOR)) return false
  const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (
      (text.nodeValue ?? '').trim() &&
      !(text as Text).parentElement?.closest(SEMANTIC_BOUNDARY_SELECTOR)
    ) {
      return false
    }
  }
  return true
}

/**
 * A semantic object can be addressable only as one Foliate range even when its
 * authored alternative is longer than a search result. Keep that stable range
 * and fingerprint, but index bounded exact substrings of its canonical text.
 */
function boundedExcerpts(passage: ReturnType<typeof passageFromRange>) {
  if (!passage.text) return []
  if (passage.text.length <= MAX_CHARACTERS) return [passage]
  const excerpts = []
  let offset = 0
  while (offset < passage.text.length) {
    let end = Math.min(offset + MAX_CHARACTERS, passage.text.length)
    if (end < passage.text.length) {
      const boundary = passage.text.lastIndexOf(' ', end)
      if (boundary > offset + Math.floor(MAX_CHARACTERS * 0.6)) end = boundary
    }
    const text = passage.text.slice(offset, end).trim()
    if (text) excerpts.push({ ...passage, text, segments: [{ kind: 'text' as const, text }] })
    offset = end
    while (passage.text[offset] === ' ') offset += 1
  }
  return excerpts
}
