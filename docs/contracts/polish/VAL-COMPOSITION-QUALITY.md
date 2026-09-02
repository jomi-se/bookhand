# VAL-COMPOSITION-QUALITY: A frontier model composes study surfaces worth reading

Surface: deployed secure origin in a compatible agent browser, repeated.
Needs: `VAL-HERO-MODEL-RUN`, `VAL-RANGE-OWNERSHIP`, `VAL-STUDY-EXPERIENCE-LIFECYCLE`.

Why this exists: every other contract in this mission measures whether the
machinery is safe, authentic, atomic, and correct. `VAL-HERO-MODEL-RUN` proves a
real model originated the calls — it is an anti-fabrication contract, and it
would pass just as well on a lesson nobody would want to read. Nothing here
measures the thing the product is actually claiming: that a capable agent, given
this page's affordances, composes study surfaces materially better than an
ordinary ebook reader affords. That claim is the entire premise, and it is the
one thing currently taken on faith.

Behavior: A frozen set of at least twelve intent-only prompts, spanning at least
three chapters and both "explain this" and "quiz me" shapes, is run against the
deployed build through a named model and version. Each run is scored on measures
that do not depend on the grader's taste:

- **Grounding.** Every citation is verified by the product itself. A rejected
  source claim is a hallucination the book caught, so the rejection rate is an
  objective number, not a judgment.
- **Discovery.** Whether the model called `get_design_context` before composing
  without being told to, and whether it composed within the vocabulary it
  returned.
- **Validity.** Whether the payload passed schema validation on the first
  attempt, and how many attempts a completed lesson took.
- **Completion.** Whether the run produced a persisted, reloadable experience
  at all, or stalled.

A separate qualitative read records whether the lesson teaches the passage or
merely restates it — reported as commentary, never as a score, because the
system that composed the lesson cannot be trusted to grade it.

Evidence: The frozen prompt set committed under `tests/fixtures/composition/`;
one transcript per run naming model, version, and deployed commit; a results
table with per-measure counts and the rejection log; screenshots of the best and
worst outputs. Both extremes are reported. A results table showing only
successes is not evidence, it is marketing.

Status: identified 2026-09-02, after W0 and part of W1. Not schedulable before
`VAL-STUDY-EXPERIENCE-LIFECYCLE` exists — an eval of a surface that has not been
built measures nothing. It is the first thing to run once W5 lands.
