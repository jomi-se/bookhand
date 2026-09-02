# Polish and showcase build tasks

Last updated: 2026-09-02

The active target manifest in `polish-and-showcase-mission.md` defines done.
The original topology was frozen after five sequential contract reviews. It
was reopened on 2026-09-02 only to incorporate the newly identified
browser-agent design-context requirement. Three sequential review rounds
resolved the amended contract and ownership issues, and a final clean
verification passed; this topology is frozen again.

## W0: browser-agent design context foundation — implemented 2026-09-02

Targets: `VAL-AGENT-DESIGN-CONTEXT`.
Depends on: none.

Implemented as `get_design_context`, registered from first load beside the
library tools. The guidance half is frozen into the bundle at build time by
`scripts/vite-design-context-plugin.mjs`, which reads the marked block in
`DESIGN.md`; the version is a SHA-256 of exactly those bytes, and both the unit
test and the browser test recompute it independently rather than importing the
build helper. Live state is read at call time through `src/app/design-state.ts`
so a style change does not re-register the tool set. Evidence:
`tests/unit/webmcp-design-context.test.ts` and
`tests/e2e/webmcp-design-context.spec.ts`, the latter through genuine
`document.modelContext`.

Two things W0 could not fix and left for their owning waves:

- A tool style mutation does not reach React state, so the design context reads
  the adapter rather than the interface. W2 (`VAL-STYLE-PARITY`) owns closing
  that; until it does, the two paths agree only because W0 reads the lower one.
- The reading tools register as soon as the study board exists, which is before
  `useReader` has finished restoring the stored style. A style mutation landing
  in that window is silently overwritten by the restore. W2 owns the shared
  command path where this becomes fixable; the browser test documents the race
  by waiting the reader out.

- Add the compact versioned runtime design artifact and globally available
  `get_design_context`.
- Compose safe live library/reader/study state without returning book text, raw
  custom CSS, or user-authored values.
- Advertise the context from design-bearing mutation tools, record reads in
  Agent Activity, and bind the runtime version to the canonical design source.
- Compute the version from the exact marked canonical block in `DESIGN.md`; do
  not use a matching hand-written constant as the drift oracle.
- Report supported EPUB/Study scopes and the pending whole-application-world
  boundary truthfully while preserving explicit creative freedom.

## W1: source and persistence trust

Targets: `VAL-RANGE-OWNERSHIP`, `VAL-MATH-PASSAGE`,
`VAL-DURABLE-STORAGE-REQUEST`, `VAL-STUDY-ID-OWNERSHIP`,
`VAL-ACTION-PROVENANCE-UNDO`, and `VAL-MUTATION-ERRORS`.

`VAL-RANGE-OWNERSHIP` implemented 2026-09-02. `save_annotation` and any study
item carrying a `sourceRange` must state the `bookId` and the exact quote;
`BookhandCommands` resolves the range against the open book and rejects
wrong-book, stale-range, stale-fingerprint, partial-quote, and invented-quote
before attempting any write. `tests/unit/source-verification.test.ts`
re-derives the contract's normalization independently of the implementation.

`VAL-STUDY-ID-OWNERSHIP`, `VAL-ACTION-PROVENANCE-UNDO`, `VAL-MUTATION-ERRORS`,
and `VAL-DURABLE-STORAGE-REQUEST` implemented 2026-09-02. Schema version 2 with
an in-place migration; ownership decided inside one repository transaction;
agent create/revise with a one-time update token and no delete; retry
idempotency scoped to book, origin, token, operation, and stated payload; undo
guarded by expected revision; receipts returned to both callers; provenance
mark, Undo control, and a bounded retryable error in the study board.

One durable lesson from that work: deciding what a person sees by testing
`instanceof` passes every unit test and silently fails in the product, because
these errors cross a worker boundary that keeps only code, message, and
retryable. The person's wording now lives in the Error's own message.

`VAL-MATH-PASSAGE` implemented 2026-09-02. Passages are serialized rather than
concatenated, preferring `data-tex`, then MathML `alttext`/TeX annotation, then
image `alt`, then SVG title and description, each replacing its element so
nothing is stated twice. This mattered more than expected: the bundled book has
no MathML, so every passage previously reached agents with the mathematics
removed. Chapter X now reads with `\dfrac{dy}{d x}` intact through the genuine
WebMCP runtime.

- Enforce current-book range, fingerprint, and normalized-quote ownership at
  the command boundary.
- Make exact/visible passage extraction preserve inline math and figure text.
- Connect the one-time persistence request to real import.
- Add explicit study-item origin/update tokens, scoped idempotency, and
  cross-book/agent-to-user rejection.
- Add provenance/action groups and bounded visible failures for existing
  mutations.
- Return the contracted prior/applied/scope/warnings/persistence/reversal
  receipt for native study-item mutations.
- Remove COOP, then contribute deployed-header evidence and the W1 fault seams
  to the final header and test-control targets owned by W6.

## W2: one observable mutation surface

Targets: `VAL-STYLE-PARITY` and `VAL-BOARD-VIEW-PARITY`.
Depends on: W0 design context and W1 error/provenance primitives.

- Route interface and tool style mutations through one React-visible,
  persisted command path with prior state, Undo, and Reset.
- Implement docked, expanded, focus, and close board modes through the same
  observable path, with persistent preference separated from visible state.
- Prove stale-control and reload races.

## W3: reader interaction reset

Targets: `VAL-MOBILE-THEME`, `VAL-MOBILE-CHROME`,
`VAL-MOBILE-GESTURES`, `VAL-MOBILE-PANELS`,
`VAL-MOBILE-ACCESSIBILITY`, `VAL-DESKTOP-READER`, `VAL-READER-STYLE`,
`VAL-READER-RESPONSIVE`, `VAL-READER-ACCESSIBILITY`, and
`VAL-READER-SELECTION`.
Depends on: W2 shared style/view state.

- Apply full-shell reader themes with measured contrast.
- Replace mobile side rails with the specified tap zones and receding chrome.
- Own pagination gesture intent above Foliate without breaking selection.
- Recompose mobile panels and focus lifecycle; expose current TOC state and
  stable names/targets.
- Preserve the disciplined desktop docked/expanded workspace.
- Add the mobile/desktop/zoom/safe-area browser evidence matrix.

## W4: local lexical retrieval

Targets: `VAL-INDEX-LIFECYCLE` and `VAL-SEARCH-BOOK`.
Depends on: W1 math-faithful passage extraction.

- Add versioned, batch-transactional CFI chunks and synchronized FTS rows.
- Add cancellation/failure seams, committed-batch resume, and truthful states.
- Add bounded current-book `search_book` through genuine WebMCP.
- Validate against the frozen two-book oracle without production shortcuts.
- Contribute indexing fault seams to the final production test-control
  exclusion scan owned by W6.

## W5: cohesive native study experience

Targets: `VAL-STUDY-SCHEMA-SECURITY`, `VAL-INTERACTIVE-PLOT`, and
`VAL-STUDY-EXPERIENCE-LIFECYCLE`.
Depends on: W0 design context, W1 ownership/provenance, and W3 theme/layout
primitives.

- Implement the frozen generic block vocabulary and safe declarative math AST.
- Render accessible native content, locked-down Mermaid, and the interactive
  plot without executable caller expressions; all consume semantic theme
  roles rather than hard-coded shipped colors.
- Add atomic create/update, provenance, action groups, Undo/Reset/Delete,
  reversible source jumps, persistence, context-version checks, design
  receipts, and failure recovery.
- Validate slope, non-slope, and hostile fixtures before hero composition.
- Contribute experience fault seams to the final production test-control
  exclusion scan owned by W6.

## W6: real-model hero and evidence closure

Targets: `VAL-HERO-MODEL-RUN`, `VAL-GATE-STABILITY`,
`VAL-DEPLOYED-RUNTIME-TRUTH`, `VAL-DEPLOYMENT-HEADERS`,
`VAL-DOCUMENTATION-TRUTH`, and `VAL-TEST-CONTROL-INTEGRITY`.
Depends on: W0 through W5 and owner access to the compatible ChatGPT desktop
agent surface.

- Deploy an identified commit and assert the exact dynamic tool sets.
- Run the intent-only Chapter X request and follow-up through a named real
  model, preserving the independently witnessed transcript and runtime trace;
  the model discovers and calls `get_design_context` before composition.
- Close three-run gate stability, live sentinel persistence, deployed headers,
  source-of-truth updates, and final visual evidence.
- Own the final production scan proving that W1, W4, and W5 fault seams are
  unreachable from shipped UI, WebMCP, messages, and bundles.

## W7: does the agent actually compose anything good?

Target: `VAL-COMPOSITION-QUALITY`.
Depends on: W5, and on W6's real-model access.

Added 2026-09-02, after the owner observed that no wave in this mission measures
whether a frontier model, given these affordances, produces study surfaces worth
having. W6 proves a real model originated the calls and did not replay a
fixture. It does not ask whether the result was any good, and it would pass on a
lesson nobody would want to read.

- Freeze at least twelve intent-only prompts across at least three chapters.
- Run them against the deployed build through a named model and version.
- Score grounding by the product's own source rejections, plus design-context
  discovery, first-attempt schema validity, and completion.
- Report the worst outputs beside the best; a table of successes is marketing.

This is the measure that answers the project's actual question. It cannot run
before W5, because an eval of a surface that does not exist measures nothing.

## Review and integration rules

- Keep each target independently reviewable; do not use a broad test pass to
  conceal a failed contract.
- Preserve the green Slice 3 checkpoint while W4/W5 are incomplete.
- Integrate in dependency order. A later wave may prototype behind domain
  types, but it may not weaken an earlier trust boundary to proceed.
- Run focused checks while editing and `npm run verify` at each completed wave.
