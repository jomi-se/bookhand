# VAL-LIBRARY-IMPORT: Import, validate, and deduplicate EPUBs

Surface: browser and data.
Needs: VAL-STORAGE-ROUNDTRIP and valid/corrupt/unsupported fixtures.
Behavior: Picker cancel leaves state unchanged; a valid local EPUB imports visibly; SHA-256-identical bytes resolve to one record; corrupt and unsupported inputs name the problem, preserve all prior books, and offer Try another file. Import cannot replace the current library until validation and persistence succeed.
Evidence: Picker-cancel trace; valid-import screenshot and database row/hash; identical re-import row count; corrupt/unsupported error and recovery traces; before/after prior-library state.

