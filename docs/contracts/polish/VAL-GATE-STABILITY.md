# VAL-GATE-STABILITY: Repeatable clean verification

Surface: repository test harness.
Needs: installed pinned dependencies and no unrelated test processes.
Behavior: Three sequential clean `npm run verify` executions at one commit pass without retry, leaked preview servers, fixed-port collision, or bundled-book bootstrap failure; each run cleans its owned processes and preserves a bounded full log.
Evidence: Commit hash, environment/version record, three quiet-run log paths and exit codes, post-run port/process check, and failure artifacts if any attempt fails. An occupied-port behavior claim requires its own deliberate setup and is not inferred from these runs.

