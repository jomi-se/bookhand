/**
 * Section-document restoration.
 *
 * The transform runs over a parsed section `Document` and repairs it in place.
 * It is deliberately the *same* function for both of Foliate's paths into a
 * section — the loader's `data` event, which produces what the reader sees,
 * and `createDocument()`, which produces what Bookhand extracts and indexes —
 * because a reader whose visible text and indexed text disagree is worse than
 * one that repairs neither.
 *
 * ## The one-for-one invariant
 *
 * Every repair replaces exactly one element with exactly one element in the
 * same position. Nothing is added, removed, or reordered, and no text node is
 * touched. EPUB CFI addresses element children positionally, so this is what
 * keeps every stored highlight, study-item source range, and search hit
 * resolving to the same place in a restored document as in the original.
 * `assertOneForOne` states it as an assertion rather than a hope.
 */

import { compileTex, isDisplayTex, TexUnsupportedError } from './tex.ts'

/** Provenance attributes, so a single element can be reverted in place. */
export const REMASTER_ATTRIBUTE = 'data-bookhand-remaster'
export const ORIGINAL_SRC_ATTRIBUTE = 'data-bookhand-original-src'
export const ORIGINAL_ALT_ATTRIBUTE = 'data-bookhand-original-alt'
export const ORIGINAL_STYLE_ATTRIBUTE = 'data-bookhand-original-style'
export const TEX_ATTRIBUTE = 'data-bookhand-tex'
export const TARGET_ATTRIBUTE = 'data-bookhand-target'

export type RemasterKind = 'math'

/** One element the transform could not restore, and why. */
export interface RemasterResidue {
  /** Stable within a section: the id an agent names when proposing a repair. */
  readonly targetId: string
  readonly kind: RemasterKind
  /** The TeX the book supplied, verbatim. */
  readonly source: string
  /** The book's own alternative text, which is all a reader has without this. */
  readonly alt?: string
  /** The construct the compiler declined, e.g. `\\underline`. */
  readonly reason: string
}

export interface RemasterReport {
  /** How many elements of each pathology the section contained. */
  readonly found: number
  /** How many were restored deterministically. */
  readonly restored: number
  /** The ones that were left as they were, named so they can be repaired. */
  readonly residues: readonly RemasterResidue[]
}

export const EMPTY_REPORT: RemasterReport = { found: 0, restored: 0, residues: [] }

export function mergeReports(reports: readonly RemasterReport[]): RemasterReport {
  return {
    found: reports.reduce((total, report) => total + report.found, 0),
    restored: reports.reduce((total, report) => total + report.restored, 0),
    residues: reports.flatMap((report) => report.residues),
  }
}

/**
 * The pathology this slice repairs: an `<img>` whose real content is the LaTeX
 * in its own `data-tex` attribute.
 */
const MATH_IMAGE_SELECTOR = 'img[data-tex]'

export interface RemasterOptions {
  /** Prefix for `targetId`s, so ids are unique across a book, not a section. */
  readonly idPrefix?: string
}

export function remasterDocument(
  document_: Document,
  options: RemasterOptions = {},
): RemasterReport {
  const root = document_.body ?? document_.documentElement
  if (!root) return EMPTY_REPORT
  const images = Array.from(root.querySelectorAll(MATH_IMAGE_SELECTOR))
  const residues: RemasterResidue[] = []
  let restored = 0

  images.forEach((image, ordinal) => {
    const targetId = `${options.idPrefix ?? 'math'}-${ordinal}`
    const source = image.getAttribute('data-tex') ?? ''
    const alt = image.getAttribute('alt') ?? undefined
    try {
      const compiled = compileTex(source, {
        document: document_,
        display: isDisplayTex(source) || isDisplayContext(image),
      })
      applyProvenance(compiled.element, {
        targetId,
        source,
        alt,
        style: image.getAttribute('style') ?? undefined,
        src: image.getAttribute('src') ?? undefined,
      })
      replaceOneForOne(image, compiled.element)
      restored += 1
    } catch (error) {
      // A construct the compiler declines keeps its original image. The book
      // stays exactly as readable as it was, and the residue is named.
      image.setAttribute(TARGET_ATTRIBUTE, targetId)
      residues.push({
        targetId,
        kind: 'math',
        source,
        ...(alt === undefined ? {} : { alt }),
        reason: error instanceof TexUnsupportedError ? error.construct : 'unreadable expression',
      })
    }
  })

  return { found: images.length, restored, residues }
}

/**
 * A lone image inside its own paragraph or `div` is a display equation even
 * when the TeX does not say so — Gutenberg's converter routinely drops the
 * `\\[ \\]` and centres the image with a class instead.
 */
function isDisplayContext(image: Element): boolean {
  const parent = image.parentElement
  if (!parent) return false
  if (!/^(p|div|figure)$/i.test(parent.tagName)) return false
  if (parent.querySelectorAll('img').length !== 1) return false
  return (parent.textContent ?? '').trim().length === 0
}

function applyProvenance(
  element: Element,
  original: {
    readonly targetId: string
    readonly source: string
    readonly alt?: string
    readonly style?: string
    readonly src?: string
  },
): void {
  element.setAttribute(REMASTER_ATTRIBUTE, 'math')
  element.setAttribute(TARGET_ATTRIBUTE, original.targetId)
  element.setAttribute(TEX_ATTRIBUTE, original.source)
  if (original.src !== undefined) element.setAttribute(ORIGINAL_SRC_ATTRIBUTE, original.src)
  if (original.alt !== undefined) element.setAttribute(ORIGINAL_ALT_ATTRIBUTE, original.alt)
  if (original.style !== undefined) element.setAttribute(ORIGINAL_STYLE_ATTRIBUTE, original.style)
}

/**
 * The invariant, enforced. `replaceWith` on a single node cannot change the
 * sibling count, but stating it here means a future repair that tries to
 * expand one element into several fails a test instead of silently
 * invalidating every CFI in the book.
 */
function replaceOneForOne(original: Element, replacement: Element): void {
  const parent = original.parentNode
  if (!parent) return
  const before = parent.childNodes.length
  parent.replaceChild(replacement, original)
  assertOneForOne(parent, before)
}

function assertOneForOne(parent: ParentNode & Node, before: number): void {
  if (parent.childNodes.length !== before) {
    throw new Error('Remaster broke the one-for-one invariant; CFIs would be invalidated')
  }
}

/**
 * Put a restored document back the way the publisher shipped it.
 *
 * This is what the Original/Restored control drives. It works on the live
 * rendered document, with no reload, because every restored element carries
 * its own original inside it.
 */
export function revertDocument(document_: Document): number {
  const root = document_.body ?? document_.documentElement
  if (!root) return 0
  const restored = Array.from(root.querySelectorAll(`[${REMASTER_ATTRIBUTE}]`))
  for (const element of restored) {
    const image = document_.createElement('img')
    const src = element.getAttribute(ORIGINAL_SRC_ATTRIBUTE)
    const alt = element.getAttribute(ORIGINAL_ALT_ATTRIBUTE)
    const style = element.getAttribute(ORIGINAL_STYLE_ATTRIBUTE)
    const tex = element.getAttribute(TEX_ATTRIBUTE)
    if (src !== null) image.setAttribute('src', src)
    image.setAttribute('alt', alt ?? '')
    if (style !== null) image.setAttribute('style', style)
    if (tex !== null) image.setAttribute('data-tex', tex)
    const targetId = element.getAttribute(TARGET_ATTRIBUTE)
    if (targetId !== null) image.setAttribute(TARGET_ATTRIBUTE, targetId)
    replaceOneForOne(element, image)
  }
  return restored.length
}

/** Whether a document currently shows restored content. */
export function isRemastered(document_: Document): boolean {
  const root = document_.body ?? document_.documentElement
  return Boolean(root?.querySelector(`[${REMASTER_ATTRIBUTE}]`))
}

/**
 * Apply one agent-proposed repair to a named element.
 *
 * The agent supplies **TeX**, never markup: the same validated compiler that
 * handles the book's own notation handles the proposal, so a hostile or
 * mistaken proposal is a parse failure rather than an injection. Returns the
 * restored element's compact text, or throws `TexUnsupportedError`.
 */
export function restoreTarget(
  document_: Document,
  targetId: string,
  tex: string,
): { readonly text: string } | undefined {
  const root = document_.body ?? document_.documentElement
  const target = root?.querySelector(`[${TARGET_ATTRIBUTE}="${cssEscape(targetId)}"]`)
  if (!target) return undefined
  const compiled = compileTex(tex, {
    document: document_,
    display: isDisplayTex(tex) || isDisplayContext(target),
  })
  applyProvenance(compiled.element, {
    targetId,
    source: tex,
    ...(target.getAttribute('alt') === null ? {} : { alt: target.getAttribute('alt')! }),
    ...(target.getAttribute('style') === null ? {} : { style: target.getAttribute('style')! }),
    ...(target.getAttribute('src') === null ? {} : { src: target.getAttribute('src')! }),
  })
  replaceOneForOne(target, compiled.element)
  return { text: compiled.text }
}

/** A `targetId` reaches this from a tool call, so it is escaped, not trusted. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
