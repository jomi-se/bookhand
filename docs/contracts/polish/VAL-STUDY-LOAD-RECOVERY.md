# VAL-STUDY-LOAD-RECOVERY: Study failure is visible and recoverable

Surface: study hooks, command paths, storage worker, and browser.
Needs: `VAL-MUTATION-ERRORS` and test-only fault seams excluded from production.
Behavior: Initial Study load, annotation edit/removal, item/lesson mutation, and refresh failures produce bounded user-facing states with Retry or a precise next action. A stale successful snapshot may remain visibly labeled rather than becoming an empty board. Repeated Retry is idempotent, focus is managed, and failure in one stream does not erase the other. No promise rejection is silently dropped.
Evidence: Deterministic await-boundary faults for load and every mutation family; visible error/accessibility assertions; retry success and repeated-retry state; stale-snapshot and partial-stream cases; unhandled-rejection listener; production exclusion scan for controls.
