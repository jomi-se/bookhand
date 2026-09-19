# ADR 0009: Stage book repairs outside the personal copy

## Status

Accepted on 2026-09-19. The exact agent tool choreography and preview design
remain subject to evaluation.

## Context

An agent may need minutes and several source-level operations to repair related
book issues. Blocking the reader, moving their visible position, or applying
partial edits would make the reading experience subordinate to the repair
machinery. Allowing concurrent source-changing jobs would instead require
merging stale AI edits and explaining version-control concepts to a person who
only wants to read.

## Decision

Bookhand keeps the current **personal copy** stable while one repair workspace
per book is prepared off-screen. Ordinary reading, search, annotations, and
presentation changes continue; background repair work does not navigate the
visible reading surface. Only explicit Tutor guidance may temporarily direct
the reader's attention.

A repair workspace is based on an exact, monotonically increasing personal-copy
version. Source-changing operations cannot compete with it. The agent must
eventually identify one coherent proposal for preview; the precise `Present
repair`-style protocol will be chosen through agent evaluation rather than
fixed by this record. Until the reader accepts the proposal, no draft becomes
part of the personal copy.

Bookhand checks proposals before presentation. Unsafe executable,
exfiltrating, or otherwise disallowed content still fails closed. Other
deterministic quality warnings return through the agent's tool flow when
possible and remain advisory: the agent may revise or explain, and the reader
makes the final decision. Acceptance applies the grouped repair atomically and
removes the issues it addressed without pretending Bookhand can prove a
semantic improvement.

Recovery is a hidden linear history. Undo makes Redo available; accepting a
new repair after Undo discards the abandoned future. The imported publisher
original always remains recoverable. Restoring old content still creates a new
monotonic personal-copy version, so stale repair work cannot accidentally
apply.

## Consequences

- Reading remains usable while an AI works, but client-only Bookhand cannot
  promise model execution after the application or external agent disconnects.
- Bookhand preserves local repair checkpoints and completed draft work. A
  compatible connected Tutor may restore its conversation; a WebMCP agent can
  only reconstruct work from the durable Bookhand state.
- Completion is quiet persistent state in Book Health or Tutor, not a toast or
  modal interruption.
- Live draft viewing, exact proposal-finalization tools, and recovery UX remain
  evidence-gated details. The invariants are non-blocking reading, no
  unaccepted mutation, one active source-changing workspace per book, and
  durable recovery.
