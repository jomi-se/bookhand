# Polish and showcase build tasks

Last updated: 2026-09-02

The active target manifest in `polish-and-showcase-mission.md` defines done.
This file freezes implementation ownership after five sequential contract
reviews; it does not weaken or merge their assertions.

## W1: source and persistence trust

Targets: `VAL-RANGE-OWNERSHIP`, `VAL-MATH-PASSAGE`,
`VAL-DURABLE-STORAGE-REQUEST`, `VAL-STUDY-ID-OWNERSHIP`,
`VAL-ACTION-PROVENANCE-UNDO`, `VAL-MUTATION-ERRORS`,
`VAL-DEPLOYMENT-HEADERS`, and `VAL-TEST-CONTROL-INTEGRITY`.

- Enforce current-book range, fingerprint, and normalized-quote ownership at
  the command boundary.
- Make exact/visible passage extraction preserve inline math and figure text.
- Connect the one-time persistence request to real import.
- Add explicit study-item origin/update tokens, scoped idempotency, and
  cross-book/agent-to-user rejection.
- Add provenance/action groups and bounded visible failures for existing
  mutations.
- Remove COOP and extend production fault-seam exclusion.

## W2: one observable mutation surface

Targets: `VAL-STYLE-PARITY` and `VAL-BOARD-VIEW-PARITY`.
Depends on: W1 error/provenance primitives.

- Route interface and tool style mutations through one React-visible,
  persisted command path with prior state, Undo, and Reset.
- Implement docked, expanded, focus, and close board modes through the same
  observable path, with persistent preference separated from visible state.
- Prove stale-control and reload races.

## W3: reader interaction reset

Targets: `VAL-MOBILE-THEME`, `VAL-MOBILE-CHROME`,
`VAL-MOBILE-GESTURES`, `VAL-MOBILE-PANELS`,
`VAL-MOBILE-ACCESSIBILITY`, `VAL-DESKTOP-READER`, and the reactivated legacy
reader contracts.
Depends on: W2 shared style/view state.

- Apply full-shell reader themes with measured contrast.
- Replace mobile side rails with the specified tap zones and receding chrome.
- Own pagination gesture intent above Foliate without breaking selection.
- Recompose mobile panels and focus lifecycle; expose current TOC state and
  stable names/targets.
- Preserve the disciplined desktop docked/expanded workspace.
- Add the mobile/desktop/zoom/safe-area browser evidence matrix.

## W4: local lexical retrieval

Targets: `VAL-INDEX-LIFECYCLE`, `VAL-SEARCH-BOOK`, and
`VAL-TEST-CONTROL-INTEGRITY`.
Depends on: W1 math-faithful passage extraction.

- Add versioned, batch-transactional CFI chunks and synchronized FTS rows.
- Add cancellation/failure seams, committed-batch resume, and truthful states.
- Add bounded current-book `search_book` through genuine WebMCP.
- Validate against the frozen two-book oracle without production shortcuts.

## W5: cohesive native study experience

Targets: `VAL-STUDY-SCHEMA-SECURITY`, `VAL-INTERACTIVE-PLOT`,
`VAL-STUDY-EXPERIENCE-LIFECYCLE`, and `VAL-TEST-CONTROL-INTEGRITY`.
Depends on: W1 ownership/provenance and W3 theme/layout primitives.

- Implement the frozen generic block vocabulary and safe declarative math AST.
- Render accessible native content, locked-down Mermaid, and the interactive
  plot without executable caller expressions.
- Add atomic create/update, provenance, action groups, Undo/Reset/Delete,
  reversible source jumps, persistence, and failure recovery.
- Validate slope, non-slope, and hostile fixtures before hero composition.

## W6: real-model hero and evidence closure

Targets: `VAL-HERO-MODEL-RUN`, `VAL-GATE-STABILITY`,
`VAL-DEPLOYED-RUNTIME-TRUTH`, and `VAL-DOCUMENTATION-TRUTH`.
Depends on: W1 through W5 and owner access to the compatible ChatGPT desktop
agent surface.

- Deploy an identified commit and assert the exact dynamic tool sets.
- Run the intent-only Chapter X request and follow-up through a named real
  model, preserving the independently witnessed transcript and runtime trace.
- Close three-run gate stability, live sentinel persistence, deployed headers,
  source-of-truth updates, and final visual evidence.

## Review and integration rules

- Keep each target independently reviewable; do not use a broad test pass to
  conceal a failed contract.
- Preserve the green Slice 3 checkpoint while W4/W5 are incomplete.
- Integrate in dependency order. A later wave may prototype behind domain
  types, but it may not weaken an earlier trust boundary to proceed.
- Run focused checks while editing and `npm run verify` at each completed wave.

