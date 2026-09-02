# Pixel 7 reader diagnosis

Date: 2026-09-02
Commit reviewed: `1a820b4`
Surface reviewed: production build (`dist/`, byte-identical to `src/` at this
commit) served by `vite preview`, driven through Playwright with the
`Pixel 7` device profile — viewport 412×839, screen 412×915, DPR 2.625,
`isMobile: true`, `hasTouch: true`.

Diagnosis only. **No code was changed.** One candidate fix was validated by
injecting CSS at runtime in the browser; it has not been applied to the
repository. Evidence (screenshots, probe scripts) is under the ignored
`.playwright-mcp/mobile-review-2026-09-02/`.

## Executive judgment

The reported clunkiness and flickering are not diffuse polish debt. They are
two specific, reproducible defects, and the larger of the two is a single
missing CSS declaration.

**The reader has no width.** `.reader` is a grid that declares
`grid-template-rows` but never `grid-template-columns`, so its implicit column
is `auto` — max-content sized. The whole reading surface below it is therefore
sized by the widest thing in the book rather than by the viewport. In
*Calculus Made Easy*, whose chapters carry wide SVG figures and display
equations, the document width swings between **412px and 754px on a 412px
phone**. The three toolbar buttons (Contents, Study, Text) sit at x=401–545 and
are **completely off-screen for most of the book**, and body text is clipped
mid-sentence at the right edge. This is the clunkiness.

**Each chapter transition rebuilds the book iframe one pixel to the right.**
That is the flickering: a 301×642 region — 76% of the visible reading area —
repainting and jumping, scored by Chrome as a 0.201 layout shift, at roughly
every other section load.

Everything else found here is ordinary mobile polish and is small by
comparison. Fix the grid column first; several symptoms that look like separate
bugs are the same bug.

## Defect 1 — the reading surface is max-content sized (blocking)

`src/reader/reader.css:1`

```css
.reader {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;   /* no columns declared */
  block-size: 100svh;
}
```

Measured ancestor chain at a 412px viewport, on Chapter V:

| element | width | notes |
| --- | --- | --- |
| `body` | 412 | `scrollWidth` 724 |
| `.reader` | 412 | **column track resolves to `724px`** |
| `.reader-stage` | 724 | `grid-template-columns: 724px` |
| `.reader-book-area` | 724 | tracks `44px 636px 44px` |
| `.reader-surface` | 636 | despite `min-inline-size: 0` |

`.reader-surface` already sets `min-inline-size: 0`, and `.reader-stage` already
collapses to one column under the 860px media query. Neither helps, because the
overflow is introduced one level higher: the parent grid's own column is
content-sized, so every `minmax(0, 1fr)` beneath it is resolving against a
724px track rather than against 412px.

Over 55 page turns the document took **twelve distinct widths** — 412, 441,
442, 454, 513, 516, 559, 601, 654, 691, 724, 754 — and the reading column took
twelve correspondingly distinct widths from 324px to 666px. Line length changes
chapter to chapter, and the page becomes horizontally scrollable.

The blow-out is not viewport-dependent: at 393, 360 and **320px** the document
`scrollWidth` stayed pinned at 559. Smaller phones are affected identically.

### Verified fix

Injected at runtime, then re-measured over the same 55 turns:

```css
.reader { grid-template-columns: minmax(0, 1fr); }
.reader-stage,
.reader-book-area,
.reader-surface { min-inline-size: 0; }
```

| | as shipped | with fix |
| --- | --- | --- |
| distinct document widths over 55 turns | **12** (412–754) | **1** (412) |
| distinct reading-column widths | **12** (324–666) | **1** (324) |
| toolbar right edge (viewport 412) | **545 — off-screen** | 398 |
| worst single layout shift | 0.406 | 0.201 |

Screenshot pair: `as-shipped-412px.png` (no toolbar, text clipped mid-sentence,
next-page chevron missing) versus `with-grid-column-fix-412px.png` (full
toolbar, both chevrons, text fits).

The `min-inline-size: 0` additions may prove redundant once the column is
declared; they were bundled into the A/B and have not been isolated.

## Defect 2 — the book iframe is re-created, 1px off, per section (blocking)

With Defect 1 patched out, layout shifts remain. Attributed, they are all
identical:

```
value 0.201
source: node = detached
        previousRect [55, 113, 301, 642]
        currentRect  [56, 113, 301, 642]
```

The node is **detached** by the time the observer reports, and it moves exactly
one pixel horizontally. That is the book iframe being destroyed and rebuilt at
each section load, with the replacement landing on a different subpixel
boundary. Foliate's layout for this container is fractional throughout —
container `301.34375px`, document padding `11.3409px`, column gap `22.6818px` —
so the rounding differs between the outgoing and incoming document.

Cumulative shift over 55 turns: **1.46 as shipped, 1.42 with the Defect 1 fix**
(the fix halves the worst individual shift but does not remove these). For
scale, a "good" CLS for an entire page load is 0.1.

Foliate rebuilds the section document by design, so the durable remedy is
probably to stop the repaint being visible — settle the incoming section before
it is shown, and give the paginator integral geometry so consecutive sections
round the same way — rather than to prevent the rebuild.

## Defect 3 — `<foliate-view>` is never configured for a phone

The element carries **zero attributes**. Every foliate default therefore
applies, and the defaults are desktop-shaped:

- `--_margin: 48px`, applied top and bottom, **96px of empty vertical space**.
  Measured at 412×839: chrome 65 + footer 36 leaves a 738px surface, of which
  the book document occupies 642px. Text gets 76% of the screen height.
- `--_max-inline-size: 720px`, irrelevant on a phone but part of why the
  max-content sizing in Defect 1 lands where it does.
- **No `animated` attribute.** `paginator.js:901` only animates when it is
  present, so page turns and swipe-snap complete instantly with no transition.
  On touch this reads as unresponsive rather than fast — the drag follows the
  finger and then jumps.

`flow`, `gap`, `margin` and `max-column-count` are all observed attributes and
are the intended configuration surface. None are set.

## Defect 4 — a third of the screen width is chrome, and tapping does nothing

`.page-step` buttons take 44px on each side. Of a 412px screen:

```
412  viewport
-88  two page-step buttons        (21%)
=324 reader surface
-46  foliate document padding     (11.34px × 2)
=278 actual text column           (67% of screen)
```

At 16px body text that is roughly 34 characters per line.

Meanwhile a **tap in the centre of the page does nothing** — measured, the
progress reading did not change. Tap-to-turn is the near-universal phone
gesture for readers, and the space it would use is currently spent on two
persistent desktop buttons. Swipe does work (foliate binds `touchstart` and
`touchmove`), but without `animated` it snaps hard.

## Defect 5 — every `env(safe-area-inset-*)` in the codebase is inert

`index.html` declares:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

Without `viewport-fit=cover`, safe-area insets resolve to `0px`. The
`env(safe-area-inset-*)` calls in `.reader-chrome`, `.panel-body`,
`.selection-action`, `.reader-footer` and `library.css` are all dead code
today. On a Pixel 7 with gesture navigation the system gesture bar sits over the
footer.

Adding `viewport-fit=cover` activates code that is already written — but it
also un-pads the layout everywhere at once, so it wants checking rather than
assuming.

## Defect 6 — Chrome Android text autosizing is unpinned (does not reproduce in emulation)

The book document reports `-webkit-text-size-adjust: auto`. `makeReaderCss` in
`src/reader/FoliateReaderAdapter.ts` sets font-size, line-height, measure and
paragraph spacing, but never pins text-size-adjust.

On real Chrome for Android, autosizing inflates text inside a blob iframe that
has no viewport meta of its own, by a factor derived from the frame width. The
paginator's column arithmetic is computed from the container, not from the
inflated text, so the two disagree: lines clip, and pages come out unevenly
full. **This is invisible in devtools emulation and in this Playwright run** —
it is a candidate explanation for phone-only symptoms that do not reproduce
here, and should be confirmed on the actual device before being treated as
fact.

`touch-action` on the book body is likewise `auto`, leaving double-tap zoom and
pinch free to desync pagination from the rendered columns.

## Defect 7 — opening a panel churns the reader

On mobile the 860px media query sets `.reader-book-area { display: none }` while
a panel is open. The foliate container's `ResizeObserver` therefore sees a 0×0
box, re-renders, and re-renders again on close: **3 `relocate` events per
open/close cycle**, measured for each of Contents, Study and Text.

Consequences:

- Position mostly survives, but the Contents toggle drifted the reading
  fraction from `0.10244` to `0.10217`. Repeated toggling walks the reader
  slowly backwards.
- `ReaderScreen.tsx:52` re-runs `renderAnnotations(study.marks)` on every
  `reader.location` change, and `renderAnnotations` deletes and re-adds every
  mark. So each panel toggle, and each page turn, tears down and redraws all
  stored highlights.

Hiding the book area with `visibility`/off-screen positioning rather than
`display: none`, or keying the annotation effect on section rather than
location, would each cut part of this.

## Defect 8 — `npm run dev` is broken

Unrelated to mobile, found while setting up. The `Content-Security-Policy` meta
tag in `index.html` blocks Vite's React Fast Refresh preamble:

```
Executing inline script violates the following Content Security Policy
directive 'script-src 'self' 'wasm-unsafe-eval''
Error: @vitejs/plugin-react can't detect preamble. Something is wrong.
```

The app does not boot in dev mode. Only `build` + `preview` works. Anyone
cloning the repo hits this on their first command, so it is worth a fix or a
line in the README before the repo goes public.

## What is genuinely fine

Stated plainly so it does not get re-litigated:

- **Tap targets:** every interactive element measured ≥44×44. No violations.
- **Chrome and footer geometry:** stable at 65px / 36px / 738px across 40 page
  turns. No vertical churn.
- **Style controls:** dragging a text slider costs ~15ms per frame, 326ms for
  20 steps. `applyStyle` is not a jank source.
- **Text panel controls:** all range inputs are 44px tall, the panel body
  scrolls correctly. Its measured 559–724px width on a 412px screen is
  Defect 1, not a panel bug.
- **Console:** clean in the production build apart from foliate's own iframe
  sandbox warning.
- **No long tasks** were recorded during page turns — but this ran on desktop
  CPU. A Pixel 7 is materially slower, so this is not evidence that page turns
  are cheap on the actual device.

## Suggested order

1. **Defect 1** — one declaration, verified, removes the off-screen toolbar,
   the clipped text, and the chapter-to-chapter line-length swing.
2. **Defect 4** — tap-to-turn zones, and reclaim the 88px the page-step buttons
   spend. Largest remaining gain in reading area.
3. **Defect 3** — set `margin`, `gap` and `animated` on `<foliate-view>` for the
   phone breakpoint. Cheap; recovers ~96px of height and makes turns feel
   deliberate.
4. **Defect 2** — the residual flicker. Hardest, and worth attempting only
   after 1 and 3, since both change the geometry it depends on.
5. **Defects 5, 6, 7** — need a real device to confirm, not emulation.
6. **Defect 8** — before the repo is public.

## Reproducing

```sh
npm run build
npx vite preview --port 4173
node .playwright-mcp/mobile-review-2026-09-02/probe5.mjs   # the Defect 1 A/B
node .playwright-mcp/mobile-review-2026-09-02/probe6.mjs   # Defect 2 attribution
```

`probe.mjs` through `probe4.mjs` cover the layout, header, panel and overflow
measurements quoted above.

---

## Outcome, 2026-09-02 (W3)

Re-measured on the same Pixel 7 profile against a fresh production build.
Evidence under `.playwright-mcp/mobile-review-2026-09-02/w3-*`; regression
tests in `tests/e2e/reader-mobile.spec.ts`, which runs as its own Playwright
project so the device profile is real rather than emulated over a desktop one.

| defect | state |
| --- | --- |
| 1 — max-content reading surface | **closed** (before W3, at `9a3428c`) |
| 2 — per-section iframe rebuild | **partly closed**, see below |
| 3 — `<foliate-view>` unconfigured | **closed** |
| 4 — side rails and dead centre tap | **closed** |
| 5 — inert safe-area insets | **closed** |
| 6 — text autosizing unpinned | **closed** in code, still unconfirmed on a real device |
| 7 — panel toggle churns the reader | **closed** |
| 8 — `npm run dev` broken | **closed**, plus a second dev-only fault it was hiding |

### Measured

| | as shipped | now |
| --- | --- | --- |
| distinct document widths over 40 turns | 12 (412–754) | **1** (412) |
| book host as a share of the viewport at 412 | 79% | **100%** |
| …at 320 | 79% | **100%** |
| …in landscape (915×412) | 53% | **100%** |
| horizontal app-shell overflow, all setups | present | **0** |
| tap in the centre of the page | nothing | toggles chrome |
| reading fraction after one panel open/close | drifts (0.10244 → 0.10217) | **identical** |

Contrast against the shell background, all three themes: body ink 13.6–18.1,
secondary text 5.7–8.4, tool buttons 13.6–18.1. All above WCAG AA.

### What W3 changed, and why

**Defect 4 was two bugs, not one.** Removing the rails and adding tap zones was
the easy half. The hard half only appeared once taps worked: Foliate's own
`touchend` handler calls `snap(0, 0)`, which resolves to the current page and
then, *because that page is page 0 or the last page*, navigates to the adjacent
section. So on a phone any tap taken while on a section's first page jumped
backwards a whole section — a pre-existing fault, invisible only because
tapping did nothing at all. Tap detection is therefore registered in capture
phase on the section document, which is the one place that runs before
Foliate's own listener, and a recognized tap stops propagation. Nothing else
is stopped.

**The tap zone cannot be measured inside the iframe.** Foliate lays each
section out as a single very wide multi-column canvas and slides it, so
`clientX` for a tap on the fourth page is several thousand pixels and
`innerWidth` is the whole column set — measured at 4215 and 5365 on a 412px
phone. The zone is computed by adding the frame's own position in the host
document, which converts back to where the finger was on screen. The first
version of this shipped in a build that looked right on the cover, where the
section happens to be one page wide.

**Handlers were being silently dropped.** `bindLatestOptions` listed the events
it forwarded by hand, so `onTap` never reached the adapter — and neither had
`onAnnotationActivate`, since it was introduced. The list is now checked at
compile time. A forgotten handler is invisible: nothing fails, the feature
simply never happens.

**Themes were duplicated.** The book document carried its own copy of the three
palettes, and they had already drifted — the shell's sepia was `#f4efe4`, the
book's `#f5eddd`, a seam down the edge of every page. The book now reads the
live `--canvas` and `--ink` from the shell, so they cannot disagree.

**The mathematics disappeared in dark mode.** Every equation in this book is a
black monochrome glyph image, so on a dark page it was not dim but invisible —
the same failure as W1's stripped passages, in a different medium. `img[data-tex]`
is inverted under the dark theme only; figures, which are photographs' shape
rather than line art's, are left alone.

**The breakpoint was width-only.** A phone in landscape is 915px across and was
getting the desktop layout, rails and all. The touch-first layout now also
triggers on a coarse pointer.

**Defect 8 was hiding a second dev-only fault.** With the CSP relaxed for the
dev server, the app booted — and then failed to load SQLite, because
`locateFile` resolved the wasm relative to the worker's own URL. A built worker
happens to sit beside the wasm in `assets/`, so this worked in production and
silently fetched `index.html` in development.

### Still open

**Defect 2.** The 1px horizontal jump is gone — residual shifts now report
`dx: 0, dy: 0`, so the incoming section lands where the outgoing one was. What
remains is the rebuild itself: 8–9 shift events over 55 turns, one per section
load, each a size change on a detached node. Cumulative score rose from 1.46 to
2.9 because the reading surface is now the full width of the phone and CLS
scales with the area affected, not because more is moving. The book host now
paints the theme's own canvas underneath so the gap is the colour of the page
rather than a flash of white, and is `contain: layout paint`. Genuinely fixing
this means settling the incoming section before it is shown, which is a change
inside Foliate's render path.

**Defect 6** is fixed as written but was never reproducible in emulation. It
needs a real Android device to confirm.

**Not owned above Foliate.** `VAL-MOBILE-GESTURES` specifies drag-intent
thresholds — lock after 12px at a 1.5:1 horizontal ratio, complete at 20% of
viewport width or 0.5px/ms. Those live inside Foliate's paginator and are not
configurable. Tap intent is ours and is tested to the stated boundaries;
swipe behaviour is Foliate's, and this is recorded rather than claimed.
