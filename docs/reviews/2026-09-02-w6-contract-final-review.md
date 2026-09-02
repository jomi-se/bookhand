# W6 tutor contract final review

Date: 2026-09-02

Outcome: **clean on the third sequential pass**. No W6 implementation was part
of this review. The remaining prerequisite is the owner-visible ChatGPT Desktop
W5 smoke named in `docs/plan/current-work.md`.

## Reviewed boundary

- `VAL-TUTOR-SESSION-LIFECYCLE`
- navigation-only `VAL-TUTOR-PASSAGE-FOCUS`
- `VAL-TUTOR-OVERLAY-ISOLATION`
- W9 `VAL-TUTOR-PASSAGE-CUE`
- `VAL-TUTOR-PRESENTATION-SAFETY`
- `VAL-TUTOR-STUDY-REVEAL`
- hero evidence, scope inventory, and W6/W9 task topology

The amendment originated in
`docs/reviews/2026-09-02-w6-contract-amendment-proposal.md` and was checked
against the product North Star, current reader/persistence behavior, and the
real Foliate adapter.

## Findings incorporated after pass one

1. Relocation is classified from captured intent; resize, panel, pagination,
   and style reflow cannot be mistaken for learner takeover.
2. A never-resetting runtime generation, book identity, and adapter identity
   guard every asynchronous effect. Repeated guidance preserves or recaptures
   the origin according to explicit `absent`, `guiding`, and `yielded`
   transitions.
3. `focus_passage` has an exact serialized schema including `sectionIndex`, and
   focus, Back, Stop, and guidance state have falsifiable result shapes.
4. Guidance anchors the stored location value rather than suppressing the
   combined location/style record. Evidence checks values and write order.
5. W6 must render a test-only sentinel at a real verified Foliate range; an
   empty detached overlay cannot satisfy isolation.
6. Cue, explanation, and Study reveal invalidate delayed work across every
   terminal transition. Reveal has a named focus fallback.

## Findings incorporated after pass two

1. A retired Foliate move may already have changed the physical viewport, so
   the controller must reassert the newest authoritative target. Evidence must
   align DOM-visible passage, adapter location, reading context, and persistence.
2. Public `guidance.revision` is exactly the never-resetting controller
   generation, including while guidance is absent.
3. `present_explanation` and `reveal_study_item` have exact inputs, outcome
   unions, rejection classes, and resulting guidance state.
4. The hero requires the learner to activate visible Back or Stop. A
   model-originated control call cannot substitute for learner control.

## Accepted topology

- W6 owns origin-aware navigation, navigation-only `focus_passage`, anchored
  persistence, guiding/yielded state, Back, Stop, and the proven overlay seam.
- W9 owns visual passage cues, Study reveal, and bounded temporary explanation.
- There is one predictable session-origin Back target, not an invisible hop
  stack.
- Exact indicator placement remains a responsive design decision; remaining
  visible, attributed, keyboard-operable, outside panel replacement, and
  outside chrome recession is contractual.

The third pass found no remaining blocker or fake-pass route in this boundary.
