# Study platform synthesis review

Date: 2026-09-02

Code snapshot: `92ab862`

Inputs: two owner-supplied ChatGPT Desktop audits, the current source and
contracts, the earlier study-surface and embodied-tutor reviews, and a formal
two-agent Impeccable critique of the stable Study surface.

## Executive judgment

Bookhand's source integrity and mutation safety improved substantially, but its
main product thesis is still not visible in the interface. Study presents
storage records beneath protocol telemetry; it does not present a composed
lesson. The reader can be moved by an agent, but it has no transient,
learner-controlled way for a tutor to point, explain, and return.

The product therefore needs two explicit layers:

- **Study:** coherent durable knowledge the learner elects to keep.
- **Tutor guidance:** temporary direction of attention with visible Back and
  Stop, no implicit annotation, and no persistence across reload.

Agent logs belong to neither layer. They are observability and should live in a
separate diagnostics surface. Study may show only a compact semantic status
while tutoring is active, such as “Sol is showing this passage,” because that
state helps the learner understand and control what is happening.

This is not primarily a styling problem. Source lifecycle, lesson hierarchy,
tool grammar, navigation ownership, and transient-session semantics must be
fixed before final visual polish can hold.

## Reconciliation with the Desktop audit

| Observation | Current-code verdict | Planning consequence |
|---|---|---|
| Inline math and figure semantics improved | Confirmed for newly extracted passages | Preserve it and close image-only, MathML `aria-label`, CFI round-trip, and old-record lifecycle gaps |
| Activity is collapsed by default | Not confirmed: the header is a `<p>`, the list has no disclosure state, and calls simply appear when present | Remove observability from Study; put detailed calls in a separate diagnostics surface |
| Undo and ownership improved | Confirmed for individual mutations | Preserve receipts and tokens; add recovery at the user-visible lesson/removal boundary |
| `actionGroupId` groups lesson Undo | Not implemented: rendering and Undo remain item-by-item | Introduce a first-class lesson entity; do not use provenance grouping as presentation hierarchy |
| Design context says Undo is unavailable | Confirmed stale and actively misleading | Derive capability claims from runtime truth and test contradictions |
| Study is still a flat feed | Confirmed | Make title, conceptual sequence, and shared source louder than storage types |
| Equations still resemble raw TeX | Confirmed by the domain, `<pre>` renderer, and monospace styling | Add an explicit safe math format, accessible renderer, and visible fallback |
| Old damaged/duplicate source content remains | Confirmed | Add a versioned canonical source excerpt, stale state, Retry/Relink path, and deduplication policy |
| Expanded is materially different | Only spatially: it reuses the same feed; mobile collapses to effectively the same surface | Give docked and expanded modes different information architecture |
| Tutor pointing exists through board `focus` | Only a seed: it focuses the board, not a source range or requested item | Add a transient tutor session, source focus, reveal, Back, Stop, and user-takeover lifecycle |
| Tool schemas remain permissive/text-only | Confirmed | Tighten selectors and discriminated payloads; return structured fields plus concise human text |

## Formal Impeccable critique

The stable Study surface scored **23/40** across two independent critique
passes:

| Dimension | Score | Main failure |
|---|---:|---|
| Visual hierarchy | 2/5 | Protocol activity and storage labels outrank the lesson |
| Information architecture | 2/5 | No first-class lesson or collection hierarchy |
| Interaction clarity | 3/5 | Useful controls exist, but destructive and transient actions are poorly separated |
| Responsive composition | 3/5 | Expanded changes allocation more than composition |
| Accessibility and resilience | 3/5 | Native controls help; math, disclosure, errors, and focus targeting remain incomplete |
| Design-system coherence | 4/5 | Calm typography and semantic themes are a strong base |
| Content fitness | 2/5 | The surface reads like an event log followed by database rows |
| Product distinctiveness | 4/5 | Page-owned WebMCP and source grounding are genuinely differentiated |

The highest-priority findings were:

1. no user-visible lesson hierarchy;
2. observability and authoring controls displace learning content;
3. permanent one-click removal lacks a recoverable user flow;
4. Study load failure is stored but not rendered;
5. the five-way authoring control is an administrative first impression.

The ignored raw critique and screenshots remain available locally under
`.impeccable/critique/`; this document is the tracked, reviewable record.

## Durable Study requirements

A lesson must be a titled, ordered, atomic product object with shared and
block-specific sources, provenance, revision, annotation references, and one
visible lifecycle. Its renderer should use teaching hierarchy:

- quiet prose without a loud `PROSE` label;
- serif quotations with source attribution;
- centered, typeset, accessible math with a safe fallback;
- aligned, breathable steps;
- a contained question with a clear reveal action;
- compact highlights/annotations as references or an index, not duplicated
  full documents;
- one source chip at lesson level unless an individual block differs.

Docked mode should be a concise companion. Expanded desktop should become a
centered lesson workspace with optional contents/source or annotation rails.
On mobile, focused Study should replace the reader cleanly rather than imitate
a squeezed desktop split.

## Transient tutor requirements

The minimum page-owned vocabulary is `search_book`, `focus_passage`,
`reveal_study_item`, an optional bounded `present_explanation`, and
`control_guidance` for Back and Stop. The runtime must:

- verify the exact source before moving or emphasizing it;
- show a compact “Agent is showing you…” state with Back and Stop;
- keep at most a bounded in-memory navigation history;
- clear or supersede stale guidance safely;
- yield immediately to manual navigation;
- coexist with permanent highlights without overwriting them;
- render only bounded text and strict math in temporary explanations;
- leave storage, annotations, lessons, and preferences unchanged;
- disappear on reload.

Turn-by-turn agents can still choreograph search, focus, explanation, and
response in one turn. Bookhand must not imply continuous gaze awareness.

## Tool and lifecycle corrections

- `open_book` needs exactly one selector and explicit ambiguous-title results.
- `upsert_study_item` needs kind-discriminated required fields or retirement in
  favor of a lesson operation; handlers must not invent empty valid content.
- `set_reading_style` needs a non-empty, explicit operation grammar.
- Success and failure receipts need stable structured fields in addition to
  concise human-readable text.
- `get_design_context` capability prose must be generated from canonical live
  capability truth; its version must change when guidance that affects agent
  behavior changes.
- Source-derived quotations must use the verified canonical excerpt rather
  than an independent caller string.
- Existing pre-extraction-version records need deterministic refresh when the
  CFI still resolves, otherwise a visible stale-source state that preserves
  user-authored prose.

## What already deserves to survive

The calm prose typography, quotation accent treatment, native answer reveal,
semantic theme foundation, accessible figure descriptions, exact-source
verification, update-token ownership, idempotency, provenance, and visible
per-item Undo are all valuable foundations. The redesign should elevate them,
not restart the application.

## Decision

Activate the study/tutor proposal inside the existing polish mission. Fix
runtime and tool truth first, then canonical source lifecycle, shared
navigation, durable lesson semantics, workspace composition, and transient
tutoring. Finish with a combined real-model run and a composition-quality eval
that shows worst outputs as well as best.

## Contract review record

Two sequential independent contract reviews were run after activation.

Pass one added missing ownership for no-agent manual authoring, made the design
context version independently recomputable, restored an explicit deployed tool
oracle, clarified source repair and recoverable removal, and removed duplicate
acceptance ownership.

Pass two found the deeper canonical contradiction in `DESIGN.md`: it still put
tool history inside Study. The correction moves raw observability wholly to a
separate diagnostics surface. That pass also separated historical and active
contract ownership, narrowed legacy Undo to the per-item behavior actually
implemented, directly contracted `control_guidance`, added exact size limits,
and made persisted lessons agent-discoverable after reload.

Both passes' material findings were incorporated before the W4-through-W11
topology was frozen.

Related detail:

- `docs/reviews/2026-09-02-study-surface-code-review.md`
- `docs/reviews/2026-09-02-embodied-tutor-layer-review.md`
- `docs/plan/study-surface-and-tutor-layer-proposal.md`
