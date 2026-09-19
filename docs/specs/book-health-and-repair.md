# Book Health and repair

Status: agreed product model; implementation and interaction evaluation remain
future work.

## Product intent

People open Bookhand to read, not to maintain a queue of EPUB defects. Book
Health is a quiet helper surface that explains known problems and makes them
easy for a connected AI to investigate. Bookhand renders a book as well as it
safely can, but it is not a deterministic universal book fixer. It exposes the
domain knowledge, source access, safety boundaries, and reversible tools that
let an AI propose a good repair inside the app.

The goal is **fix once**: a repair the reader keeps becomes part of their
durable personal copy. Cross-device continuity is a future direction. A
standalone repaired-EPUB export is the preferred first portability mechanism;
accounts or a backend are not implied.

## Book Health

Book Health has three quiet states:

- **Looks good:** Bookhand knows of no current issues. This is not a guarantee
  that the publication is perfect.
- **Issues found:** the overview explains known concerns and possible effects.
- **Check incomplete:** Bookhand could not reliably assess part of the book or
  only partially supports its format.

There is no unread badge, issue count, health score, resolved-issue showcase,
or explicit Ignore workflow. Book Health is primarily available from the open
reader and may also be summarized in the library. Opening it does not create
work the reader must complete.

An issue either exists or it does not. When the reader accepts a proposal that
addresses it, it disappears from normal view. Internal recovery data may
restore coherent issue state with an older personal-copy checkpoint, but the
product does not present resolved issues as a vanity history.

## Issue sources and language

Issues come from two sources:

- **Automatically detected:** local deterministic checks performed by
  Bookhand.
- **Manually raised:** deliberately recorded by the reader or their AI.

The normal UI groups both together. Attribution and confidence remain
available in the issue details; they do not become separate inboxes.
Agent-raised semantic or accessibility concerns must not masquerade as
deterministic facts.

Every issue has two representations:

1. a concise, non-technical explanation of its effect on reading, navigation,
   or accessibility; and
2. structured technical evidence that is hidden from the ordinary reading
   path but easily available to a connected agent.

For example, the reader sees “Chapters may be difficult to find and navigate,”
not an explanation of semantic HTML. Ordering by likely reader impact is a
useful initial presentation heuristic, not a frozen severity taxonomy.

## Check timing

Deterministic checks run when:

- a book is imported or first opened;
- an agent proposes changes, before the reader accepts them;
- rendering exposes a concrete runtime failure; or
- a later Bookhand version gains a relevant diagnostic.

Checks do not continuously rescan an unchanged book. Results are associated
with the personal-copy and diagnostic versions.

Proposal warnings return directly through the agent's tool flow when possible.
This gives the agent an opportunity to revise the proposal or explain why a
warning is incomplete or mistaken. If the connection disappears or that flow
cannot carry the result, the warning remains with the repair state in Book
Health. Bookhand does not create an automatic model retry loop.

Unsafe executable, exfiltrating, or otherwise disallowed content remains a
hard refusal. Quality warnings are advisory. User-facing copy describes the
effect, not security implementation details, unless the refusal materially
changes what can be presented.

## Repair journey

The intended journey is:

1. Bookhand detects an issue, or the reader or their AI raises one.
2. Book Health explains the likely reader impact.
3. The reader asks their AI to investigate through Book Health or Tutor.
4. The agent examines source and surrounding book context without moving the
   visible reading position.
5. Closely related issues may be grouped into one repair workspace.
6. The agent produces a coherent proposal; the exact finalization protocol is
   evaluated with real agents before it becomes a stable contract.
7. Bookhand runs deterministic preflight checks and returns warnings to the
   agent.
8. The reader enters an explicit temporary preview and decides whether the
   result is better.
9. Acceptance atomically updates the personal copy, removes the addressed
   issues, and creates one recovery checkpoint.

The ordinary preview is experiential, not a source-code diff. The agent gives
a short explanation of what was wrong, what changed, what should improve, and
anything worth checking. Subtle navigation, structural, mathematical, or
accessibility improvements require enough explanation to make the decision
meaningful; agents should remain succinct. Raw markup and diagnostics belong
in optional advanced details.

## Work, disconnection, and recovery

Repair work is non-blocking relative to reading, not server-side background
execution. The reader can continue reading, searching, annotating, and changing
presentation while an agent works. Background repair does not move or mutate
the reading surface. Quiet persistent state such as “AI checking…”, “Repair
ready”, or “Repair paused” may appear in Book Health or Tutor; use no toasts or
blocking progress UI.

Only one source-changing repair workspace exists per book. It is based on an
exact monotonically increasing personal-copy version. Undo, Redo, Restore, an
accepted repair, or another source change cannot race it. A stale proposal must
be re-read or deliberately rebased by the agent rather than silently merged.

Bookhand locally preserves the selected issues, base version, completed draft
changes returned through tools, deterministic warnings, completion state, and
a concise agent progress summary. It cannot preserve an external model's
private reasoning or guarantee that a WebMCP conversation resumes. A compatible
connected Tutor may restore the latest conversation only when its identity,
book, and repair workspace match; otherwise any agent can reconstruct the work
from Bookhand's durable checkpoint.

Recovery is a hidden linear history:

- Undo moves back and enables Redo.
- Redo returns to the state before Undo.
- Accepting new work after Undo discards the abandoned future.
- Restore can recover an earlier coherent personal-copy checkpoint.
- Reset returns to the immutable publisher original.

Restoring content creates a new monotonic version. Recovery includes every
derived state affected by the repair, such as Book Health, indexing, and source
anchors, rather than restoring XHTML alone.

## Portability direction

The first export goal is an ordinary standalone EPUB with the current personal
copy baked in. It should open correctly in another conforming reader without
Bookhand or a sidecar. Embedded comments or a repair manifest may be explored
later, but provenance metadata must not delay a useful portable book or turn
Bookhand into an editorial publishing system.

## Deferred and evidence-gated details

- exact agent proposal/finalization tool choreography;
- whether any live-draft viewing improves the experience;
- the visual placement and motion of quiet Book Health state;
- optional export comments or portable repair manifests;
- cross-device synchronization and community repair sharing; and
- provider-specific automatic classifiers or a backend.

Evaluate the workflow with both a connected Tutor and genuine external WebMCP
agents. Include grouped issues, proposal warnings, connection loss, checkpoint
resume, pause/discard, acceptance/rejection, Undo/Redo, stale writes, and
continued reading during repair.
