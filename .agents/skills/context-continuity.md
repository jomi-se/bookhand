# Context Continuity And Handoff

## Mission

Preserve the operator-agent reasoning relationship while controlling context cost and noise. Treat conversation history as evidence and working memory, not disposable chat and not canonical CK state.

## Core Rule

Continuity is the default for one coherent operator-facing reasoning arc. Do not start a fresh orchestrator session merely because a worker committed, a gate ran, or a nominal phase changed. A fresh context is a quality-affecting intervention that needs a reason, a continuity artifact, and an archive pointer.

Workers, critics, validators, and evidence checkers remain bounded contexts. Their independence and narrow evidence packets are not a reason to break the parent operator conversation.

## Continuity Modes

Choose exactly one mode at each checkpoint:

1. `CONTINUE`: keep the current parent conversation. Use when the goal and reasoning arc are coherent and prior nuance remains useful.
2. `COMPACT`: retain the same conversation but summarize older turns. Use when context pressure is material and the current arc still benefits from shared history.
3. `FORK`: create a bounded child or parallel thread with a specific evidence packet. Use for independent criticism, alternative exploration, or work that should not anchor on the parent transcript.
4. `HANDOFF`: prepare a fresh parent context. Use for a genuine goal/phase discontinuity, severe context pollution, repeated stale-state mistakes, harness limits, or an operator request.

`CONTINUE` is the default only when no decision row below recommends another mode. Cost alone is not sufficient to choose `HANDOFF`, but a completed semantic subtask plus material context pressure can justify `COMPACT` even when the larger CK goal continues.

## Signals

Assess these signals when an existing event makes the question relevant: a human scope change, recovery loop, visible harness context warning, forced compaction, or evidence of stale-state confusion. A job result is semantic evidence, not by itself a requirement to assess or emit a record.

- **Continuity value** — `HIGH` for active debate, evolving preferences, unresolved tensions, creative synthesis, or rationale-heavy decisions; `MEDIUM` for a stable objective with useful prior decisions; `LOW` for a fully materialized mechanical next step.
- **Context pressure** — `LOW` without warnings or rediscovery; `MEDIUM` for a long transcript, completed subtopics, or rising replay cost; `HIGH` for imminent/forced compaction, premium long-context thresholds, repeated retrieval misses, or stale history dominating calls.
- **Context pollution** — `LOW` when current state is consistent; `MEDIUM` with several superseded plans; `HIGH` when observable evidence shows obsolete branch/commit references, repeated rediscovery, operator corrections of stale state, contradictory accepted/proposal claims, or repeated recovery from the same context mistake. Do not rely only on the active agent noticing its own confusion.
- **Boundary strength** — `LOW` for the same goal; `MEDIUM` for a new CK operator within the same question; `HIGH` for a changed goal, field, governance decision, or independent mission.

Do not add a CK runtime monitor or model call merely to calculate these signals. Use context warnings and telemetry already exposed by the harness, existing job events, the transcript, and operator corrections. Token/context utilization may trigger assessment, but no universal cross-model token threshold determines the outcome.

## Decision Policy

First choose `FORK` when the next work requires independence or a deliberately isolated alternative; this axis does not depend on parent continuity/pressure ratings. Otherwise use the total parent-thread table:

| Continuity value | Pressure | Pollution or boundary | Mode |
|---|---|
| `HIGH` | `LOW` or `MEDIUM` | pollution below `HIGH`, boundary below `HIGH` | `CONTINUE` |
| `HIGH` | `HIGH` | pollution below `HIGH`, boundary below `HIGH` | recommend `COMPACT` |
| `MEDIUM` | `LOW` | pollution below `HIGH`, boundary below `HIGH` | `CONTINUE` |
| `MEDIUM` | `MEDIUM` or `HIGH` | a completed semantic subtask can be separated from the active arc | recommend `COMPACT` |
| `MEDIUM` | `MEDIUM` or `HIGH` | history remains tightly coupled to the active decision | `CONTINUE`, but surface the trade-off when pressure is `HIGH` |
| `LOW` | `LOW` | boundary below `HIGH` | `CONTINUE` without ceremony |
| `LOW` | `MEDIUM` or `HIGH` | boundary below `HIGH` | recommend `COMPACT` |
| any | any | pollution `HIGH` and a handoff is ready | recommend `HANDOFF` |
| `LOW` or `MEDIUM` | any | boundary `HIGH` and a handoff is ready | recommend `HANDOFF` |
| any | any | compaction/handoff is indicated but the artifact is not ready | `CONTINUE` long enough to repair it |

When the evidence does not fit a row, choose `CONTINUE`, name the uncertainty only if it affects the operator, and do not write a mode record.

## Automatic Authority

The orchestrator may automatically fork bounded specialists, warn about context pressure already visible in the harness, and recover from harness-forced compaction. It must ask or clearly instruct the operator before intentionally compacting or replacing the parent conversation unless the harness compacts automatically. Never silently archive, delete, or abandon the parent thread.

## Operator Checkpoint

When `COMPACT` or `HANDOFF` is recommended, state the mode, triggering signals, continuity at risk, preserved artifact and archive locations, the alternative of continuing, and the exact harness action if the agent cannot perform it. Do not ask the operator to reconstruct technical state manually.

## Continuity Artifact

Create or refresh a Markdown handoff using `.agents/bundles/continuity-handoff-template.md` only when `COMPACT` or `HANDOFF` is actually recommended, or immediately before harness-forced compaction. Ordinary `CONTINUE` and `FORK` decisions do not create or refresh this artifact.

Use one predictable location:

- bounded job: `fields/<field>/jobs/active/<job-id>-continuity.md`;
- field-level operator arc: `fields/<field>/handoffs/continuity.md`;
- repository-wide mission: `docs/02-implementation-guidance/handoffs/<mission-id>.md`.

Create the parent directory when needed. Do not place continuity handoffs at repository root. The artifact must contain the objective; accepted versus proposal state; branches, worktrees, and commits; decisions and rationale; rejected alternatives and supersession history; open tensions and reversible choices; relevant operator preferences; next action and authority; verification state; raw conversation identifiers; primary file pointers; freshness; and authoring harness.

A handoff is an index into preserved evidence, not a replacement for the archive. Never claim it is lossless.

## Handoff Readiness Gate

Before recommending a fresh parent context, verify that dirty state is absent or explicit; branches and commits resolve; accepted state is distinguished from proposals; corrections and rejected alternatives are represented; uncertainty remains uncertainty; raw sessions and primary files are locatable; and the operator knows continuing remains available unless a harness limit prevents it. If any check fails, remain in `CONTINUE`, repair the artifact, and reassess.

## Harness Mapping

### Codex

- Continue or resume the saved thread when continuity remains valuable.
- Use native subagents or a thread fork for bounded independent work.
- `/compact` summarizes the visible conversation; refresh the continuity artifact first.
- `/fork` preserves history in a new task and is preferable to a blank restart for alternatives.
- `/resume` returns to saved work; `/new` is a genuine fresh task.
- Recommend the exact user-facing action when the active surface exposes no callable lifecycle operation.

### Claude Code

- Continue or resume the existing session when continuity remains valuable (`--continue` or `--resume <session-id>` from the CLI).
- Use Claude subagents for bounded independent work.
- Refresh the continuity artifact before operator- or harness-triggered compaction and recover from it afterward.
- Give a fresh session the artifact and raw prior-session identifier; do not paste the entire transcript by default.

Harness commands are adapters. This decision policy and artifact are canonical.

## Anti-Patterns

- fresh parent session after every job or phase by rote;
- summary-only restart with no archive pointer;
- entire-transcript replay into every specialist;
- treating cache hits as proof that old context is useful;
- allowing a handoff to erase refutations, uncertainty, or superseded state;
- automatic parent-thread deletion, archival, or replacement without operator awareness.
