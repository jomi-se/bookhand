# VAL-STORAGE-FALLBACK: Honest session-only fallback

Surface: browser and data.
Needs: VAL-STORAGE-BACKEND and test-only OPFS failure injection.
Behavior: Forced OPFS unavailability opens an in-memory SQLite library with a persistent visible `This session will not be saved` warning. Bookhand never claims persistence, and session-only imported state disappears after a true browser-session reset.
Evidence: Forced-failure trace, worker mode diagnostic, warning screenshots across library/reader, and new-session proof that the imported record is absent and only the configured bootstrap baseline remains; with bootstrap registration disabled, the normal empty-library state appears.
