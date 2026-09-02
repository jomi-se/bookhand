# Study surface and tutor layer proposal

Date: 2026-09-02

Status: **accepted direction; integrated into the active polish mission on
2026-09-02**

This document sequences the findings in:

- `docs/reviews/2026-09-02-study-surface-code-review.md`
- `docs/reviews/2026-09-02-embodied-tutor-layer-review.md`

The implementation pass is complete and the proposal was reconciled against
`92ab862`. The active contract manifest and executable ordering now live in
`polish-and-showcase-mission.md` and `polish-and-showcase-build-tasks.md`; this
document preserves the reasoning and cut line.

## Outcome

Bookhand should demonstrate two complementary experiences:

1. a cohesive, durable lesson that feels authored rather than appended; and
2. a transient tutor that can point, move, explain, and return without leaving
   unwanted permanent marks.

## Ordering principle

Fix semantic integrity and domain hierarchy before polishing cards. A visual
redesign built on flat independent rows will either remain flat or invent
client-only grouping that persistence, Undo, WebMCP, and reload cannot honor.

## Wave A — close source-fidelity lifecycle gaps

Goal: one canonical excerpt survives extraction, citation, rendering,
persistence, reload, and search.

- Decide the versioned `SourceExcerpt` shape and extraction-version lifecycle.
- Canonicalize source-derived quotations; keep paraphrases explicitly prose.
- Handle existing pre-version records with deterministic repair or a visible
  stale-source state.
- Fix image-only visible-context gating and MathML `aria-label` fallback.
- Prove real Foliate CFI roundtrips for figure-only and mixed math ranges.
- Extend `VAL-MATH-PASSAGE` with the Chapter XIX Fig. 52 regression and
  migration/reindex expectations.

Suggested new target: `VAL-SOURCE-EXCERPT-LIFECYCLE`.

## Wave B — implement the cohesive study experience

Goal: the agent creates one lesson, not five database-looking cards.

- Add a first-class experience schema with title, ordered bounded native
  blocks, shared/differing source references, semantic theme roles,
  provenance, revision, and atomic action group.
- Implement atomic command/storage behavior and context-versioned
  `upsert_study_experience`.
- Canonicalize typeset math and parse-failure behavior.
- Relate quotation sources to annotations to avoid duplicated content.
- Make Undo/Delete/Reset/Return-to-source apply at the unit the UI presents.

Existing primary targets:

- `VAL-STUDY-SCHEMA-SECURITY`
- `VAL-STUDY-EXPERIENCE-LIFECYCLE`
- `VAL-ACTION-PROVENANCE-UNDO`
- `VAL-AGENT-DESIGN-CONTEXT`

## Wave C — compose the study workspace

Goal: learning content owns attention; protocol diagnostics remain available.

- Remove raw activity and diagnostics from Study. Put observability in a
  separate surface; reserve Study status only for an active tutoring state and
  its learner controls.
- Establish the native visual grammar for prose, quotations, math, steps,
  questions, citations, and annotation references.
- Remove storage-type labels from ordinary reading hierarchy.
- Give docked and expanded modes different information architecture.
- Give lesson/item destinations stable DOM identity, meaningful headings,
  scroll targeting, and focus behavior.
- Validate light, sepia, dark, and publisher/custom theme roles across the
  study grammar rather than hard-coding the default palette.

Suggested new targets:

- `VAL-STUDY-COMPOSITION-HIERARCHY`
- `VAL-AGENT-ACTIVITY-PRESENTATION`
- `VAL-STUDY-WORKSPACE-RESPONSIVE`

Run a formal two-pass Impeccable critique here, after the target UI is stable.
Use the actual deployed desktop and phone-size surfaces; preserve screenshots
and the scored artifact.

## Wave D — add the transient tutor controller

Goal: source-directed teaching without permanent mutation.

- Unify deliberate reader navigation behind one origin-aware controller.
- Add the bounded in-memory tutor session store and lifecycle.
- Solve transient/durable overlay coexistence before registering tools.
- Add the guidance indicator, Back, Stop, reduced-motion behavior, and user
  takeover semantics.
- Add `focus_passage` and `control_guidance` through commands, then WebMCP.
- Add `reveal_study_item`/experience once stable targets exist.
- Add a restrained `present_explanation` only after passage focus is proven.

Suggested new targets:

- `VAL-TUTOR-SESSION-LIFECYCLE`
- `VAL-TUTOR-PASSAGE-FOCUS`
- `VAL-TUTOR-OVERLAY-ISOLATION`
- `VAL-TUTOR-PASSAGE-CUE`
- `VAL-TUTOR-STUDY-REVEAL`
- `VAL-TUTOR-PRESENTATION-SAFETY`

## Wave E — prove the combined product

Goal: demonstrate that the model can teach through the book, not merely write
beside it.

One real ChatGPT Desktop scenario should:

1. read current state and search for a relevant passage;
2. move to and visibly focus the exact source;
3. present a short temporary explanation;
4. let the learner Stop or return to the prior location;
5. create a separate cohesive durable lesson only when asked;
6. reveal that lesson, update it after follow-up, and preserve it across reload;
7. prove transient tutor state does not survive reload.

Fold this into `VAL-HERO-MODEL-RUN` rather than presenting it as a second
unrelated demo.

## Cut line

Do not cut canonical source integrity, atomic lesson hierarchy, accessible math,
visible Back/Stop, transient-vs-durable separation, or real-model evidence.

If time is tight, cut in this order:

1. temporary explanation math; retain plain text;
2. multi-entry tutor history; retain one reliable Back target;
3. expanded-mode secondary rails; retain a good centered lesson;
4. broad study block vocabulary; retain prose, source, equation, and question;
5. visual pulse; retain stable accessible emphasis.

## Activation record

The concurrent pass landed, the current code was re-audited at `92ab862`, and
overlap with retrieval and the earlier W5 contracts was reconciled. The active
mission owns validation and dependency order; implementation must still satisfy
its two sequential contract-review passes before the amended topology freezes.
