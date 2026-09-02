/**
 * Translating an agent's package-relative references into what the renderer
 * can actually load.
 *
 * Foliate replaces a section's `src`, `href`, `poster` and `url()` references
 * with `blob:` URLs *before* the `data` event fires (`epub.js:818-876`), so
 * markup inserted at that seam has already missed resource replacement. An
 * agent writing `src="images/fig4.svg"` — which is what the book's own source
 * says, and what it must say to be persistable — would therefore render a
 * broken figure.
 *
 * The fix is a map built by comparing the publisher's raw document with the
 * one the loader just produced. Both have the same shape, because replacement
 * only rewrote attribute values, so pairing them in document order gives an
 * exact raw-to-loaded correspondence for every resource in the section.
 *
 * Keeping the agent's side relative is the whole point: a rewrite that stored
 * `blob:` URLs would be meaningless after a reload and could never be exported
 * as an EPUB.
 */

import { candidateUrl, splitSrcset } from './sanitize.ts'

/** Attributes whose values Foliate rewrites. `srcset` is handled as a list. */
const URL_ATTRIBUTES = ['src', 'href', 'poster'] as const

export type ResourceMap = ReadonlyMap<string, string>

/** Pair a raw section document with the loaded one, in document order. */
export function buildResourceMap(raw: Document, loaded: Document): ResourceMap {
  const map = new Map<string, string>()
  for (const attribute of URL_ATTRIBUTES) {
    const rawNodes = raw.querySelectorAll(`[${attribute}]`)
    const loadedNodes = loaded.querySelectorAll(`[${attribute}]`)
    if (rawNodes.length !== loadedNodes.length) continue
    rawNodes.forEach((node, index) => {
      const from = node.getAttribute(attribute)
      const to = loadedNodes[index]?.getAttribute(attribute)
      if (from && to && from !== to) map.set(from, to)
    })
  }
  // `srcset` is a list, so it pairs candidate by candidate rather than whole.
  const rawSets = raw.querySelectorAll('[srcset]')
  const loadedSets = loaded.querySelectorAll('[srcset]')
  if (rawSets.length === loadedSets.length) {
    rawSets.forEach((node, index) => {
      const from = splitSrcset(node.getAttribute('srcset') ?? '')
      const to = splitSrcset(loadedSets[index]?.getAttribute('srcset') ?? '')
      if (from.length !== to.length) return
      from.forEach((candidate, position) => {
        const fromUrl = candidateUrl(candidate)
        const toUrl = candidateUrl(to[position] ?? '')
        if (fromUrl && toUrl && fromUrl !== toUrl) map.set(fromUrl, toUrl)
      })
    })
  }
  return map
}

/**
 * Rewrite an agent's references the way the loader would have.
 *
 * A reference the map does not know is left alone: it may be an anchor, an
 * inline `data:` image, or a genuine mistake, and none of those is improved by
 * inventing a URL for it.
 */
export function translateResources(document_: Document, map: ResourceMap): void {
  if (map.size === 0) return
  for (const attribute of URL_ATTRIBUTES) {
    for (const node of document_.querySelectorAll(`[${attribute}]`)) {
      const value = node.getAttribute(attribute)
      if (!value) continue
      const translated = map.get(value)
      if (translated) node.setAttribute(attribute, translated)
    }
  }
  for (const node of document_.querySelectorAll('[srcset]')) {
    const value = node.getAttribute('srcset')
    if (!value) continue
    const translated = splitSrcset(value)
      .map((candidate) => {
        const url = candidateUrl(candidate)
        const to = map.get(url)
        return to ? candidate.replace(url, to) : candidate
      })
      .join(', ')
    node.setAttribute('srcset', translated)
  }
  for (const node of document_.querySelectorAll('[style]')) {
    const style = node.getAttribute('style')
    if (style) node.setAttribute('style', translateCss(style, map))
  }
  for (const style of document_.querySelectorAll('style')) {
    if (style.textContent) style.textContent = translateCss(style.textContent, map)
  }
}

export function translateCss(css: string, map: ResourceMap): string {
  if (map.size === 0) return css
  return css.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (whole, quote: string, url: string) => {
    const translated = map.get(url.trim())
    return translated ? `url(${quote}${translated}${quote})` : whole
  })
}
