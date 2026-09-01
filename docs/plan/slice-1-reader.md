# Slice 1 mission: the book is usable

Last updated: 2026-09-01

## Mission boundary

Deliver a production-quality local library and EPUB reader on desktop Chromium
and Pixel 7-class mobile. A person can open the bundled *Calculus Made Easy* or
import an EPUB, navigate its structure, select exact text, restore position,
and customize presentation without an agent or network service.

This slice establishes the library, reader, persistence, and design boundaries
needed by later study-board and WebMCP slices. It does not implement highlights,
notes, durable study items, agent tools, whole-book search, embeddings, or
generated labs.

## Accepted product decisions

- The app starts in a library, not directly in the bundled book.
- *Calculus Made Easy* is included for the judging period and can later be
  removed without changing the library or empty-state model.
- The approved visual system and responsive behavior live in `DESIGN.md`.
- Study is visible as a quiet shell/affordance, but study content belongs to
  Slice 2.
- Use a full-commit-pinned official Foliate.js source dependency behind
  `ReaderAdapter`; do not depend on the unrelated npm release with the same
  name.
- SQLite WASM remains the sole persistent application store. Slice 1 implements
  the minimum `books` and `readingState` path instead of using `localStorage`.
- Imported EPUBs are untrusted. A script-blocking CSP and a malicious-book
  fixture are part of the slice, not deferred hardening.

## Capability inventory

### Library

- Bundled-book bootstrap with provenance and a future clean removal path.
- Local EPUB import, validation, deterministic content hashing, and visible
  corrupt/unsupported-file recovery.
- Continue-reading state and an all-books ruled list.
- Empty, loading, import-success, import-failure, persistence-warning, and
  second-tab-lock states.

### Reader adapter and content

- Idempotent open/close under React StrictMode and protection from stale async
  opens.
- Serializable metadata, nested TOC, location, visible context, selection, and
  passage snapshots; no DOM or iframe objects escape the adapter.
- Previous/next, TOC, and CFI navigation.
- Exact quote plus range/start/end CFI, section index, and text fingerprint for
  selections; CFI round trips are checked before persistence.
- Bounded errors when a section fails to load.

### Persistence

- Official SQLite WASM in one dedicated worker with `opfs-sahpool` and an
  explicit typed request protocol.
- Book bytes/metadata, last location, and reader style stored after meaningful
  transitions.
- Restored style applied before restored location so pagination remains stable.
- Visible session-only in-memory fallback when OPFS is unavailable.
- Explicit second-tab lock with Retry; never a silent shadow library.

### Presentation and interaction

- Approved library and reader composition on desktop and mobile.
- Nested TOC drawer/sheet, previous/next controls, and readable progress.
- Font size, measure, line height/spacing, theme, custom CSS preview/apply, and
  one-action reset.
- Study shell and `Study this` affordance without later-slice persistence.
- Keyboard navigation, visible focus, 44px touch targets, safe-area handling,
  reduced motion, 200 percent zoom, long metadata, and no app-shell overflow.

### Security

- CSP blocks EPUB script execution and disallowed remote resource exfiltration
  while permitting required local blob images, fonts, and styles.
- Book content cannot access application storage, parent DOM capabilities, or
  WebMCP.
- Custom CSS is bounded so `url()` cannot become a remote exfiltration path.

## Validation floor

- Focused tests for adapter lifecycle, metadata flattening, selection CFI
  round-trip/fingerprint mismatch, navigation, style reset, and typed worker
  requests.
- Real official SQLite WASM integration tests for schema, OPFS/in-memory open,
  book and reading-state round trips, and second-tab behavior.
- Browser evidence for library import, bundled-book open, TOC navigation,
  selection, style changes, reload restoration, security fixture, error states,
  console/network cleanliness, desktop, 320px, Pixel viewport, and 200% zoom.
- Physical Pixel 7 evidence is required before claiming Slice 1 complete on the
  target phone. Desktop implementation may land while that device check is
  pending.

## Reproducible validation controls

- `tiny-book.epub`: Bookhand-authored deterministic EPUB with nested TOC,
  selectable prose, SVG/MathML alternatives, long metadata, and known CFIs.
- `malicious-book.epub`: explicit sentinels for script, parent mutation,
  storage, popup/top navigation, form, nested browsing, fetch, image, font, and
  CSS exfiltration attempts against a controlled intercepted origin.
- Database worker diagnostics expose mode, SQLite version, VFS name, schema,
  and a test-only state dump without bypassing the worker boundary.
- Test-only dependency injection can force OPFS initialization failure, delay a
  stale open, leave one book open unresolved, leave one library-list request
  unresolved, fail one library-list request immediately, and fail one section
  load. These controls are unavailable in the production build.
- The deterministic library load deadline is five seconds and the deterministic
  book-open deadline is ten seconds. Injected unresolved operations must reach
  their visible recovery state by those deadlines; tests may advance a shared
  clock rather than waiting in real time.
- A two-tab Playwright flow holds and releases the sahpool owner so Retry is
  proven after the first tab closes.
- Network validation blocks and counts every non-origin request after the app
  shell and fixtures are available.
- Pixel 7 evidence records device/Chrome versions and source-location state
  before and after reload plus 30-second background/resume.
- Production bundles expose none of the fault-injection or raw-state-dump
  controls; validation must prove that boundary rather than trusting a build
  flag by convention.

## Work topology

1. Fixtures, dependencies, security policy, domain types, and test harness.
2. Database worker and persistent library/reading-state client.
3. Reader adapter and deterministic adapter tests.
4. Library and responsive reader UI, presentation controls, and study shell.
5. Integrated browser flows, visual iteration, and independent validation.
