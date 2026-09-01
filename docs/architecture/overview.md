# Architecture overview

The proof of concept is a single client-side web application with four explicit
boundaries:

1. **Reader adapter** — the narrow Foliate.js integration responsible for EPUB
   loading, rendition, navigation, selection, and location mapping.
2. **Local domain store** — official SQLite WASM in one dedicated worker,
   persisted through `opfs-sahpool`, holding books, reading state, annotations,
   study boards, FTS5 chunks, and packed vector BLOBs.
3. **WebMCP capability layer** — typed tools backed by domain operations, never
   direct DOM scripting as the primary contract.
4. **Study renderer** — trusted native blocks and a visibly bounded generated
   lab surface for richer one-off teaching artifacts.

The agent observes and changes the application through the same domain
operations used by the UI. Generated content does not receive implicit access
to the reader's storage or surrounding page.

The concrete fast-path choices and complexity gates are defined in
`implementation-defaults.md`.
