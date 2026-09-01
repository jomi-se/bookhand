# VAL-STORAGE-ROUNDTRIP: Persist books and reading state transactionally

Surface: data and browser.
Needs: VAL-STORAGE-BACKEND and valid EPUB fixture.
Behavior: Through the real worker protocol, SHA-256 identifies book bytes; original bytes, flattened metadata, location records, and style records survive worker/page teardown and read back exactly; identical bytes remain one record; no partial import becomes visible.
Evidence: Before/after worker diagnostic rows and hashes; byte checksum and record comparison after worker/page teardown; identical-import row count; injected failed-import rollback observation.
