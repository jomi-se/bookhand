# Reader-engine behavior specifications

Status: active battle-scar and behavior guide for the adopted Foliate fork.

These documents turn the Readest/Foliate source study into Bookhand-owned
behavioral requirements. Readest is a quality baseline and a source of
hard-earned lessons, not an application to copy. Bookhand now uses the exact
MIT owner-fork pin accepted by ADR 0008 behind `ReaderAdapter`, while preserving
the controlled-browser and persistent same-origin frame boundary from ADR
0005.

Use this set with the [reading-quality baseline](../reading-quality-baseline.md)
before reader work. Select the relevant journeys and footguns, then add the
smallest serious evidence needed for the chosen mission. These documents do not
authorize every capability they describe or require a giant up-front regression
corpus.

## How to read this set

Each requirement is labelled by evidence type:

- **Verified MIT renderer**: observed in `readest/foliate-js` at
  `ca3f118269f8d78811ef17a1b147363c321273d7`.
- **Verified AGPL application behavior**: observed in the Readest application
  at `180795fb4960c32ed11539e6ba70085a5041ecaf`; behavior only, with no code,
  test, fixture, comment, or close structural translation copied here.
- **Mixed**: the renderer supplies a primitive and the application supplies
  policy or coordination.
- **Bookhand inference/recommendation**: a conclusion drawn by comparing those
  sources with Bookhand's current architecture.

The license labels are provenance boundaries, not legal advice. MIT renderer
code may be evaluated or reused with notice retention and provenance review.
AGPL application material is research-only unless Bookhand deliberately makes
a different licensing decision.

## Documents

- [Coverage inventory](coverage-inventory.md) maps every investigated
  capability family to a disposition and specification.
- [Lifecycle, loading, and recovery](lifecycle-loading-and-recovery.md) covers
  open/close, parser and resource lifetime, concurrent work, and malformed
  books.
- [Reflow, scrolling, and anchoring](reflow-scrolling-and-anchoring.md) covers
  pages, continuous scroll, section eviction, resize, and style reflow.
- [Navigation, progress, and input](navigation-progress-and-input.md) covers
  unified targets, restoration/history, direction, keys, wheel, touch, and
  gesture ownership.
- [Selection, annotations, footnotes, and accessibility](selection-annotations-and-accessibility.md)
  covers exact ranges, overlays, popup semantics, focus, and assistive exposure.
- [Presentation and format boundaries](presentation-and-format-boundaries.md)
  covers publisher CSS, media, tables, covers, typography, fixed layout, PDF,
  comics, TTS, autoscroll, and animation.
- [Security, performance, and async integrity](security-performance-and-async-integrity.md)
  covers CSP, untrusted content, memory bounds, cancellation, concurrency, and
  observability.
- [Fork integration and update gate](fork-integration-and-update-gate.md)
  defines the required compatibility spike and owner-controlled update process.

The evidence narrative and exact history landmarks remain in
[`2026-09-17-readest-navigation-pagination-scrolling.md`](../../research/2026-09-17-readest-navigation-pagination-scrolling.md).
The accepted Bookhand contracts and decisions remain authoritative. Historical
research language that predates the fork adoption is evidence of what was known
then, not current dependency state.

Prioritized future choices and the three-candidate selection workflow live in
the [reader-engine candidate backlog](../../plan/reader-engine-candidate-backlog.md).

## Shared Bookhand constraints

Every future reader-engine change must preserve:

- the serializable `ReaderAdapter`; no renderer DOM, iframe, `Range`, event, or
  opaque handle crosses into UI, storage, or WebMCP;
- the one persistent same-origin frame unless ADR 0005 is explicitly replaced;
- strict blocking of packaged scripts, remote fetches, forms, nested browsing,
  and privileged bridge access;
- durable exact CFIs plus section and text evidence, not pixel offsets or
  estimated location numbers as canonical state;
- local, transformation-aware indexing and the accepted remaster revision as
  the common source for rendering, extraction, search, and citations;
- visible, reversible, user-owned annotations, presentation, and remasters;
- useful ordinary reading without an agent, account, server, or native bridge.

## Residual unknowns

The Readest application and its tests were inspected but not executed. RE-001
proved the adopted fork against Bookhand's deterministic suite and the genuine
Windows in-app browser, but physical Android/iOS selection, native assistive
technology, long-session memory, vertical-writing breadth, and continuous
multi-section rendering remain unproven. The scrolling architecture and exact
experience must be prototyped rather than inferred from source alone.
