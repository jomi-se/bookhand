# Current work

Last updated: 2026-09-01

## Goal

Deliver one polished reader-to-tutor vertical slice for the WebMCP hackathon.

## State

- Repository and cross-harness agent environment initialized.
- Product North Star, boundary, and first architecture decision recorded.
- Readest/Reedy lessons have been extracted without adopting its full stack.
- A real Chromium comparison of SQLite WASM, browser `sqlite-vec`, and
  Dexie/MiniSearch replaced the speculative IndexedDB choice. The accepted path
  is official SQLite WASM + `opfs-sahpool` + FTS5 + packed vector BLOBs + exact
  JavaScript cosine in a dedicated database worker.
- The complete report is
  `docs/research/2026-09-01-sqlite-wasm-vs-indexeddb-report.md`; the reproducible
  desktop harness is `experiments/sqlite-browser-storage-spike/`.
- Browser-local storage, retrieval, embedding, WebMCP, and study-board defaults
  are settled in `docs/architecture/implementation-defaults.md` and ADR 0002.
- The delivery order and cut order are settled in
  `docs/plan/vertical-slice-build-order.md`.
- Application remains the generated Vite shell; the W1 foundation, W2 storage,
  and W3 reader adapter are in place, but no product surface consumes them yet.
- Bookhand naming and the approved Slice 1 visual system are committed; the
  reader/library implementation mission is now active.
- Slice 1 scope, work topology, and reviewed validation contracts live in
  `docs/plan/slice-1-reader.md`, `docs/plan/slice-1-build-tasks.md`, and
  `docs/contracts/slice-1/`.
- The official Gutenberg EPUB3 of *Calculus Made Easy*, its extracted cover,
  checksums, and provenance are staged under `public/books/`.
- Slice 1 W1 is implemented: Foliate.js is pinned to upstream commit
  `78914aef4466eb960965702401634c2cb348e9b1`; official SQLite WASM, self-hosted
  fonts, icons, and the Vitest/Testing Library/Playwright harness are installed;
  production CSP and static SQLite assets are configured; serializable reader
  and storage types plus the shared five/ten-second deadlines are defined.
- The deterministic CC0 corpus under `tests/fixtures/epub/` covers nested TOC,
  selectable text, SVG/MathML alternatives, malicious capability/resource
  sentinels, corrupt input, unsupported input, long metadata, and missing cover.
  Fixed hashes and ZIP/package invariants are tested.
- Validation-only controls wrap neutral storage/library/reader ports from a
  test-only module. Production bundle scanning and a real preview-browser probe
  show the named globals, messages, query parameters, errors, and raw-state
  controls are absent. Full real adapter/worker failure-and-recovery traces stay
  open until W2 and W3 provide those paths; W1 does not claim them synthetically.
- Slice 1 W2 is implemented: one dedicated worker owns one official SQLite `oo1`
  connection over `opfs-sahpool`, with the STRICT schema, FTS5 chunk triggers,
  SHA-256 content identity, a runtime-validated typed protocol in both
  directions, in-memory session fallback, second-tab lock classification and
  Retry, and a one-time durable-storage claim.
- Slice 1 W3 is implemented: the imperative Foliate adapter and its React host
  boundary provide metadata, nested TOC, sections, location, passage, selection,
  and section snapshots; navigation and style primitives; revision-guarded
  lifecycle safety; the open deadline; and test-only fault seams. Foliate
  internals stay private to the adapter; callers see only `ReaderAdapter`.
- ADR 0003 records that the judged surface is an embedded agent browser on a
  mobile-sized viewport, not a specific handset. Physical Pixel 7 evidence is
  now best effort and no longer gates Slice 1; mobile layout, touch, and
  selection ergonomics keep their contracts, while the Android-native drill set
  is cut. Submissions close 2026-09-03T20:00Z.
- An independent review of W2 and W3 found and fixed four defects the parallel
  lanes missed: the storage client hung forever after a worker `error` event
  because it never stopped accepting requests; no storage request had any
  deadline, so `LIBRARY_LOAD_DEADLINE_MS` existed but bounded nothing;
  `ReaderHost` synced an options ref the adapter never read again, freezing
  callbacks at their mount-time closures; and `dispose()` double-sent `close`
  and rethrew into React cleanup paths.

## Next actions

1. Confirm the real storage mode and hero flow in the embedded agent browser
   ADR 0003 names as the judged surface. An in-app browser may refuse OPFS sync
   access handles, in which case the session-only fallback becomes the judged
   path and must read as truthful rather than broken.
2. Implement W4, the library product surface, against the W2 client and W3
   adapter. `VAL-LIBRARY-CATALOG` needs the five-second bound surfaced as a
   named recoverable error with Retry; the client now raises
   `storage-request-timed-out` and the `leave-library-list-unresolved` control
   drives it, so W4 owns the UI, not the mechanism.
3. Execute W5 through W7 in `slice-1-build-tasks.md`; preserve independent
   scrutiny, browser, and physical-device evidence.
4. Continue through the slices in order; preserve the Slice 3 submission
   checkpoint before adding semantic retrieval or generated labs.
5. Use the real Chapter X content from the bundled EPUB; the approved mock's
   prose and figure are illustrative and must not be copied into the reader.

## Handoff notes

- The product is named Bookhand; *Calculus Made Easy* is the temporary bundled
  judging book and must remain removable without changing the library model.
- Devpost OAuth is user-owned and is not stored in this repository.
- Impeccable is installed as a skill but automatic hooks are deliberately off.
- Regenerate the authored EPUB test corpus only with
  `npm run fixtures:generate`; an intentional fixture change must update the
  fixed hashes in `tests/unit/fixtures.test.ts`.
- `npm run verify` now includes unit tests, the production exclusion scan, and
  the real Playwright production-control probe. Playwright Chromium revision
  1234 is installed on the current ARM64 VM; a fresh environment must run
  `npx playwright install chromium` once.
- Do not follow older SQLite browser tutorials using Worker1/Promiser or the
  header-requiring `opfs` VFS. ADR 0002 records the measured 2026 choice.
- Update this file whenever a completed step changes what the next agent should
  do.
