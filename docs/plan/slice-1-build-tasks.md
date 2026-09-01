# Slice 1 build tasks

Last updated: 2026-09-01

The contracts under `docs/contracts/slice-1/` define done. This file groups
implementation by coherent ownership without changing assertion granularity.

## W1: Shared foundation, fixtures, and validation harness

Targets: `VAL-TEST-CONTROL-INTEGRITY`.

- Pin official Foliate.js commit and official SQLite/font/icon/test packages.
- Add deterministic, malicious, corrupt, unsupported, long-metadata, and
  missing-cover fixtures with provenance.
- Add production CSP, test/build commands, test-only dependency-injection seam,
  shared clock/deadlines, and production exclusion checks.
- Define serializable reader/storage domain types without implementing either
  subsystem's behavior.

## W2: SQLite worker and local library store

Depends on: W1.

Targets: `VAL-STORAGE-BACKEND`, `VAL-STORAGE-ROUNDTRIP`,
`VAL-STORAGE-FALLBACK`, `VAL-STORAGE-LOCK`,
`VAL-STORAGE-PERSISTENCE-REQUEST`.

- Implement sole-worker `oo1`/`opfs-sahpool` ownership, schema, typed client,
  diagnostics, transactions, book/state round trips, session fallback, lock
  recovery, and persistence request.

## W3: Foliate reader adapter

Depends on: W1.

Targets: `VAL-READER-ENGINE`, `VAL-READER-ADAPTER-CONTRACT`,
`VAL-READER-OPEN`, `VAL-READER-NAV`, `VAL-READER-SELECTION`,
`VAL-READER-SECTION-ERROR`, `VAL-READER-LIFECYCLE`.

- Implement the imperative adapter and React host boundary, metadata/TOC/
  location/passage/selection snapshots, open/navigation/style primitives,
  lifecycle safety, timeouts, and test fault seams.

## W4: Library product surface

Depends on: W2 and W3.

Targets: `VAL-LIBRARY-BOOTSTRAP`, `VAL-LIBRARY-IMPORT`,
`VAL-LIBRARY-CATALOG`, `VAL-DESIGN-DIRECTION`.

- Replace the marketing scaffold with the approved library, bootstrap/import
  workflow, truthful continuation state, empty/loading/error/retry states,
  typography, identity, responsive list, and storage status.

## W5: Reader product surface

Depends on: W2, W3, and W4.

Targets: `VAL-READER-SHELL`, `VAL-READER-STYLE`, `VAL-READER-RESTORE`,
`VAL-READER-RESPONSIVE`, `VAL-READER-ACCESSIBILITY`, `VAL-STUDY-SHELL`.

- Build desktop/mobile chrome, TOC/Text panels, page controls, selection action,
  reversible presentation, restore orchestration, study shell, focus/motion/
  zoom/touch behavior, and source preservation.

## W6: Security and local-first hardening

Depends on: W3 and W5.

Targets: `VAL-EPUB-CONTAINMENT`, `VAL-EPUB-RESOURCE-POLICY`,
`VAL-CUSTOM-CSS-SAFETY`, `VAL-LOCAL-FIRST`.

- Exercise real Foliate child documents against the malicious fixtures, close
  CSP/resource/custom-CSS gaps at their source, and prove core reading with all
  non-origin routes blocked.

## W7: Physical-phone readiness

Depends on: W2 through W6.

Target: `VAL-DEVICE-PIXEL7`.

- Expose the verified build over HTTPS and confirm the real storage mode and
  hero flow in the embedded agent browser that ADR 0003 names as the judged
  surface. Run the physical Pixel 7 flow opportunistically if the device is at
  hand; it is best effort and does not gate Slice 1.

## Milestone validation

- Scrutiny lane: all Slice 1 contracts, hard gates, source/diff review, fixtures,
  build artifacts, banned-path checks, and evidence integrity.
- Real-surface lane: all browser and data contracts through the production
  surface, including empty/error/retry/security/two-tab/responsive states.
- Physical-device lane: `VAL-DEVICE-PIXEL7` only, best effort under ADR 0003.
- Slice 1 gate closes only after every contract has independent evidence or an
  explicit accepted blocked/remaining-device decision.

