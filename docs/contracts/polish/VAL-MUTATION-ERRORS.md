# VAL-MUTATION-ERRORS: Atomic failures are visible and recoverable

Surface: UI, command API, and storage worker.
Needs: test-only worker fault injection and production exclusion controls.
Behavior: Rejected annotation, native study-item, reader-style, and board-view UI/tool mutations leave storage, overlays, mounted state, and unrelated content unchanged; the UI shows a bounded recoverable error; retry succeeds after the injected fault clears; no promise rejection is lost. The later study-experience atomicity target is owned by `VAL-STUDY-EXPERIENCE-LIFECYCLE`.
Evidence: Fault at each existing-mutation write boundary; before/after database and UI snapshots; console/unhandled-rejection trace; visible Retry; successful retry; production bundle exclusion of fault controls.
