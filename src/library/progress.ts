import type { BookCatalogEntry } from '../domain/index.ts'

/**
 * Progress only counts once a person is actually somewhere in the book, so a
 * book that was merely opened does not advertise false continuation state.
 */
export function hasMeaningfulProgress(entry: BookCatalogEntry): boolean {
  const state = entry.readingState
  if (!state) return false
  return state.location.sectionIndex > 0 || state.location.fraction >= 0.01
}

export function progressPercent(entry: BookCatalogEntry): number | undefined {
  if (!hasMeaningfulProgress(entry)) return undefined
  return Math.min(100, Math.max(0, Math.round((entry.readingState?.location.fraction ?? 0) * 100)))
}

/**
 * Catalogue titles often carry their subtitle in one `dc:title`, most visibly
 * in Project Gutenberg's `Title / Being a longer explanation` convention.
 * Splitting for display keeps the shelf scannable without discarding anything:
 * the remainder is shown as a subtitle, and the stored metadata is untouched.
 */
export function splitTitle(metadata: BookCatalogEntry['metadata']): {
  readonly title: string
  readonly subtitle?: string
} {
  const separator = metadata.title.indexOf(' / ')
  if (separator > 0) {
    return {
      title: metadata.title.slice(0, separator).trim(),
      subtitle: metadata.subtitle ?? metadata.title.slice(separator + 3).trim(),
    }
  }
  return { title: metadata.title, subtitle: metadata.subtitle }
}

export function authorLine(entry: BookCatalogEntry): string {
  const authors = entry.metadata.authors.map((author) => author.name).filter(Boolean)
  if (authors.length === 0) return 'Unknown author'
  if (authors.length <= 2) return authors.join(' and ')
  return `${authors[0]} and ${authors.length - 1} others`
}

const UNITS: readonly [limitMs: number, divisorMs: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60_000, 1_000, 'second'],
  [3_600_000, 60_000, 'minute'],
  [86_400_000, 3_600_000, 'hour'],
  [604_800_000, 86_400_000, 'day'],
  [2_629_800_000, 604_800_000, 'week'],
  [31_557_600_000, 2_629_800_000, 'month'],
]

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const elapsed = now.getTime() - then
  if (elapsed < 45_000) return 'just now'
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [limit, divisor, unit] of UNITS) {
    if (elapsed < limit) return format.format(-Math.round(elapsed / divisor), unit)
  }
  return format.format(-Math.round(elapsed / 31_557_600_000), 'year')
}

export function lastReadLabel(entry: BookCatalogEntry, now?: Date): string | undefined {
  const state = entry.readingState
  if (!state || !hasMeaningfulProgress(entry)) return undefined
  const chapter = state.location.chapterLabel
  const when = relativeTime(state.updatedAt, now)
  return chapter ? `${chapter} · ${when}` : when
}
