# CK Engine Job Branch Bundle Template

## Job

- `jobId`: `{{JOB_ID}}`
- `branchName`: `ck/job/{{JOB_ID}}`
- `worktreePath`: `.ck-worktrees/{{JOB_ID}}`
- `targetId`: `{{TARGET_ID}}`
- `operator`: `{{OPERATOR}}`
- `role`: `{{ROLE}}`

## Role Contract

`{{ROLE_CONTRACT}}`

## Skills

`{{SKILL_CONTRACTS}}`

## Recipe

`{{RECIPE}}`

## Field Context

`{{FIELD_CONTEXT}}`

## Required Output

Edit canonical field YAML directly inside the job worktree. Commit all changes on `ck/job/{{JOB_ID}}` before handoff.

Expected handoff:

- canonical field files updated in the worktree,
- `jobs/active/{{JOB_ID}}.yaml` still records the job branch and verification command,
- `git status --short` in the job worktree is clean,
- a short summary of changed files, unresolved questions, and verification readiness.
- raw branch, commit, and artifact pointers that the parent orchestrator can add to its continuity handoff without replaying the worker transcript.

Worker completion returns to the existing parent orchestrator arc. It is a continuity checkpoint, not an automatic reason to replace that parent conversation.

The orchestrator runs `pnpm run ck:job-status -- {{JOB_ID}}`, `pnpm run ck:job-verify -- {{JOB_ID}}`, and only squash-merges after branch verification passes.

## Forbidden Effects

- no hidden state outside the repository,
- no direct mutation of `main` from the worker worktree,
- no `K_TO_E` operator,
- no handoff with uncommitted changes.
