import type { ReaderStyle } from '../domain/reader.ts'

/**
 * Runtime theme values shared by the React shell and the isolated EPUB frame.
 *
 * A theme change used to ask the iframe to read CSS custom properties from the
 * shell before React had committed the new theme attribute. That made the book
 * exactly one theme late. Keeping the semantic values as data means the shell,
 * iframe, and tutor overlay all receive one atomic palette for the requested
 * theme instead of observing one another mid-render.
 */
export interface ReaderThemePalette {
  readonly canvas: string
  readonly ink: string
  readonly muted: string
  readonly rule: string
  readonly accent: string
  readonly accentQuiet: string
  readonly raised: string
}

export const READER_THEME_PALETTES = {
  light: {
    canvas: '#fafafa',
    ink: '#0f1115',
    muted: '#5e6470',
    rule: '#e5e7eb',
    accent: '#c24a2b',
    accentQuiet: 'color-mix(in oklch, #c24a2b 12%, #fafafa)',
    raised: '#ffffff',
  },
  sepia: {
    canvas: '#f4efe4',
    ink: '#29231b',
    muted: '#655c50',
    rule: '#d8cdbb',
    accent: '#9b3b21',
    accentQuiet: '#ead9ca',
    raised: '#fffaf0',
  },
  dark: {
    canvas: '#171717',
    ink: '#f4efe9',
    muted: '#b8b0a7',
    rule: '#3b3733',
    accent: '#ff9a76',
    accentQuiet: '#3b2922',
    raised: '#232220',
  },
} as const satisfies Record<Exclude<ReaderStyle['theme'], 'publisher'>, ReaderThemePalette>

export type PaintedReaderTheme = keyof typeof READER_THEME_PALETTES

export function paintedReaderTheme(theme: ReaderStyle['theme']): PaintedReaderTheme {
  return theme === 'publisher' ? 'light' : theme
}

export function shellPalette(theme: ReaderStyle['theme']): ReaderThemePalette {
  return READER_THEME_PALETTES[paintedReaderTheme(theme)]
}

export function bookPalette(theme: ReaderStyle['theme']): Pick<ReaderThemePalette, 'canvas' | 'ink'> {
  return theme === 'publisher'
    ? { canvas: 'transparent', ink: 'inherit' }
    : READER_THEME_PALETTES[theme]
}
