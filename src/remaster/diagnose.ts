/**
 * What a section document actually contains — facts, not a verdict.
 *
 * This is the half of the capability Bookhand owns. It reports the shape of
 * the markup honestly and completely enough for an agent to judge it: which
 * images the section has, what each one carries, and what the block structure
 * really is under its class names. It classifies nothing. Deciding that an
 * image is an equation rather than an illustration, that a bold paragraph is a
 * heading, or that the publisher's own TeX is wrong, is exactly the judgement
 * the agent is here to make — so this module does not pre-empt it with
 * heuristics that would be wrong on the next book.
 */

import { targetOf, type ElementTarget } from './target.ts'

export interface ImageFinding {
  readonly target: ElementTarget
  /** The LaTeX the publisher left in `data-tex`, if any. */
  readonly tex?: string
  /** The publisher's alternative text: for this book, usually speech. */
  readonly alt?: string
  readonly src?: string
  readonly className?: string
  /** Whether the image is the only thing in its block. */
  readonly alone: boolean
}

export interface BlockFinding {
  readonly target: ElementTarget
  readonly tag: string
  readonly className?: string
  /** The first of the element's text, so the agent can read the section. */
  readonly text: string
  /** How many images this block contains. */
  readonly images: number
}

export interface SectionDiagnosis {
  readonly sectionIndex: number
  readonly counts: {
    readonly blocks: number
    readonly headings: number
    readonly images: number
    /** Images whose LaTeX the publisher preserved in `data-tex`. */
    readonly imagesWithTex: number
  }
  readonly images: readonly ImageFinding[]
  readonly blocks: readonly BlockFinding[]
  /** True when the listings above were cut to stay within a tool response. */
  readonly truncated: boolean
}

const BLOCK_SELECTOR = 'p, div, h1, h2, h3, h4, h5, h6, blockquote, li, figure, figcaption, aside, table'
const MAX_MATH = 400
const MAX_BLOCKS = 300
const TEXT_PREVIEW = 240

export function diagnoseSection(document_: Document, sectionIndex: number): SectionDiagnosis {
  const root = document_.body ?? document_.documentElement
  if (!root) {
    return {
      sectionIndex,
      counts: { blocks: 0, headings: 0, images: 0, imagesWithTex: 0 },
      images: [],
      blocks: [],
      truncated: false,
    }
  }

  const images = Array.from(root.querySelectorAll('img'))
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))

  const imageFindings = images.slice(0, MAX_MATH).map((image) => {
    const tex = image.getAttribute('data-tex')
    const alt = image.getAttribute('alt')
    const src = image.getAttribute('src')
    const className = image.getAttribute('class')
    return {
      target: targetOf(image),
      ...(tex === null ? {} : { tex }),
      ...(alt === null ? {} : { alt }),
      ...(src === null ? {} : { src }),
      ...(className === null ? {} : { className }),
      alone: isAlone(image),
    }
  })

  const blockFindings = blocks
    .filter((block) => (block.textContent ?? '').trim().length > 0 || block.querySelector('img'))
    .slice(0, MAX_BLOCKS)
    .map((block) => {
      const className = block.getAttribute('class')
      return {
        target: targetOf(block),
        tag: block.tagName.toLowerCase(),
        ...(className === null ? {} : { className }),
        text: collapse(block.textContent ?? '').slice(0, TEXT_PREVIEW),
        images: block.querySelectorAll('img').length,
      }
    })

  return {
    sectionIndex,
    counts: {
      blocks: blocks.length,
      headings: root.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
      images: images.length,
      imagesWithTex: images.filter((image) => image.hasAttribute('data-tex')).length,
    },
    images: imageFindings,
    blocks: blockFindings,
    truncated: images.length > MAX_MATH || blocks.length > MAX_BLOCKS,
  }
}

function isAlone(image: Element): boolean {
  const parent = image.parentElement
  if (!parent) return false
  if (parent.querySelectorAll('img').length !== 1) return false
  return (parent.textContent ?? '').trim().length === 0
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
