import type { ReaderStyle, StudyBoardView } from '../domain/index.ts'
import { CANONICAL_GUIDANCE, DESIGN_CONTEXT_VERSION } from 'virtual:bookhand-design-context'

/**
 * What a browser agent is told about composing inside Bookhand.
 *
 * A repository agent can read `DESIGN.md`. The agents this product is actually
 * for cannot: they see a page and the tools it registers, nothing else. Without
 * this, an agent can discover that `set_reading_style` accepts CSS but not one
 * thing about what would make the result coherent — so calling the design
 * document an embedded prompt would be a claim about the repository, not about
 * the running product.
 *
 * The guidance is deliberately not a permission system. It names semantic
 * roles, accessibility floors, containment, and the person's reversal routes,
 * and then says outright that the shipped aesthetic may be replaced. An agent
 * that reads this and builds something that looks nothing like Bookhand has
 * used it correctly.
 */

export const DESIGN_SURFACES = ['library', 'reader', 'study'] as const
export type DesignSurface = (typeof DESIGN_SURFACES)[number]

/** Coarse enough to act on, and it never carries a device or user identity. */
export type ViewportClass = 'compact' | 'wide'

export interface PresentationSummary {
  readonly theme: ReaderStyle['theme']
  readonly fontSizePercent: number
  readonly lineHeight: number
  readonly measureCh: number
  readonly paragraphSpacingEm: number
  /** Whether custom book CSS is in force. The CSS itself is never returned. */
  readonly hasCustomCss: boolean
}

export interface DesignContextState {
  readonly activeSurface: DesignSurface
  readonly viewport: ViewportClass
  readonly coarsePointer: boolean
  /** The design-bearing tools registered right now, in registration order. */
  readonly mutationTools: readonly string[]
  /** Absent when no book is open. Reported as unavailable rather than guessed. */
  readonly presentation?: PresentationSummary
  readonly boardView?: StudyBoardView
}

export const MAX_DESIGN_CONTEXT_UNITS = 6_000

export const DESIGN_CONTEXT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/

export const SEMANTIC_ROLES = [
  'canvas',
  'raised surface',
  'ink',
  'muted ink',
  'rule',
  'accent',
  'quiet accent',
  'focus',
  'selection',
  'error',
] as const

export const NATIVE_STUDY_PRIMITIVES = [
  'prose',
  'quotation',
  'equation',
  'steps',
  'question',
] as const

export interface GuidanceInvariant {
  readonly key: string
  readonly name: string
  readonly body: string
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Reads the invariants back out of the same bytes the version digests, so the
 * text an agent receives and the version it is handed cannot disagree.
 */
export function parseGuidanceInvariants(canonical: string): readonly GuidanceInvariant[] {
  const invariants: GuidanceInvariant[] = []
  let current: { name: string; parts: string[] } | undefined
  const flush = () => {
    if (!current) return
    const body = current.parts.join(' ').replace(/\s+/g, ' ').trim()
    if (body) invariants.push({ key: slug(current.name), name: current.name, body })
    current = undefined
  }
  for (const line of canonical.split('\n')) {
    const opening = /^-\s+\*\*(.+?):\*\*\s*(.*)$/.exec(line)
    if (opening) {
      flush()
      current = { name: opening[1] ?? '', parts: [opening[2] ?? ''] }
      continue
    }
    if (current && /^\s+\S/.test(line)) current.parts.push(line.trim())
    else if (current && line.trim() === '') flush()
  }
  flush()
  return invariants
}

export const GUIDANCE_INVARIANTS = parseGuidanceInvariants(CANONICAL_GUIDANCE)

/**
 * Four to six per surface. The library has no book, so the reading-first
 * invariant would be advice about something that is not on screen.
 */
export const SURFACE_INVARIANT_KEYS: Record<DesignSurface, readonly string[]> = {
  library: [
    'creative-freedom',
    'complete-worlds',
    'accessible-by-construction',
    'visible-user-control',
    'truthful-containment',
  ],
  reader: [
    'creative-freedom',
    'complete-worlds',
    'reader-and-source-first',
    'accessible-by-construction',
    'visible-user-control',
    'truthful-containment',
  ],
  study: [
    'creative-freedom',
    'reader-and-source-first',
    'complete-worlds',
    'accessible-by-construction',
    'visible-user-control',
    'truthful-containment',
  ],
}

export function invariantsForSurface(surface: DesignSurface): readonly GuidanceInvariant[] {
  const wanted = SURFACE_INVARIANT_KEYS[surface]
  const selected = wanted
    .map((key) => GUIDANCE_INVARIANTS.find((invariant) => invariant.key === key))
    .filter((invariant): invariant is GuidanceInvariant => invariant !== undefined)
  // If DESIGN.md is renamed out from under this map, send everything rather
  // than quietly sending less guidance than the contract promises. The unit
  // test fails loudly in that case; the running product still answers well.
  return selected.length >= 4 ? selected : GUIDANCE_INVARIANTS.slice(0, 6)
}

function describeViewport(state: DesignContextState): string {
  const shape =
    state.viewport === 'compact'
      ? 'one primary surface at a time; a panel replaces the book rather than sitting beside it'
      : 'the book and one panel are side by side'
  return `${state.viewport}${state.coarsePointer ? ', coarse pointer' : ''} — ${shape}`
}

function describePresentation(state: DesignContextState): readonly string[] {
  if (!state.presentation) {
    return [
      'Reading presentation: unavailable — no book is open.',
      'Study board: unavailable — no book is open.',
    ]
  }
  const p = state.presentation
  return [
    `Reading presentation: ${p.theme} theme, ${p.fontSizePercent}% text, line height ${p.lineHeight}, measure ${p.measureCh}ch, paragraph spacing ${p.paragraphSpacingEm}em, custom book CSS ${
      p.hasCustomCss ? 'in force (its text is never returned here)' : 'not in use'
    }.`,
    `Study board: ${state.boardView ?? 'unavailable — the board has not been read yet'}.`,
  ]
}

function reversalActions(state: DesignContextState): string {
  if (!state.presentation) {
    return 'Reversal actions: none apply yet. Opening a book makes Reset, Delete, and Return to source available.'
  }
  return [
    'Reversal actions available to the person right now: Reset (Text panel) restores every',
    'presentation default; Delete removes one study block or highlight; Return to source moves the',
    'book back to the passage a block came from. Preview-before-apply and Undo are not implemented',
    'yet — do not tell the person a change can be previewed or undone.',
  ].join(' ')
}

/**
 * Composes the response. Live state is read at call time; the guidance half is
 * fixed at build time and versioned, so an agent can cite the version it
 * designed against.
 */
export function composeDesignContext(
  requested: DesignSurface,
  state: DesignContextState,
): string {
  const lines: string[] = [
    `Bookhand design context · guidance version ${DESIGN_CONTEXT_VERSION}`,
    `Requested surface: ${requested}${
      requested === state.activeSurface ? ' (currently on screen)' : ` (on screen: ${state.activeSurface})`
    }`,
    `Viewport: ${describeViewport(state)}`,
    ...describePresentation(state),
    `Design-bearing tools registered now: ${
      state.mutationTools.length > 0 ? state.mutationTools.join(', ') : 'none'
    }`,
    '',
    `Semantic roles to define as one complete set: ${SEMANTIC_ROLES.join(', ')}.`,
    `Native study blocks: ${NATIVE_STUDY_PRIMITIVES.join(', ')}.`,
    '',
    'What each change can reach:',
    '- set_reading_style, including custom CSS, applies inside the EPUB document only. It cannot',
    '  style the library, reader chrome, panels, or Study.',
    '- upsert_study_item creates native study blocks that render through Bookhand’s own semantic',
    '  theme. Supply structure and content, not styling.',
    '- Whole-application custom worlds — theming the library, chrome, panels, and Study together —',
    '  are NOT available yet. No tool accepts them, and raw CSS or JavaScript aimed at the',
    '  application shell is refused rather than applied. Say so plainly if asked.',
    '',
    `Composition invariants for ${requested}:`,
  ]

  for (const invariant of invariantsForSurface(requested)) {
    lines.push(`- ${invariant.name}: ${invariant.body}`)
  }

  lines.push('', reversalActions(state))

  const text = lines.join('\n')
  if (text.length <= MAX_DESIGN_CONTEXT_UNITS) return text
  return `${text.slice(0, MAX_DESIGN_CONTEXT_UNITS - 1)}…`
}

/** The mobile breakpoint the reader itself uses, read at call time. */
export const COMPACT_VIEWPORT_QUERY = '(max-width: 860px)'

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

export function readViewportClass(): ViewportClass {
  return matches(COMPACT_VIEWPORT_QUERY) ? 'compact' : 'wide'
}

export function readCoarsePointer(): boolean {
  return matches('(pointer: coarse)')
}

/**
 * Everything about the presentation except the one thing the person wrote.
 * Custom CSS is user-authored content and never leaves the device through a
 * tool result; whether it is in force is the part an agent needs.
 */
export function summarizePresentation(style: ReaderStyle): PresentationSummary {
  return {
    theme: style.theme,
    fontSizePercent: style.fontSizePercent,
    lineHeight: style.lineHeight,
    measureCh: style.measureCh,
    paragraphSpacingEm: style.paragraphSpacingEm,
    hasCustomCss: typeof style.customCss === 'string' && style.customCss.trim().length > 0,
  }
}

export { DESIGN_CONTEXT_VERSION }
