# Scope inventory

## Present now

- A working local-first library and Foliate.js EPUB reader with official SQLite
  WASM persistence, bundled-book bootstrap, import, navigation, selection,
  presentation controls, and restore.
- Persistent highlights, notes, one board per book, docked/expanded Study, and
  native prose, quotation, equation, steps, and question items.
- Thirteen dynamically registered tools through Chromium's genuine
  `document.modelContext`: library/open, reading context/TOC/passage/navigation,
  lexical search, annotation/style, and study item/view operations.
- A deployed Cloudflare Worker surface and a production browser/live-check
  harness. The WebMCP agent test is deterministic orchestration, not yet a
  genuine model-authored lesson run.
- Shared Codex and Claude guidance, validation contracts, reusable engineering
  and design skills, and persistent handoff documentation.

## Slice 1: the book is usable

Each identifier maps to the named validation contract under
`docs/contracts/slice-1/`.

- `S1-LIBRARY-BOOTSTRAP` -> `VAL-LIBRARY-BOOTSTRAP`: library-first entry,
  temporary bundled judging book, and a real empty state after removal.
- `S1-LIBRARY-IMPORT` -> `VAL-LIBRARY-IMPORT`: local EPUB picker, validation,
  deterministic identity, deduplication, and recoverable failures.
- `S1-LIBRARY-CATALOG` -> `VAL-LIBRARY-CATALOG`: truthful ruled rows,
  continue-reading state, loading/recovery, and local-storage status.
- `S1-READER-ENGINE` -> `VAL-READER-ENGINE`: commit-pinned upstream Foliate.js
  behind `ReaderAdapter`, rendering real EPUB content and resources.
- `S1-READER-ADAPTER` -> `VAL-READER-ADAPTER-CONTRACT`: serializable metadata,
  TOC, location, passage, section, and selection snapshots without viewer DOM
  leakage.
- `S1-READER-NAV` -> `VAL-READER-OPEN`, `VAL-READER-NAV`, and
  `VAL-READER-SECTION-ERROR`: bounded open, relative/TOC/CFI navigation, and
  recoverable section failure.
- `S1-READER-SELECTION` -> `VAL-READER-SELECTION`: exact quote, CFI range,
  fingerprint, and desktop selection. Physical-phone long-press remains
  best-effort and non-gating under ADR 0003.
- `S1-STORAGE` -> `VAL-STORAGE-BACKEND`, `VAL-STORAGE-ROUNDTRIP`,
  `VAL-STORAGE-FALLBACK`, `VAL-STORAGE-LOCK`, and
  `VAL-STORAGE-PERSISTENCE-REQUEST`: official SQLite WASM, dedicated-worker
  ownership, OPFS persistence, persistence request, session-only fallback, and
  explicit second-tab behavior.
- `S1-READER-RESTORE` -> `VAL-READER-RESTORE`: restore source passage and style
  after reload and tab reopen.
- `S1-READER-STYLE` -> `VAL-READER-STYLE` and `VAL-CUSTOM-CSS-SAFETY`:
  reversible typography/theme controls and bounded custom CSS.
- `S1-EPUB-SECURITY` -> `VAL-EPUB-CONTAINMENT` and
  `VAL-EPUB-RESOURCE-POLICY`: untrusted-book containment and explicit resource
  policy.
- `S1-LOCAL-FIRST` -> `VAL-LOCAL-FIRST`: core reading works without backend,
  model, upload, or non-origin request.
- `S1-DESIGN` -> `VAL-DESIGN-DIRECTION`, `VAL-READER-SHELL`,
  `VAL-READER-RESPONSIVE`, and `VAL-READER-ACCESSIBILITY`: approved
  quiet-catalog identity, visible reader chrome, responsive structure,
  keyboard/accessibility, and resilient content.
- `S1-PIXEL7` -> `VAL-DEVICE-PIXEL7`: accepted non-gating real Android Chrome
  flow and background/resume evidence under ADR 0003.
- `S1-READER-LIFECYCLE` -> `VAL-READER-LIFECYCLE`: StrictMode, repeated open,
  racing open, and listener/viewer cleanup.
- `S1-TEST-INTEGRITY` -> `VAL-TEST-CONTROL-INTEGRITY`: production builds cannot
  enable validation-only failures or raw diagnostics.
- `S1-STUDY-SHELL` -> superseded historical `VAL-STUDY-SHELL`; Slice 2's
  persistent board replaces it.

Desktop Chromium is the gating compatibility target. Physical Pixel 7 Chrome
is best-effort and non-gating under ADR 0003. Cross-browser parity is deferred
for the hackathon proof of concept.

## Implemented later slices

- Slice 2: highlights, notes, persistent boards, native study blocks, docked
  and expanded board modes, and return-to-source navigation.
- Slice 3: real WebMCP tools for library access, context, navigation,
  annotation, presentation, and study-board construction; first credible
  submission checkpoint.
- Slice 4 lexical milestone: local FTS5 indexing, lifecycle truth, ordinary
  Search, and current-book `search_book` with exact citations.

## Active polish and showcase mission

Atomic inventory IDs map to contracts as follows:

- `P-TRUST-RANGE` -> `VAL-RANGE-OWNERSHIP`
- `P-TRUST-MATH` -> `VAL-MATH-PASSAGE`
- `P-SOURCE-EXCERPT` -> `VAL-SOURCE-EXCERPT-LIFECYCLE`
- `P-TRUST-STYLE` -> `VAL-STYLE-PARITY`
- `P-TRUST-BOARD` -> `VAL-BOARD-VIEW-PARITY`
- `P-TRUST-DURABLE` -> `VAL-DURABLE-STORAGE-REQUEST`
- `P-TRUST-ITEM-ID` -> `VAL-STUDY-ID-OWNERSHIP`
- `P-TRUST-UNDO` -> `VAL-ACTION-PROVENANCE-UNDO`
- `P-TRUST-ERRORS` -> `VAL-MUTATION-ERRORS`
- `P-DEPLOY-HEADERS` -> `VAL-DEPLOYMENT-HEADERS`
- `P-MOBILE-THEME` -> `VAL-MOBILE-THEME`
- `P-MOBILE-CHROME` -> `VAL-MOBILE-CHROME`
- `P-MOBILE-GESTURES` -> `VAL-MOBILE-GESTURES`
- `P-MOBILE-PANELS` -> `VAL-MOBILE-PANELS`
- `P-MOBILE-A11Y` -> `VAL-MOBILE-ACCESSIBILITY`
- `P-DESKTOP-READER` -> `VAL-DESKTOP-READER`
- `P-LEGACY-STYLE` -> reactivated `VAL-READER-STYLE`
- `P-LEGACY-RESPONSIVE` -> reactivated `VAL-READER-RESPONSIVE`
- `P-LEGACY-A11Y` -> reactivated `VAL-READER-ACCESSIBILITY`
- `P-LEGACY-SELECTION` -> amended and reactivated `VAL-READER-SELECTION`
- `P-INDEX-LIFECYCLE` -> `VAL-INDEX-LIFECYCLE`
- `P-SEARCH` -> `VAL-SEARCH-BOOK`
- `P-AGENT-DESIGN-DISCOVERY` and `P-AGENT-DESIGN-CONTEXT` ->
  `VAL-AGENT-DESIGN-CONTEXT`: browser-only discovery of bounded, versioned,
  page-owned semantic design guidance and live surface state.
- `P-AGENT-CUSTOMIZATION-SAFETY` -> `VAL-AGENT-DESIGN-CONTEXT` plus
  `VAL-STYLE-PARITY`: context-version checks for expressive style changes,
  truthful scope/warnings, Preview/Apply, persistence, provenance, Undo, and
  Reset. Whole-application custom worlds additionally require the ADR named in
  `docs/plan/agent-facing-design-guidance.md` before entering active scope.
- `P-AGENT-STUDY-COMPOSITION` -> `VAL-AGENT-DESIGN-CONTEXT`,
  `VAL-STUDY-SCHEMA-SECURITY`, and `VAL-STUDY-EXPERIENCE-LIFECYCLE`: agents
  receive source-first composition guidance while native renderers consume the
  active semantic roles.
- `P-STUDY-SECURITY` -> `VAL-STUDY-SCHEMA-SECURITY`
- `P-STUDY-PLOT` -> `VAL-INTERACTIVE-PLOT`
- `P-STUDY-LIFECYCLE` -> `VAL-STUDY-EXPERIENCE-LIFECYCLE`
- `P-STUDY-MATH` -> `VAL-STUDY-MATH-RENDERING`
- `P-STUDY-HIERARCHY` -> `VAL-STUDY-COMPOSITION-HIERARCHY`
- `P-AGENT-OBSERVABILITY` -> `VAL-AGENT-ACTIVITY-PRESENTATION`
- `P-STUDY-WORKSPACE` -> `VAL-STUDY-WORKSPACE-RESPONSIVE`
- `P-STUDY-REMOVAL` -> `VAL-STUDY-SAFE-REMOVAL`
- `P-STUDY-RECOVERY` -> `VAL-STUDY-LOAD-RECOVERY`
- `P-WEBMCP-CONTRACTS` -> `VAL-WEBMCP-TOOL-CONTRACTS`
- `P-TUTOR-SESSION` -> `VAL-TUTOR-SESSION-LIFECYCLE`
- `P-TUTOR-FOCUS` -> `VAL-TUTOR-PASSAGE-FOCUS`,
  `VAL-TUTOR-OVERLAY-ISOLATION`, `VAL-TUTOR-PASSAGE-CUE`
- `P-TUTOR-REVEAL` -> `VAL-TUTOR-STUDY-REVEAL`
- `P-TUTOR-PRESENT` -> `VAL-TUTOR-PRESENTATION-SAFETY`
- `P-HERO-MODEL` -> `VAL-HERO-MODEL-RUN`
- `P-COMPOSITION-QUALITY` -> `VAL-COMPOSITION-QUALITY`
- `P-EVIDENCE-GATE` -> `VAL-GATE-STABILITY`
- `P-EVIDENCE-LIVE` -> `VAL-DEPLOYED-RUNTIME-TRUTH`
- `P-EVIDENCE-DOCS` -> `VAL-DOCUMENTATION-TRUTH`
- `P-EVIDENCE-CONTROLS` -> reactivated `VAL-TEST-CONTROL-INTEGRITY` for all
  new fault seams.

The mission boundary, legacy assertion manifest, device exception, and cut line
are in `docs/plan/polish-and-showcase-mission.md`.

The runtime delivery shape and the explicit boundary between EPUB CSS, native
Study rendering, and future application-shell worlds are in
`docs/plan/agent-facing-design-guidance.md`.

## Unbuilt slices and options

- Remaining Slice 4 option: local embeddings, packed vector BLOBs, exact
  semantic scan, and hybrid retrieval. Lexical retrieval must earn this cost.
- Slice 5: bounded generated labs and the polished end-to-end tutor scenario.

## Deferred

- Agent Connect integration.
- `sqlite-vec`, approximate-nearest-neighbor infrastructure, hosted embeddings,
  multiple embedding models, and library-wide semantic search.
- Accounts, cloud storage, cross-device sync, and collaboration.
- General ebook-library management and format coverage beyond the demo needs.
- A broad plugin or extension ecosystem.
