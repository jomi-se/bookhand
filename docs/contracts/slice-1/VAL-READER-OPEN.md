# VAL-READER-OPEN: Open a known valid book

Surface: browser.
Needs: VAL-READER-ENGINE, VAL-LIBRARY-BOOTSTRAP, a persisted valid book, and test-only unresolved-open injection.
Behavior: Opening a known book shows a loading state that resolves to flattened title/author metadata and real first readable content or reaches a named recoverable timeout within ten deterministic seconds. It never hangs indefinitely or substitutes hard-coded content; Retry succeeds after the injection clears.
Evidence: Fresh browser screenshots, timing/clock evidence, and console/network logs for hero, deterministic, unresolved-timeout, and successful Retry cases; visible metadata/text compared with each EPUB package document.
