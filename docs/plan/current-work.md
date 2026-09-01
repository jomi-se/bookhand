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
- Application remains the generated Vite shell; reader work has not started.

## Next actions

1. Run the preserved SQLite spike's Pixel 7 drills when the phone is available:
   indexing/query timings, reload mid-batch, app background/resume, memory, and
   second-tab behavior. Record results without blocking desktop implementation.
2. Execute Slice 1 from `vertical-slice-build-order.md`: reader, hero EPUB,
   stable selection/CFI, position persistence, and minimum presentation controls.
3. Continue through the slices in order; preserve the Slice 3 submission
   checkpoint before adding semantic retrieval or generated labs.
4. Update this ledger with the chosen hero book and passage as soon as they are
   known.

## Handoff notes

- The product is now named Bookhand; the hero book remains a placeholder until
  Slice 1 chooses it.
- Devpost OAuth is user-owned and is not stored in this repository.
- Impeccable is installed as a skill but automatic hooks are deliberately off.
- Do not follow older SQLite browser tutorials using Worker1/Promiser or the
  header-requiring `opfs` VFS. ADR 0002 records the measured 2026 choice.
- Update this file whenever a completed step changes what the next agent should
  do.
