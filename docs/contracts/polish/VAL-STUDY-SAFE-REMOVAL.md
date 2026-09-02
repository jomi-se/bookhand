# VAL-STUDY-SAFE-REMOVAL: Removal is deliberate and recoverable

Surface: study and annotation UI, command API, storage, and browser.
Needs: `VAL-ACTION-PROVENANCE-UNDO` and `VAL-STUDY-EXPERIENCE-LIFECYCLE`.
Behavior: Removing an item, lesson, highlight, or note is never an unrecoverable one-click surprise. The interface uses a confirmation where context would otherwise be ambiguous and always offers a visible Undo backed by a persisted tombstone for ten minutes, so reload within that interval restores the exact record, ordering, source relationship, provenance, and revision. Expired tombstones are purged. If an interleaved edit or recreated identity makes exact restoration unsafe, Undo reports a conflict and changes nothing. Agent tools cannot permanently delete user-owned content. Bulk reset states exact scope before applying it.
Evidence: Pointer/keyboard removal traces for every record kind; cancel and Undo; interleaved-edit conflict with no overwrite; reload inside and after the ten-minute interval; tombstone purge; agent rejection; bulk-scope copy and unrelated-content snapshots.
