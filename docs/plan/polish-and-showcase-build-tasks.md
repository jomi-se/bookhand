# Polish and showcase build tasks

Last updated: 2026-09-02

The active target manifest in `polish-and-showcase-mission.md` defines done.
W0 through W3 preserve the implemented trust, shared-state, and reader work.
The topology from W4 onward was reopened on 2026-09-02 after live ChatGPT
Desktop use and a formal Impeccable critique showed that Study still presents
records rather than lessons and that Bookhand lacks transient tutor guidance.
Two sequential independent reviews of the amended contracts and dependencies
were completed and incorporated on 2026-09-02; the W4-through-W11 topology is
now frozen.

## W0: browser-agent design context foundation — implemented 2026-09-02

Implemented baseline: the pre-amendment `VAL-AGENT-DESIGN-CONTEXT`. W4 solely
owns the active amended target.
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

That guidance-only digest was correct for the original W0 contract. The W4
amendment adds canonical live capability data to the digest and removes stale
hand-written capability prose; W0 is historical evidence, not a claim that the
amendment is already implemented.

Two things W0 could not fix were subsequently closed by W2:

- A tool style mutation did not reach React state, so the original design
  context read the adapter rather than the interface.
- The reading tools registered before `useReader` finished restoring style, so
  a mutation in that window could be overwritten. W2's shared command path and
  race coverage now own the resolved behavior.

- Add the compact versioned runtime design artifact and globally available
  `get_design_context`.
- Compose safe live library/reader/study state without returning book text, raw
  custom CSS, or user-authored values.
- Advertise the context from design-bearing mutation tools, record reads in
  separate diagnostics, and bind the runtime version to canonical design and
  capability sources.
- Compute the version from the exact marked canonical block in `DESIGN.md`; do
  not use a matching hand-written constant as the drift oracle.
- Report supported EPUB/Study scopes and the pending whole-application-world
  boundary truthfully while preserving explicit creative freedom.

## W1: source and persistence trust

Implemented baselines: `VAL-RANGE-OWNERSHIP`, the pre-amendment
`VAL-MATH-PASSAGE`,
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
  to the final header and test-control targets owned by W10.

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

## W4: runtime truth and canonical source lifecycle — implemented 2026-09-02

Targets: `VAL-AGENT-DESIGN-CONTEXT`, `VAL-WEBMCP-TOOL-CONTRACTS`, amended
`VAL-MATH-PASSAGE`, and `VAL-SOURCE-EXCERPT-LIFECYCLE`.
Depends on: W0 and W1.

- Remove the false design-context claim that Preview and Undo are unavailable;
  derive capability guidance and its version from canonical runtime truth.
- Make `open_book`, study-item, and reading-style schemas unambiguous and
  non-empty; preserve declared structured results through the real runtime.
- Close image-only, MathML `aria-label`, figure-only CFI, and mixed-math
  extraction gaps.
- Add versioned canonical source excerpts, source-derived quotation
  canonicalization, old-record refresh/stale state, and reindex semantics.

This wave prevents every later surface from
composing on contradictory capabilities or damaged source meaning.

Implemented with a canonical runtime capability manifest included in the
design-context digest; defensive handler validation because current Chromium
does not enforce WebMCP input schemas; concise text plus actionable structured
results; typed bounded source excerpts; additive schema-v3 migration and newer
schema refusal; dedicated legacy repair that does not create a learner edit or
revision; visible stale Retry/Relink; and one canonical source extraction
version from which W5 must derive index invalidation. Figure-only semantic CFI envelopes, mixed math, image-only
visible context, and MathML `aria-label` now have deterministic and real
Foliate fixture coverage. Genuine Chromium WebMCP coverage proves structured
success/refusal preservation. ADR 0004 records authored-text preservation and
non-destructive annotation/quotation deduplication.

Current Chromium strips the application’s non-standard `outputSchema` member
from `getTools()`. W4 records that upstream limitation rather than claiming
runtime discovery; application-side schema serialization and genuine
`structuredContent` preservation are both tested.

## W5: local lexical retrieval

Targets: `VAL-INDEX-LIFECYCLE` and `VAL-SEARCH-BOOK`.
Depends on: W4 canonical source excerpts.

- Add versioned, batch-transactional CFI chunks and synchronized FTS rows.
- Add cancellation/failure seams, committed-batch resume, and truthful states.
- Add bounded current-book `search_book` with structured results through
  genuine WebMCP and validate against the frozen two-book oracle.

## W6: shared navigation and tutor-session core

Targets: `VAL-TUTOR-SESSION-LIFECYCLE`, the navigation-only
`VAL-TUTOR-PASSAGE-FOCUS`, and `VAL-TUTOR-OVERLAY-ISOLATION`.
Depends on: W2 shared board state, W3 reader interaction, and W5 search.

- Route deliberate reader movement through one origin-aware controller.
- Add one non-persistent, revision-guarded tutor session with a single
  predictable origin target and anchored reading-position persistence.
- Register navigation-only `focus_passage` and `control_guidance`; implement the
  attributed guiding/yielded indicator, Back, Stop, manual-takeover, book-close,
  detach, opening-race, and reload semantics.
- Spike and select a transient overlay path that cannot replace a permanent
  annotation at the same CFI.

## W7: cohesive durable study domain

Targets: `VAL-STUDY-SCHEMA-SECURITY`, `VAL-STUDY-MATH-RENDERING`,
`VAL-INTERACTIVE-PLOT`, `VAL-STUDY-EXPERIENCE-LIFECYCLE`, and
`VAL-STUDY-SAFE-REMOVAL`.
Depends on: W4 amended design context/source lifecycle, W6 shared navigation, and
the existing W1 ownership/provenance primitives.

- Add a first-class titled experience with ordered blocks, shared/differing
  sources, annotation references, revision, provenance, and one atomic action.
- Implement strict accessible math, the frozen native block vocabulary, and
  safe declarative plot; consume semantic theme roles.
- Add atomic create/update, structured receipts, source navigation, Undo,
  Reset, and recoverable removal without treating `actionGroupId` as hierarchy.
- Validate slope, non-slope, damaged-source, and hostile fixtures.

## W8: Study workspace composition and recovery

Targets: `VAL-STUDY-COMPOSITION-HIERARCHY`,
`VAL-AGENT-ACTIVITY-PRESENTATION`, `VAL-STUDY-WORKSPACE-RESPONSIVE`, and
`VAL-STUDY-LOAD-RECOVERY`.
Depends on: W7 and W3 theme/layout primitives.

- Remove all raw activity/log UI from Study and move it to a separate bounded
  diagnostics surface.
- Make lesson title and conceptual sequence outrank storage types; collapse
  shared sources and keep annotations as a compact index/reference.
- Put existing learning content before authoring; provide one clear manual
  create path with additional content kinds progressively disclosed so Study
  remains fully useful without an agent.
- Give docked desktop, expanded desktop, and focused mobile genuinely different
  compositions while preserving source context and focus lifecycle.
- Render initial-load and every mutation-family failure with bounded recovery.
- Run a formal two-pass Impeccable critique on stable deployed desktop and
  phone-size surfaces and preserve the scored evidence.

## W9: embodied tutor interactions

Targets: `VAL-TUTOR-PASSAGE-CUE`, `VAL-TUTOR-STUDY-REVEAL`, and
`VAL-TUTOR-PRESENTATION-SAFETY`.
Depends on: W5 search, W6 session core, W7 stable lesson IDs, and W8 stable
study destinations.

- Extend `focus_passage` with transient cue presentation and register
  `reveal_study_item` and `present_explanation` through the shared commands and
  genuine WebMCP runtime.
- Prove exact source focus, permanent-highlight coexistence, semantic status,
  meaningful target focus, bounded inert explanations, Back, Stop, takeover,
  and zero persistence.

## W10: combined real-model hero and evidence closure

Targets: `VAL-HERO-MODEL-RUN`, `VAL-GATE-STABILITY`,
`VAL-DEPLOYED-RUNTIME-TRUTH`, `VAL-DEPLOYMENT-HEADERS`,
`VAL-DOCUMENTATION-TRUTH`, and `VAL-TEST-CONTROL-INTEGRITY`.
Depends on: W0 through W9 and owner access to the compatible ChatGPT Desktop
agent surface.

- Deploy an identified commit and assert the exact canonical tool manifest.
- Run one intent-only sequence: context, search, focus, temporary explanation,
  Back/Stop, opt-in durable lesson, reveal, follow-up update, and reload.
- Preserve the independently witnessed transcript, runtime trace, visible
  result, bounded failure, persistence, and transient-state disappearance.
- Close repeated gate stability, deployed headers, documentation truth, and
  production exclusion scans for every new fault seam.

## W11: does the agent actually compose anything good?

Target: `VAL-COMPOSITION-QUALITY`.
Depends on: W10's deployed real-model access.

- Freeze at least twelve intent-only prompts across at least three chapters.
- Score product-verified grounding, design discovery, first-attempt schema
  validity, and completion.
- Record a separate human qualitative read without pretending the composing
  model can grade itself.
- Report the worst outputs beside the best; a success-only table is marketing.

## Review and integration rules

- Keep each target independently reviewable; do not use a broad test pass to
  conceal a failed contract.
- Preserve the green Slice 3 checkpoint while W4/W5 are incomplete.
- Integrate in dependency order. A later wave may prototype behind domain
  types, but it may not weaken an earlier trust boundary to proceed.
- Run focused checks while editing and `npm run verify` at each completed wave.
