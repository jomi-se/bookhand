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

import { sanitizeSectionHtml, type SanitizeResult } from './sanitize.ts'

export interface SectionSource {
  readonly sectionIndex: number
  readonly label?: string
  /** The section body exactly as it is currently rendered. */
  readonly html: string
  /** Stylesheet text the section carries, concatenated. */
  readonly css: string
  /** Whether this section is currently showing an agent's rewrite. */
  readonly rewritten: boolean
  readonly bytes: number
}

export interface SectionRewrite {
  readonly sectionIndex: number
  /** The sanitized markup now being shown. */
  readonly html: string
  /** The publisher's own markup, kept for undo. */
  readonly original: string
  readonly summary?: string
  readonly at: number
}

/** Read a rendered section back out as source an agent can work on. */
export function readSection(
  document_: Document,
  sectionIndex: number,
  options: { readonly label?: string; readonly rewritten: boolean },
): SectionSource {
  const body = document_.body ?? document_.documentElement
  const html = body?.innerHTML ?? ''
  const css = Array.from(document_.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n')
  return {
    sectionIndex,
    ...(options.label === undefined ? {} : { label: options.label }),
    html,
    css,
    rewritten: options.rewritten,
    bytes: html.length,
  }
}

export interface RewriteResult {
  readonly sectionIndex: number
  readonly applied: boolean
  readonly sanitized: SanitizeResult
  /** What the section looked like before, so a caller can describe the change. */
  readonly before: { readonly elements: number; readonly bytes: number }
  readonly after: { readonly elements: number; readonly bytes: number }
}

/**
 * Replace a rendered section's body with an agent's markup.
 *
 * The sanitized fragment is built in an inert document and inserted whole, so
 * a rewrite is one DOM operation rather than a sequence a reader could catch
 * halfway through.
 */
export function writeSection(
  document_: Document,
  sectionIndex: number,
  html: string,
): RewriteResult {
  const body = document_.body ?? document_.documentElement
  if (!body) throw new Error('The section has no body to rewrite')
  const before = { elements: body.querySelectorAll('*').length, bytes: body.innerHTML.length }
  const sanitized = sanitizeSectionHtml(html)
  body.innerHTML = sanitized.html
  return {
    sectionIndex,
    applied: true,
    sanitized,
    before,
    after: { elements: body.querySelectorAll('*').length, bytes: body.innerHTML.length },
  }
}

export function restoreOriginal(document_: Document, original: string): void {
  const body = document_.body ?? document_.documentElement
  if (body) body.innerHTML = original
}
