# CK Continuity Handoff

Create this artifact only for an actual `COMPACT` or `HANDOFF` recommendation or before harness-forced compaction. Store it at the canonical path defined in `.agents/skills/context-continuity.md`; do not create it for ordinary `CONTINUE` or `FORK` decisions.

## Identity And Freshness

- updatedAt: `{{ISO_TIMESTAMP}}`
- authoredBy: `{{AGENT_AND_HARNESS}}`
- sourceSession: `{{SESSION_OR_THREAD_ID}}`
- recommendedMode: `CONTINUE | COMPACT | FORK | HANDOFF`
- confidence: `HIGH | MEDIUM | LOW`

## Current Objective

`{{OBJECTIVE_AND_SUCCESS_CONDITION}}`

## Continuity Assessment

- continuityValue: `HIGH | MEDIUM | LOW` — `{{WHY}}`
- contextPressure: `HIGH | MEDIUM | LOW` — `{{WHY}}`
- contextPollution: `HIGH | MEDIUM | LOW` — `{{WHY}}`
- boundaryStrength: `HIGH | MEDIUM | LOW` — `{{WHY}}`
- riskIfRestarted: `{{TACIT_OR_EXPLICIT_CONTEXT_AT_RISK}}`
- riskIfContinued: `{{NOISE_COST_OR_STALE_STATE_RISK}}`

## Canonical And Proposal State

`{{ACCEPTED_STATE_VS_JOB_BRANCHES_WORKTREES_COMMITS}}`

## Decisions And Rationale

`{{DECISIONS_WHY_REJECTED_ALTERNATIVES_AND_SUPERSESSION_HISTORY}}`

## Open Tensions And Unknowns

`{{UNRESOLVED_CONFLICTS_REVERSIBLE_CHOICES_EVIDENCE_GAPS}}`

## Operator Working Preferences

`{{ONLY_PREFERENCES_RELEVANT_TO_THIS_ARC}}`

## Verification And Review State

`{{COMMANDS_RESULTS_CRITIC_VERDICTS_BLOCKERS}}`

## Exact Next Action

`{{NEXT_ACTION_OWNER_AUTHORITY_AND_STOP_CONDITION}}`

## Retrieval Index

- raw sessions/threads: `{{IDS_AND_PATHS}}`
- primary files: `{{PATHS}}`
- relevant commits/diffs: `{{COMMITS}}`
- supporting artifacts: `{{PATHS}}`

## Handoff Readiness

- [ ] dirty state is absent or explicit
- [ ] branches and commits resolve
- [ ] accepted state and proposals are distinguished
- [ ] recent corrections and rejected alternatives are represented
- [ ] uncertainty remains uncertainty
- [ ] raw history and primary evidence can be retrieved
- [ ] operator was told the trade-off and available modes
