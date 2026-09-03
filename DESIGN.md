---
name: Bookhand
description: A working library that recedes for reading and opens into grounded study.
colors:
  clear-canvas: "oklch(98.51% 0 89.88)"
  library-ink: "oklch(17.73% 0.0089 264.32)"
  quiet-graphite: "oklch(50.23% 0.0205 264.37)"
  fine-rule: "oklch(92.76% 0.0058 264.53)"
  terracotta-spine: "oklch(56.66% 0.1606 35.42)"
  terracotta-quiet: "color-mix(in oklch, oklch(56.66% 0.1606 35.42) 12%, oklch(98.51% 0 89.88))"
  raised-leaf: "oklch(100% 0 0)"
  sepia-canvas: "#f4efe4"
  sepia-ink: "#29231b"
  sepia-muted: "#655c50"
  sepia-rule: "#d8cdbb"
  sepia-accent: "#9b3b21"
  sepia-accent-quiet: "#ead9ca"
  sepia-raised: "#fffaf0"
  night-canvas: "#171717"
  night-ink: "#f4efe9"
  night-muted: "#b8b0a7"
  night-rule: "#3b3733"
  night-accent: "#ff9a76"
  night-accent-quiet: "#3b2922"
  night-raised: "#232220"
  highlight-amber: "#d69e2e"
  highlight-sky: "#3b82f6"
  highlight-moss: "#48946a"
typography:
  literary-display:
    fontFamily: "Source Serif 4 Variable, Iowan Old Style, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  literary-title:
    fontFamily: "Source Serif 4 Variable, Iowan Old Style, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  feature-title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  micro-label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  focus: "3px"
  compact: "4px"
  control: "6px"
  notice: "8px"
spacing:
  tight: "6px"
  compact: "10px"
  standard: "14px"
  comfortable: "18px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta-spine}"
    textColor: "{colors.clear-canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.raised-leaf}"
    textColor: "{colors.library-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  ruled-book-row:
    backgroundColor: "transparent"
    textColor: "{colors.library-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "14px 8px"
  reader-panel:
    backgroundColor: "{colors.clear-canvas}"
    textColor: "{colors.library-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.focus}"
  panel-field:
    backgroundColor: "{colors.raised-leaf}"
    textColor: "{colors.library-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  search-result-row:
    backgroundColor: "transparent"
    textColor: "{colors.library-ink}"
    typography: "{typography.body}"
    padding: "14px 0"
    height: "44px"
  advisory-notice:
    backgroundColor: "{colors.terracotta-quiet}"
    textColor: "{colors.library-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.notice}"
    padding: "8px 10px"
---

# Design System: Bookhand

## Overview

**Creative North Star: "The Working Library"**

Bookhand begins as a quiet private library, not a dashboard. The interface
recedes while a person reads, then becomes an active place of study when the
reader asks for it. Its warmth comes from real book artwork, literary type, and
one restrained accent rather than beige product chrome, decorative texture, or
nostalgia pasted onto controls.

The default world is calm, precise, quietly warm, and flat by default. Fine
rules, compact typography, honest state changes, and clear spatial transitions
carry hierarchy. The Study surface may become richer and more expressive than
the library, but it remains a composed learning artifact rather than a chat
transcript or a grid of equally weighted records.

This system is also an embedded design prompt. It describes how the shipped
world achieves harmony so people and agents can create different coherent
worlds. The default palette and components are reference-quality starting
points, not a restriction on customization.

**Key Characteristics:**

- Reader-first, with chrome that yields to the book.
- Ruled and typographic rather than card-based.
- One rare accent voice, used for meaning rather than decoration.
- Complete theme worlds, not an EPUB rectangle inside unrelated chrome.
- User-controlled customization with preview, reset, and Undo where persistent.
- Native study artifacts that remain visibly grounded in their sources.

Approved composition references remain at
`docs/design/slice-1-north-star.png` and
`docs/design/slice-1-palette.png`. They are references, not fake product state
or assets to rasterize into the application.

## Colors

The default library uses Clear Canvas, Library Ink, Quiet Graphite, Fine Rule,
Raised Leaf, and the rare Terracotta Spine accent. Reader themes are complete
semantic sets: Reading Sepia and Night Reading replace canvas, ink, muted,
rule, accent, quiet accent, and raised-surface roles together. Publisher mode preserves the
EPUB's own presentation while the application shell remains a neutral,
accessible frame.

**The Whole-World Theme Rule.** A reading theme changes every visible reader
surface: EPUB, chrome, panels, controls, overlays, focus, Study artifacts, and
status UI. Never leave a bright application frame around a dark book or apply a
new accent without checking it against every surface it touches.

**The One Accent Voice Rule.** A customized world may replace Terracotta Spine
with any deliberate accent, but ordinary chrome should still speak with one
primary accent occupying roughly ten percent or less of the surface. Additional
highlight colors label user meaning; they do not become competing brand colors.

### Custom theme grammar

A person or agent may replace the shipped colors freely. Define the semantic
roles first—canvas, raised surface, ink, muted ink, rule, accent, quiet accent,
focus, selection, and error—then apply them consistently. Check ordinary text
at WCAG AA, meaningful non-text state at 3:1, focus visibility, disabled state,
and selection contrast. Preview the world across the book, Contents, Text,
Study, annotations, errors, mobile, and desktop before persisting it. Always
retain a visible route back to a named shipped theme or the publisher baseline.

<!-- bookhand:agent-design-context:start -->
### Runtime agent design context

- **Creative freedom:** The shipped aesthetic is a strong example, not a
  boundary. Palette, typography, shape language, and composition may change
  radically when the result remains coherent within the supported surface.
- **Complete worlds:** Define canvas, raised surface, ink, muted ink, rule,
  accent, quiet accent, focus, selection, and error roles before applying a
  theme. Check the book, chrome, panels, Study, annotations, and status states
  together.
- **Reader and source first:** Give the book the calmest and largest reading
  region. Study artifacts lead with the learning material and keep exact,
  navigable source relationships. Multi-part teaching becomes one titled,
  ordered lesson rather than a flat feed or an equally weighted card grid.
- **Accessible by construction:** Preserve WCAG AA text contrast, 3:1
  meaningful non-text state, visible focus, disabled and selection contrast,
  44px coarse-pointer targets, reduced motion, and mobile reflow.
- **Visible user control:** Preview expressive changes before persistence.
  Identify agent-created work and expose the applicable Apply, Cancel, Undo,
  Reset, Return to source, or Delete action.
- **Truthful containment:** Custom EPUB CSS stays inside publisher content and
  native Study artifacts consume semantic roles. Whole-application custom
  worlds remain unavailable until their declarative schema, persistence,
  security boundary, and lifecycle contract are implemented; raw caller CSS
  or JavaScript never styles the parent application.
<!-- bookhand:agent-design-context:end -->

## Typography

**Literary Font:** Source Serif 4 Variable, with Iowan Old Style and Georgia as
fallbacks.

**Product Font:** Inter Variable, with the system sans stack as fallback.

**Code Font:** the platform monospace stack.

The pairing says “working library”: serif marks the Bookhand identity, library
titles, quotations, and occasional literary moments; sans-serif operates the
product. EPUB typography remains isolated behind `ReaderAdapter` and stays
user-adjustable.

### Hierarchy

- **Literary display:** library title and rare high-level literary moments.
- **Literary title:** wordmark and compact bookish identity.
- **Feature title:** the one book the library is inviting you back into. The
  largest sans voice in the product, and deliberately not serif: it names a
  resumable state, not the library's identity.
- **Body:** ordinary product text and authored study prose.
- **Label:** controls, metadata, status, panel headings, and values.
- **Micro label:** format tags, study kinds, and compact diagnostic metadata;
  raw agent/tool history belongs only in the separate diagnostics surface; uppercase
  tracking is allowed only where the content is genuinely a compact category.
- **Code:** custom CSS, raw equations until typeset, tool names, and diagnostic
  values.

**The Two Voices Rule.** Keep one literary voice and one operational voice.
Custom typography may replace either family, but must preserve the role
contrast and cannot leak application type rules into publisher content.

**The Borrowed Voice Rule.** Book words keep the literary voice even when they
appear inside product chrome. A search result's excerpt, a quoted highlight, and
a study quotation are set in the serif because they are the book speaking; the
label above them stays operational. Never set the book's own words in the
product font merely because they are inside a panel.

## Layout

The library is a centered working catalog capped near 900px. It uses a compact
masthead, a conditional Continue section, and full-width ruled book rows rather
than shelves or cards. Covers, titles, progress, and last-read context align to
a clear scanning grid and collapse intentionally on small screens.

The desktop reader gives the book the largest and calmest region. Contents,
Search, and Text occupy an adjacent panel; Study may dock or expand while
preserving the reading location. Mobile uses one primary surface at a time.
Contents, Search, Text, and Study become complete surfaces rather than
squeezing beside the book. Panels are `min-inline-size: 0` and clip horizontal
overflow, because a long unbroken string in book content must wrap rather than
widen the column the book is reading in.

Spacing follows a compact six-to-eighteen-pixel control rhythm and opens to
larger section gaps only when the information hierarchy changes. Coarse-pointer
targets are at least 44 by 44 CSS pixels. Safe-area insets and 320px-wide reflow
are part of the layout, not later patches.

**The Book Gets the Space Rule.** Reader chrome and diagnostics must justify
every permanent pixel. Navigation can overlay or recede on mobile; it must not
reserve broad rails that make the book feel like a preview.

## Elevation & Depth

Bookhand is flat by default. One-pixel rules, background tone, whitespace, and
ordering establish depth. Raised Leaf distinguishes controls or transient
selection actions without turning every region into a card. The only current
shadow is a tight, low selection-action shadow used to separate a temporary
control from book content.

**The Structural Depth Rule.** Prefer a rule, tonal change, or spatial move to a
shadow. Shadows appear only when an element temporarily floats above reading
content; never combine broad soft shadows with ornamental borders.

## Shapes

Shapes are compact and quiet. Controls and panel fields use gently squared
six-pixel corners; compact states use four pixels; focus treatment may use
three. Advisory notices — the block that says an agent changed something, or
that a study mutation failed — use eight, the only step above the control
radius. Book covers retain their physical rectangular silhouette. Full pills,
oversized rounding, floating glass panels, and decorative blobs do not belong
to the default world.

**The Rounder Means Louder Rule.** The eight-pixel radius is reserved for
blocks that interrupt: something happened that the person did not do, or a
change did not land. Ordinary content never earns it. If a new surface wants
the softer corner, ask whether it is actually interrupting, and if not, give
it the control radius.

Custom worlds may change the corner language, but must do so systemically. Pick
a small scale, apply it by component role, and keep touch targets and focus
outlines intact.

## Components

Components are restrained and quietly tactile. State comes from border tone,
background tone, text color, and direct movement—not ornamental elevation.

### Buttons

- **Primary:** Terracotta Spine fill, Clear Canvas text, compact corners, and a
  44px minimum height. Use for the one action that advances the current task.
- **Quiet:** raised surface, Fine Rule border, and normal ink. Use for reversible
  tools, toggles, and secondary actions.
- **Text:** underlined Quiet Graphite with no container. Use for low-emphasis
  local actions; do not use it where a 44px mobile target is required without
  a larger hit region.
- **Icon:** 44px square minimum, stable accessible name, and visible focus.

### Ruled book row

The signature library component is one continuous scanning row: cover, book
identity, progress, and last-read context. Rows are separated by Fine Rule and
gain only a quiet tonal hover state. They never become a grid of independent
cards as the library grows.

### Reader chrome and panels

Reader chrome carries back/library, book identity, Contents, Search, Study,
and Text. Pressed state uses the active theme accent. Panels have one header,
one scroll body, and a clear close path; mobile panels replace the reading
surface and restore focus when closed.

### Search

Search is a panel, not an overlay, so a result can be read against the book
beside it on desktop. Its distinctive part is that the index is slower than the
question: the panel therefore carries its own readiness in the header, as one
polite live-region line under the heading rather than a spinner or a modal
block. Every readiness state is a sentence a person can act on — preparing with
a section count, ready, ready with no text in this book, or paused with the
reason — and the form stays usable throughout, because a partial index still
answers.

Index lifecycle controls are text buttons, never primary ones. Resume indexing
and Pause indexing are the person's control over background work they did not
ask for; they must be visible whenever that work is running or stopped, and
must never compete with Search for emphasis.

Results are a ruled list, matching the library's ruled book row rather than
becoming cards. Each row is a full-width button of at least 44px: a micro-label
section title above, then the excerpt in the literary serif, clamped to four
lines so a long paragraph cannot push the next result off the panel. Hover
moves the row's text to the accent — the row itself does not gain a background,
because a list of book passages should read as book, not as menu.

### Study artifacts

Study content leads with the learning artifact and its source relationship.
Authoring controls are secondary disclosure. Agent-created work identifies its
origin and exposes the appropriate Return to source, Reset, Undo, or Delete
action.

Every study block renders natively and consumes semantic roles, so a
user-authored world restyles Study without touching its markup. The shipped
block vocabulary is quotation, prose, equation, steps, and question; a block
kind that cannot yet render meaningfully — an equation still shown as its raw
source — is a gap in the rendering, not permission to hand the surface a
foreign renderer or raw markup.

Composed teaching is a first-class lesson: a meaningful title establishes the
conceptual hierarchy, ordered blocks carry the progression, and shared source
and provenance appear once at lesson level. Standalone blocks remain useful as
quiet notes, but action-group metadata is never presented as if it were a
lesson. Expanded Study gives the lesson a centered reading measure and demotes
the book to reference; on compact screens Study becomes the full working
surface rather than compressing two columns.

**The Diagnostics Are Not Study Rule.** Raw agent telemetry — tool names, call
lists, counts, success and failure history — never appears in Study. Study is
the learner's material; a scrolling log of what a model did is a different
surface with a different audience, and putting it in the study viewport tells
the learner the machinery matters as much as the lesson. The only agent-facing
element Study may carry is a compact semantic status for guidance happening
right now, saying what is being explained and exposing Back and Stop. This is
an invariant. Observability must remain a separate diagnostics surface.

### Motion

State transitions use the current 180ms timing or stay within 150–250ms.
Motion communicates panel, paging, focus, and persistence state; it never
delays reading. Reduced motion removes nonessential travel while preserving an
immediate, understandable state change.

## Do's and Don'ts

### Do:

- **Do** treat the shipped themes as excellent examples of a semantic system,
  not as the only palettes Bookhand may support.
- **Do** define a complete token world before applying an agent-authored theme.
- **Do** preserve hierarchy, contrast, source grounding, user control, and a
  visible reset path when experimenting boldly.
- **Do** inspect customization on library, reader, panels, Study, mobile,
  desktop, error, focus, and reduced-motion states.
- **Do** let the artifact dominate Study and keep tool history in separate
  diagnostics.
- **Do** state background work honestly where it happens: name the readiness of
  a slow index in one calm live-region line, and keep the person's Pause and
  Resume visible the whole time it runs.
- **Do** use real book content and real product state in demonstrations.

### Don't:

- **Don't** turn Bookhand into a generic dashboard, chat transcript, card grid,
  fake bookshelf, or collection of equally weighted controls.
- **Don't** equate “bookish” with beige application chrome, parchment texture,
  paper grain, ornamental shadows, or nostalgic decoration.
- **Don't** apply dark or sepia only inside the EPUB while leaving the shell in
  another world.
- **Don't** let custom CSS, model text, diagrams, or labs escape their bounded
  rendering surfaces or silently rewrite publisher content.
- **Don't** hard-code the current terracotta palette into new study primitives;
  consume semantic tokens so user-created worlds remain coherent.
- **Don't** preserve a weak customization merely because an agent created it;
  preview, validate, revise, and keep Reset or Undo visible.
- **Don't** mark identity with a logo badge floating in a corner. Bookhand is
  named by the wordmark in the masthead and by the book artwork itself; a badge
  is product chrome asserting itself in an interface whose whole intent is to
  recede.
