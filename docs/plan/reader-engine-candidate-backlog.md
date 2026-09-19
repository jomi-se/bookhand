# Reader-engine candidate backlog and selection workflow

Status: post-adoption candidate workstreams; completed foundations are marked.

This backlog converts the
[reader-engine specifications](../specs/reader-engine/README.md) and active
[reading-quality baseline](../specs/reading-quality-baseline.md) into choices
for future missions. Readest supplies a mature quality reference and a deep
catalogue of battle scars; Bookhand chooses its own features and independently
proves the selected behavior. The backlog deliberately stops before detailed
implementation plans, `VAL-*` contracts, or task graphs. Those belong to the
focused planning pass after the owner selects one candidate.

## Decision principles

Candidates are ordered by:

1. user-visible reading value;
2. prerequisite leverage for later work;
3. reduction of security, data, or architecture risk;
4. ability to validate independently;
5. implementation and maintenance cost; and
6. reversibility.

Priority labels mean:

- **P0 foundation:** establish evidence or settle a blocking boundary before a
  production renderer change;
- **P1 correctness:** high-value reader behavior that should precede feature
  breadth or polish;
- **P2 capability:** worthwhile behavior after the foundation is trustworthy;
- **P3 separate product:** useful but outside the current reflowable-EPUB
  mission;
- **Reject:** an observed Readest choice that Bookhand should not inherit.

Effort is deliberately coarse until a candidate receives a focused
investigation: **S** is one bounded mission, **M** spans several coherent
implementation surfaces, and **L** requires an architectural or product slice.

## Foundation status and experiments

### RE-001 — Pinned MIT-fork compatibility spike — **Completed**

- **Outcome:** the exact MIT owner-fork commit proved compatible with bounded
  Bookhand patches and was subsequently adopted by ADR 0008.
- **Evidence:** deterministic compatibility coverage, full repository checks,
  and genuine Windows in-app-browser validation of WebMCP, retained-frame,
  fragment, remaster, search, and page-turn behavior.
- **Residual boundary:** the adoption did not prove continuous scrolling,
  physical-device input, native assistive technology, or every capability in
  the fork.

### RE-002 — Reading-quality journeys and targeted observability

- **Outcome:** keep the two-layer reading-quality baseline actionable through
  independently authored fixtures, counters, and real-surface journeys added
  when a selected mission needs them.
- **Value:** carries Readest's hard-earned lessons into Bookhand without
  copying AGPL artifacts or rebuilding years of regressions before improving
  the reader.
- **Scope:** maintain the baseline and add only the smallest serious evidence
  for named risks such as anchoring, delayed resources, writing modes,
  selection, footnotes, lifecycle races, or resource bounds.
- **Must prove:** every fixture protects a chosen behavior, reproduces a named
  risk, or measures a bound; provenance is documented and assertions avoid
  source-specific shortcuts.
- **Non-goal:** a gigantic speculative EPUB corpus, Readest parity automation,
  or postponing visible reading improvements until every risk has a fixture.
- **Dependencies:** none.
- **Unlocks:** stronger evidence for each correctness or capability mission.
- **Risk:** testing theater: accumulating fixtures that do not reproduce the
  intended browser behavior or influence a product decision.
- **Effort:** ongoing and mission-bounded rather than one M-sized prerequisite.

### RE-003 — Persistent-frame versus multi-view architecture experiment

- **Outcome:** prototype and compare true continuous multi-section scrolling
  with a section-stream experience that hands off cleanly at boundaries, then
  decide whether either can coexist with Bookhand's one persistent same-origin
  frame or warrants replacing ADR 0005.
- **Value:** resolves the largest known architectural conflict before
  continuous scrolling or adjacent-view lifecycle leaks into production.
- **Scope:** bounded prototypes and direct desktop/phone experience plus
  evidence for frame identity, CSP, annotations, selection, remaster
  switching, extraction, focus/accessibility, resource lifetime, exact passage
  preservation when changing modes, and section-boundary scrolling.
- **Must produce:** options, observed tradeoffs, security implications, and an
  ADR proposal or a confirmed decision that ADR 0005 remains unchanged.
- **Non-goal:** shipping continuous scroll or weakening containment to make a
  prototype pass.
- **Dependencies:** RE-001/RE-004 are complete. Add only the targeted RE-002
  evidence the experiment needs.
- **Unlocks:** RE-018.
- **Risk:** high architecture/security significance; all prototypes remain
  disposable until an ADR is accepted.
- **Effort:** M.

### RE-004 — Adopt one vetted fork commit behind `ReaderAdapter` — **Completed**

- **Outcome:** Bookhand now pins
  `jomi-se/foliate-js@ca3f118269f8d78811ef17a1b147363c321273d7` behind
  `ReaderAdapter`, with notices, fail-closed retained-frame adaptation, and
  exact-asset controlled-browser proof.
- **Update policy:** pull owner-fork or upstream changes selectively when they
  benefit Bookhand; make owner-fork changes when necessary rather than waiting
  for upstream. Every pin change still uses the explicit update and rollback
  gate.

## P1 correctness candidates

### RE-010 — Lifecycle, resource ownership, and stale-work cancellation

- **Outcome:** competing opens, section loads, extraction, remaster refreshes,
  footnotes, overlays, and teardown cannot revoke live resources or commit stale
  results.
- **Primary gains:** fewer blank sections, indefinite spinners, detached-node
  errors, listener leaks, and book-A-content-in-book-B races.
- **Dependencies:** the adopted fork; targeted lifecycle evidence under RE-002.
- **Evidence:** fault injection, repeated/competing open-close cycles, active
  resource accounting, last-safe-surface recovery, and Retry.
- **Effort:** M.

### RE-011 — Content-anchor stability across resize, styles, and flow

- **Outcome:** the same passage remains visible across rotation, viewport and
  typography changes, late fonts/images, remaster switching, and page/scroll
  transitions.
- **Primary gains:** eliminates page drift and the feeling that changing a
  reading preference loses one's place.
- **Dependencies:** targeted anchor evidence under RE-002; the fork is adopted.
- **Evidence:** quote-plus-CFI before/after round trips across independent
  fixtures, broken/hanging resources, fractional dimensions, and repeated
  portrait-landscape cycles.
- **Effort:** M.

### RE-012 — Unified targets, history, and durable-progress semantics

- **Outcome:** TOC, CFI, href, page-list, search, annotation, study citation,
  and agent focus all navigate through one exact target model; preview
  navigation never overwrites last-read state.
- **Primary gains:** predictable Back behavior, truthful progress, and fewer
  feature-specific navigation bugs.
- **Dependencies:** none for domain-policy work; RE-004 for renderer parity.
- **Evidence:** differential navigation to source quotes, explicit/implicit
  history transitions, pagehide/visibility/unmount flush, and preview versus
  confirmed reading.
- **Effort:** M.

### RE-013 — Reading direction and writing-mode correctness

- **Outcome:** logical previous/next, physical keys/taps/swipes, layout axis,
  and browser scroll sign remain distinct for LTR, RTL, and vertical-rl.
- **Primary gains:** correct non-LTR reading and a single direction model for
  UI, adapter, and future input work.
- **Dependencies:** targeted writing-mode fixtures under RE-002.
- **Evidence:** independent LTR/RTL/vertical-rl fixtures and physical-direction
  actions. Vertical-lr remains explicitly unsupported until separately proved.
- **Effort:** M.

### RE-014 — EPUB parsing and publisher-layout hardening

- **Outcome:** malformed-but-readable packages, encoded paths, covers, tables,
  media, fonts, backgrounds, and pathological publisher CSS fail safely or
  render without clipping later prose.
- **Primary gains:** broader real-world EPUB compatibility.
- **Dependencies:** targeted malformed/publisher-layout evidence under RE-002.
- **Evidence:** licensed or independently authored hostile corpus, network/CSP
  observation, readable/selectable content, accessibility alternatives, and
  bounded fallback diagnostics.
- **Effort:** M.

## P2 capability candidates

### RE-015 — Iframe input and gesture ownership

- **Outcome:** wheel, keyboard, touch, mouse, selection, pinch, links, and
  trailing synthetic clicks have deterministic ownership and cause at most one
  intended action.
- **Value:** makes desktop trackpads and phone gestures reliable without
  stealing selection or editable controls.
- **Dependencies:** RE-013 direction model; physical-device validation for
  touch claims.
- **Effort:** M.

### RE-016 — Selection, overlays, footnotes, and accessibility integrity

- **Outcome:** saved ranges resolve to the same words, annotation/search/tutor
  overlays remain isolated, footnotes recover safely, and visible content has
  correct focus and assistive exposure.
- **Value:** protects Bookhand's study experience as rendering becomes more
  sophisticated.
- **Dependencies:** targeted RE-002 evidence; RE-010 lifecycle; RE-013 for
  vertical/RTL geometry.
- **Effort:** M.

### RE-017 — Explicit performance budgets and long-session resource bounds

- **Outcome:** resident views, object URLs, documents, canvases, observers,
  listeners, pending work, reflow time, and persistence flush have measurable
  budgets and regression evidence.
- **Value:** prevents a reader that looks correct in short tests but degrades
  over hours or large books.
- **Dependencies:** mission-specific instrumentation under RE-002 and lifecycle
  ownership from RE-010.
- **Effort:** M.

### RE-018 — Continuous multi-section scrolling

- **Outcome:** scrolling crosses EPUB section boundaries without blank flashes,
  dead ends, lost anchors, accessibility gaps, or unbounded memory.
- **Value:** the largest visible capability identified in Readest.
- **Dependencies:** accepted experience and architecture result from RE-003.
  Shipping evidence must cover the applicable lifecycle, anchoring, direction,
  accessibility, and resource-bound risks from RE-010/011/013/016/017; those
  need not all become separate blocking projects before the experiment.
- **Risk:** high; this is a lifecycle architecture, not a display toggle.
- **Effort:** L.

### RE-019 — Repeatable owner-fork update and rollback tooling

- **Outcome:** an upstream candidate produces a bounded history/provenance/
  dependency/security report and cannot advance Bookhand's pin automatically.
- **Value:** makes later updates reviewable without pretending automation can
  approve them.
- **Dependencies:** RE-004 established the first production pin and rollback.
- **Effort:** S–M.

## P3 separate product candidates

These remain inventoried but are not eligible for ordinary renderer-correctness
rounds without a new product decision:

- **RE-030 — Fixed-layout EPUB:** detect the standard layout declaration now
  and explain plainly that Bookhand currently focuses on reflowable books.
  Full support would require spreads, cover side, fit modes, zoom/pan,
  virtualization, selection limitations, and a frame/CSP decision. **Effort L.**
- **RE-031 — PDF and comics:** workers/assets, canvas memory, text layers,
  labels, range concurrency, overlays, direction, and CBZ ordering. **Effort L.**
- **RE-032 — TTS, media overlays, and autoscroll:** segmentation, pronunciation,
  highlighting, audio focus, cancellation, navigation sync, reduced motion,
  and progress. **Effort L.**
- **RE-033 — Advanced animation and native inputs:** Bookhand already has a
  constrained cross-spine slide. Page curls, richer transitions, snapshot
  cancellation beyond the current contract, GPU/WebKit paths, e-ink, stylus,
  volume, and hardware turners remain separate. **Effort L.**

## Explicit rejections

No implementation candidate should:

- copy Readest AGPL application code, tests, fixtures, comments, or close
  structural translations;
- use a floating Foliate branch or assume the registry package is the Readest
  fork;
- relax Bookhand's CSP, publisher-script, remote-resource, bridge, or
  persistent-frame rules merely to adopt a feature;
- replace exact CFI/domain state with byte-size location estimates;
- replace Bookhand's local FTS/remaster-aware retrieval with renderer search;
- introduce accounts, Readest sync/services, native bridges, or backend
  dependencies into ordinary reading;
- combine advanced animation or deferred formats with an unrelated correctness
  mission;
  or
- call emulator evidence physical-device validation.

## Three-candidate selection workflow

Each round follows this loop:

1. **Present three.** The root agent filters to unblocked candidates and offers
   exactly three concise choices. Each choice states reader value, why now,
   dependencies, likely effort, highest risk, and the evidence required.
2. **Owner chooses one.** The owner may select, combine narrowly, defer, or ask
   for a different slate. No implementation begins before this choice.
3. **Plan the chosen mission together.** Investigate the exact current surface,
   settle open product/architecture questions with the owner, write or update
   the mission scope and capability inventory, author falsifiable `VAL-*`
   contracts, review those contracts twice, and only then create the work,
   validation, and gate topology.
4. **Implement with deliberate ownership.** The root agent directly owns
   diagnosis, architectural judgment, tightly coupled code, integration, and
   review. Delegate only genuinely mechanical, sharply bounded, low-context
   work whose coordination cost is lower than doing it directly. No agent may
   consult the AGPL Readest application.
5. **Integrate and review centrally.** The root agent inspects every diff,
   resolves cross-lane behavior, runs the hard gates, and commissions
   independent scrutiny and real-surface validation where the contracts
   require it. Worker summaries and green self-authored tests are supporting
   evidence, not acceptance.
6. **Land coherently.** Commit only the reviewed, integrated result in one or
   more concern-scoped commits. Do not push, publish, tag, mutate the owner
   fork, or deploy without a separate explicit owner instruction.
7. **Update the backlog.** Record evidence, newly unblocked work, rejected
   assumptions, regressions, and the next three eligible choices.

## Recommended next slate

The next selection round should choose among:

1. **RE-003 — Continuous versus section-stream scrolling experiment**
   *(recommended)*: answer the largest visible reading-mode question by feeling
   both experiences while preserving the real controlled-browser boundary.
2. **RE-011 — Content-anchor stability:** make typography, viewport, delayed
   resources, remaster changes, and future flow switches stop losing the
   reader's passage.
3. **RE-010 — Lifecycle and stale-work cancellation:** harden the fork-backed
   reader against competing loads, leaked resources, and long-session failure.

RE-002 is no longer a separate giant prerequisite. Each selected mission draws
the relevant journeys from the quality baseline and adds only its necessary
fixtures and instrumentation.
