# VAL-TEST-CONTROL-INTEGRITY: Keep fault injection out of production

Surface: artifact and browser.
Needs: production build and test build/harness.
Behavior: Production routes, globals, messages, query parameters, and bundles cannot enable OPFS failure, stale-open delay, unresolved book open, unresolved library list, immediate library-list failure, section failure, raw state dump, mutation-boundary failure, `indexPauseAfterCommittedBatch`, `indexFailBeforeChunk`, or `experienceFailBeforeCommit`. The test build injects those faults through the real adapter/worker/domain paths rather than synthetic replacement UI. Adding any fault seam requires adding its exact identifier and production invocation probes here.
Evidence: Production-bundle/source scan; failed browser attempts through globals, messages, events, query parameters, and tool inputs to invoke every named test hook in production; test-build traces showing real failure and recovery paths with adapter/worker diagnostics.
