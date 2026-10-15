/**
 * Book artifacts prototype (ticket 01). Throwaway: this models the direction
 * in docs/plan/book-artifacts/spec.md closely enough to feel it on a phone.
 */
import type { PaintedReaderTheme } from '../reader/theme.ts'

export type Hue = 'terracotta' | 'amber' | 'sky' | 'moss' | 'plum'
export type MarkingStyle = 'wash' | 'margin' | 'pin'
export type ArtifactKind = 'interactive' | 'animation' | 'check' | 'note' | 'kept' | 'map' | 'session'

export interface Anchor {
  readonly sectionIndex: number
  /** Text that occurs verbatim in the section; resolved to a CFI at runtime. */
  readonly text: string
  readonly chapter: string
  /** Known exactly when the anchor came from a selection. */
  readonly cfi?: string
}

export interface Artifact {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly kind: ArtifactKind
  /** Absent for artifacts about the whole book. */
  readonly anchor?: Anchor
  readonly marking: MarkingStyle
  readonly hue: Hue
  readonly glyph: string
  readonly html: string
  readonly author: 'tutor' | 'reader' | 'kept'
  readonly createdAt: string
  readonly versions: number
  readonly poster?: string
  readonly conversationId?: string
}

export type MemoryKind = 'understood' | 'struggled' | 'opinion' | 'preference'

export interface Memory {
  readonly id: string
  readonly kind: MemoryKind
  readonly text: string
  readonly sectionIndex?: number
  readonly by: 'tutor' | 'reader'
  readonly createdAt: string
}

export interface Voice {
  readonly global: string
  readonly book: string
}

export interface Message {
  readonly id: string
  readonly role: 'reader' | 'tutor'
  /** Reader text, or the tutor's rich HTML rendered in an artifact frame. */
  readonly body: string
  readonly receipts?: readonly string[]
  readonly remembered?: string
  readonly artifactId?: string
  readonly passage?: string
  readonly createdAt: string
  /** Live-flow state for a tutor turn in progress. */
  readonly status?: 'thinking' | 'streaming' | 'building' | 'done'
  /** A memory the tutor proposes and asks about before saving. */
  readonly memoryAsk?: string
  readonly memoryAnswer?: 'saved' | 'declined'
}

export interface Conversation {
  readonly id: string
  readonly title: string
  readonly sectionIndex: number
  readonly chapter: string
  readonly anchorText?: string
  readonly anchorCfi?: string
  readonly createdAt: string
  readonly messages: readonly Message[]
}

export const HUES: Record<PaintedReaderTheme, Record<Hue, string>> = {
  light: { terracotta: '#c24a2b', amber: '#d69e2e', sky: '#3b82f6', moss: '#48946a', plum: '#7c4ddb' },
  sepia: { terracotta: '#a6401f', amber: '#b67a0c', sky: '#2b67c4', moss: '#3a7a52', plum: '#7042c2' },
  dark: { terracotta: '#ff9a76', amber: '#f3c257', sky: '#82b4ff', moss: '#7fd3a0', plum: '#c3a6ff' },
}

export const KIND_LABEL: Record<ArtifactKind, string> = {
  interactive: 'Interactive',
  animation: 'Animation',
  check: 'Check yourself',
  note: 'Your note',
  kept: 'Kept from chat',
  map: 'Whole book',
  session: 'Session',
}

export const MEMORY_LABEL: Record<MemoryKind, string> = {
  understood: 'Understood',
  struggled: 'Wrestled with',
  opinion: 'Your take',
  preference: 'How you learn',
}
