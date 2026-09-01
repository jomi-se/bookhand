# VAL-LIBRARY-CATALOG: Truthful local catalog and continuation state

Surface: browser and data.
Needs: VAL-LIBRARY-BOOTSTRAP, VAL-LIBRARY-IMPORT, VAL-STORAGE-ROUNDTRIP, test-only unresolved-list injection, and test-only library-list-failure injection.
Behavior: Database loading reaches the catalog or a named recoverable error within five deterministic seconds. Every stored book appears exactly once in the ruled all-books list with cover or intentional fallback, title, author, EPUB format, truthful progress, and last-read context. Continue reading is absent before meaningful progress and appears for the correct book/source after progress persists. Retry successfully reloads after the injected fault clears. The footer states the actual local persistent or session-only mode.
Evidence: Fresh/loading/loaded/continued/timeout/error/retry screenshots with timing/clock evidence; database-row-to-list comparison; progress/source comparison; missing-cover and long-metadata fixtures; footer text compared with worker mode diagnostic.
