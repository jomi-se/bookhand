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
- Application remains the generated Vite shell; the W1 reader foundation is in
  place, but storage, adapter, and product-surface behavior have not started.
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

## Next actions

1. Run the preserved SQLite spike's Pixel 7 drills when the phone is available:
   indexing/query timings, reload mid-batch, app background/resume, memory, and
   second-tab behavior. Record results without blocking desktop implementation.
2. Implement W2, the official SQLite WASM worker and persistent library store,
   using the W1 request types, runtime ports, deadlines, fixtures, and test-only
   control seam. Then implement W3 behind the same boundary.
3. Execute W4 through W7 in `slice-1-build-tasks.md`; preserve independent
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
