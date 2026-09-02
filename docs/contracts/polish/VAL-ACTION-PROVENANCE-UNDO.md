# VAL-ACTION-PROVENANCE-UNDO: Durable provenance and grouped reversal

Surface: browser and storage worker.
Needs: `VAL-STUDY-ID-OWNERSHIP` and persistent study items.
Behavior: Annotation and existing native study-item mutations record user or agent provenance plus an action-group ID; book import/removal, reader style, board view, and the later study-experience type are outside this contract. The interface identifies agent work and offers Undo. Undo of creation removes the created records; Undo of update restores the immediately prior version; both preserve unrelated work and interleaved later user edits through field/version conflict handling. Undo and Delete have distinct visible semantics.
Evidence: Schema/worker round trip for annotations and native items; grouped creation and update; reload then creation/update Undo traces; interleaved user edit preservation and conflict result; visible provenance and distinct Undo/Delete copy and results.
