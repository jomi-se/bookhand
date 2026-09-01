# Bookhand design system

Last confirmed: 2026-09-01

## Product posture

Bookhand is a clean, polished private library whose interface recedes while a
person reads. The product uses a soft-light theme by default and keeps the book
as the primary visual surface. It should feel warm through typography, real book
artwork, and one restrained terracotta accent rather than through beige chrome,
decorative texture, or ornamental panels.

The approved Slice 1 north star is the quiet-catalog direction: a compact
library header, ruled book rows, a calm reader, a lightweight table of contents,
and one-surface-at-a-time mobile adaptation. Generated mocks are composition
references, not assets to rasterize or sources of fake product state.

- Approved palette specimen: `docs/design/slice-1-palette.png`
- Approved library/reader north star: `docs/design/slice-1-north-star.png`

## Identity

- Use the open-book mark with a terracotta center spine and the Bookhand
  wordmark. Do not reuse Agent Connect's colored-dot motif.
- The app canvas is a true near-white. Book content may use its own theme and
  publisher CSS inside the reader boundary.
- Fine rules, space, and weight establish hierarchy. Avoid card grids, fake
  shelves, parchment textures, broad shadows, glass effects, and decorative
  gradients.

## Palette

Use OKLCH tokens in implementation while preserving these approved targets:

- Canvas: `#fafafa`
- Ink: `#0f1115`
- Muted: `#5e6470`
- Rule: `#e5e7eb`
- Accent: `#c24a2b`

Accent should occupy less than roughly ten percent of ordinary product chrome.
It identifies primary actions, progress, selection, and the book-spine motif;
it is not decoration. Body and muted text must meet WCAG AA contrast.

## Typography

- Inter carries product headings, controls, labels, metadata, and status text.
- Source Serif 4 is reserved for the Bookhand wordmark and occasional literary
  moments in the library. It is not used for product controls.
- EPUB typography remains isolated behind `ReaderAdapter`; app CSS must not
  leak into publisher content.
- Product type uses a fixed, compact scale. Reading type is user-adjustable and
  capped to a comfortable measure.

## Library

- Start in the library, with one bundled judging-period EPUB represented as a
  normal local book. The bundled book is removable after judging without
  redesigning the empty state.
- The primary actions are Continue/Open and Open EPUB.
- A continue-reading section appears only after meaningful progress exists.
- All books use a ruled list: cover, title, author, format, progress, last-read
  context, and bounded actions. Do not add search, collections, or metrics until
  library scale requires them.
- The footer states the local storage boundary plainly.

## Reader

- Desktop chrome contains Library/back, book and chapter identity, Contents,
  Study, and Text controls. The book is the largest and calmest region.
- Contents is an adjacent drawer; reading settings are an adjacent panel. Do
  not layer both over the book simultaneously.
- Previous and next navigation have large hit areas and low visual emphasis.
- Selection exposes a small `Study this` affordance and an exact source range.
- Slice 1 may open a sparse study-board shell, but it does not implement study
  items, annotations, or agent behavior from later slices.
- Custom book CSS is previewable, visible, persistable, and resettable.

## Responsive behavior

- Mobile keeps one primary surface at a time. It never squeezes reader and
  board into two columns.
- Contents and Text use full-height sheets. Study switches surface.
- Bottom actions use at least 44 by 44 CSS-pixel targets and respect safe-area
  insets. Core behavior cannot depend on hover.
- The physical Pixel 7 is the acceptance surface for touch selection and
  lifecycle claims; viewport emulation proves layout only.

## Motion

Motion communicates state: panels enter and leave in 150–250 ms, selections and
saved state acknowledge briefly, and no page-load choreography delays reading.
Every transition has a reduced-motion path.
