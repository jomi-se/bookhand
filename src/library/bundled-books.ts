/**
 * Data-driven registration for books shipped with the build. The library has no
 * special case for these: removing an entry leaves the ordinary empty state, so
 * the judging book can be withdrawn without touching a component.
 */
export interface BundledBookRegistration {
  /** Resolved against the app base URL. */
  readonly path: string
  readonly sha256: string
  readonly byteLength: number
  readonly sourceUrl: string
  readonly retrievedAt: string
  readonly removeAfterJudging: boolean
}

export const BUNDLED_BOOKS: readonly BundledBookRegistration[] = [
  {
    path: 'books/calculus-made-easy.epub',
    sha256: '256371b889e29ab74fafd2efc1b75f0344438809d873ea76dd3231cf7d364dd0',
    byteLength: 13_214_664,
    sourceUrl: 'https://www.gutenberg.org/ebooks/33283',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    removeAfterJudging: true,
  },
  {
    path: 'books/relativity.epub',
    sha256: 'bf06a8a83e08889277667c34b1d914fcd37d734646cbb44bb4da028bcbe65a39',
    byteLength: 1_091_398,
    sourceUrl: 'https://www.gutenberg.org/ebooks/36114',
    retrievedAt: '2026-09-03T00:00:00.000Z',
    removeAfterJudging: true,
  },
  {
    path: 'books/flatland.epub',
    sha256: '56348c6910e42b672cf4c6a550033fdac361e652298c1ec5bf0403db9d396089',
    byteLength: 300_202,
    sourceUrl: 'https://www.gutenberg.org/ebooks/201',
    retrievedAt: '2026-09-03T00:00:00.000Z',
    removeAfterJudging: true,
  },
]
