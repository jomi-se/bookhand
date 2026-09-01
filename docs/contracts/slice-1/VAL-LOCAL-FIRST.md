# VAL-LOCAL-FIRST: Read without backend, model, or upload

Surface: browser and network.
Needs: VAL-STORAGE-ROUNDTRIP, VAL-READER-OPEN, VAL-READER-NAV, VAL-READER-SELECTION, VAL-READER-STYLE, VAL-READER-RESTORE, and VAL-EPUB-RESOURCE-POLICY.
Behavior: With every non-origin request blocked, a person can open, navigate, select, style, persist, reload, and reopen a bundled or imported book. No backend, account, model, agent, book-byte upload, or book-text upload is attempted.
Evidence: Successful browser flow with non-origin routes blocked, complete request log, persistence/reopen observation, and source scrutiny for backend/model clients.
Scope: This does not promise offline reload of the app shell unless a service worker is separately accepted.
