# Scope inventory

## Present now

- React, TypeScript, and Vite application scaffold.
- Shared Codex and Claude repository instructions.
- Project-scoped Playwright and Devpost MCP declarations.
- Reusable engineering, browser, review, validation, and Impeccable skills.
- Persistent documentation and handoff structure.

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
  fingerprint, and desktop plus physical-phone selection.
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
- `S1-PIXEL7` -> `VAL-DEVICE-PIXEL7`: real Android Chrome reader flow and
  background/resume evidence.
- `S1-READER-LIFECYCLE` -> `VAL-READER-LIFECYCLE`: StrictMode, repeated open,
  racing open, and listener/viewer cleanup.
- `S1-TEST-INTEGRITY` -> `VAL-TEST-CONTROL-INTEGRITY`: production builds cannot
  enable validation-only failures or raw diagnostics.
- `S1-STUDY-SHELL` -> `VAL-STUDY-SHELL`: honest, non-persistent preview of the
  later study surface while preserving source location.

Slice 1 compatibility targets are desktop Chromium and physical Pixel 7
Chrome. Cross-browser parity is deferred for the hackathon proof of concept.

## Later slices

- Slice 2: highlights, notes, persistent boards, native study blocks, docked and
  expanded board modes, and return-to-source navigation.
- Slice 3: WebMCP tools for context, navigation, annotation, presentation, and
  study-board construction; first credible submission checkpoint.
- Slice 4: FTS5 lexical search, optional local embeddings, packed vector BLOBs,
  exact semantic scan, hybrid retrieval, and retrieval WebMCP tools.
- Slice 5: bounded generated labs and the polished end-to-end tutor scenario.

## Deferred

- Agent Connect integration.
- `sqlite-vec`, approximate-nearest-neighbor infrastructure, hosted embeddings,
  multiple embedding models, and library-wide semantic search.
- Accounts, cloud storage, cross-device sync, and collaboration.
- General ebook-library management and format coverage beyond the demo needs.
- A broad plugin or extension ecosystem.
