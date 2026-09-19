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

## Boundary vocabulary

- **Foliate fork:** the pinned MIT dependency that supplies EPUB parsing and
  rendering behavior. It is not Bookhand or the Readest application.
- **Reader adapter:** Bookhand's stable boundary around the Foliate fork. Use
  this term instead of the ambiguous “reader engine” when referring to the
  integration seam.
- **Reader subsystem:** the complete Bookhand-owned reading capability around
  the Foliate fork, including product policy and connections to persistence,
  search, repair, UI, Tutor, and WebMCP.
- **Tutor subsystem:** the optional, provider-neutral capability that connects
  an AI to Bookhand and coordinates conversation and temporary guidance. It is
  not required for ordinary reading.
- **Reading-quality baseline:** the journeys, qualities, and known failure
  patterns used to judge a mature reading experience. Readest supplies
  hard-earned lessons and a quality reference, not a product to copy.
