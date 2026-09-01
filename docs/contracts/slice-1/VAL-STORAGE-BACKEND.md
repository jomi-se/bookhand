# VAL-STORAGE-BACKEND: Mandated SQLite worker and VFS

Surface: data.
Needs: official `@sqlite.org/sqlite-wasm` runtime.
Behavior: One dedicated worker owns one official SQLite `oo1` connection over `opfs-sahpool` for its lifetime and exposes a typed, runtime-validated request/response protocol. The production path uses no Worker1/Promiser API, `localStorage`, IndexedDB/Dexie, second SQLite owner, or parallel persistent application store.
Evidence: Dependency/lock artifact; integration diagnostic showing SQLite version, `opfs-sahpool`, schema, and worker context; message validation tests; source scrutiny for banned APIs and connection owners.

