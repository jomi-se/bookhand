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
- Slices 1, 2, and 3 are implemented. Bookhand is a working local-first reader
  whose reading and study capabilities are registered as WebMCP tools. W7, the
  judged-surface check, is the only Slice 1 item still open.
- Slice 2: highlights and notes on CFI ranges drawn over the book, one study
  board per book in docked and expanded views, and prose/quotation/equation/
  steps/question blocks that each carry the source range they came from.
- Slice 3: eleven tools registered through `document.modelContext`. `list_books`
  and `open_book` are offered from first load; a book's reading and study tools
  join them when it opens. Every tool calls `BookhandCommands`, the same surface
  the interface calls. Book text is returned inside an untrusted-data boundary,
  agents can only anchor to ranges tools returned, and every call is listed in
  the study board as it happens.
- Evidence: 106 unit tests and 8 Playwright specs against the production build,
  including an end-to-end agent path driven through a stand-in runtime installed
  before the app loads.
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
- Slice 1 W4 through W6 are implemented. The library is the approved quiet
  catalog with data-driven bundled-book registration, checksum verification,
  import with named rejections, truthful continuation state, and a footer
  reporting the real storage mode. The reader carries chrome, an adjacent
  contents drawer and text panel, previous/next, selection with `Study this`,
  a study shell, style-before-location restore, and debounced persistence.
  Containment is proven against the malicious corpus through the production
  build, and reader-supplied CSS is bounded at the source.
- Two defects were found by driving the real product rather than by testing.
  The reader adapter cleared the selection on every relocate, and the paginator
  relocates whenever its box changes, so opening the Study panel silently
  dropped the passage just selected. The containment test also initially
  asserted that no off-origin request was attempted; a CSP-blocked request
  still raises a request event, so the assertion now requires that no
  off-origin response arrived and that every attempt was refused with `csp`.
- An independent review of W2 and W3 found and fixed four defects the parallel
  lanes missed: the storage client hung forever after a worker `error` event
  because it never stopped accepting requests; no storage request had any
  deadline, so `LIBRARY_LOAD_DEADLINE_MS` existed but bounded nothing;
  `ReaderHost` synced an options ref the adapter never read again, freezing
  callbacks at their mount-time closures; and `dispose()` double-sent `close`
  and rethrew into React cleanup paths.

## Submission state

The WebMCP Challenge closes 2026-09-03T20:00Z. Required and still open:

- The GitHub repository is private and must be public with a detectable
  license. `LICENSE` (MIT) is committed; making the repo public is the owner's
  action, deliberately not automated.
- Nothing is pushed yet; `origin/main` is far behind local.
- No live URL. `wrangler.jsonc` matches the working `jomi-se-blog` pattern on
  this machine, and `docs/deployment.md` records the flow: Cloudflare Workers
  Builds pulls from GitHub on every push to `main`, builds `./dist`, and deploys
  it as Worker static assets. No Cloudflare credential lives in this repository;
  the owner connects the repo once from the Cloudflare dashboard and attaches
  bookhand.dev there as a custom domain. `npm run deploy` stays as a manual
  escape hatch only.
- A public YouTube demo video under three minutes, with audio covering what was
  built and how WebMCP was used, is a hard requirement.

## Next actions

1. Confirm the real storage mode, the WebMCP tools, and the hero flow in the
   ChatGPT **desktop** app's built-in browser, which is the judged surface under
   ADR 0003 and its 2026-09-01 amendment. This is the largest remaining unknown:
   the agent path has only been proven against a stand-in runtime. It cannot be
   closed on this VM — Linux ARM64 has no Chrome build, no system Chromium is
   installed, and Playwright's bundled Chromium does not expose WebMCP through
   `--enable-features`. Nor can the Pixel 7 close it: WebMCP shipped in the
   ChatGPT desktop app, not the Android one. The owner runs this check on their
   desktop against deployed bookhand.dev. An in-app browser may also refuse OPFS
   sync access handles, in which case the session-only fallback becomes the
   judged path and must read as truthful.
2. Deploy to bookhand.dev and confirm the live URL in the judged surface.
3. Slice 4 and 5 remain unbuilt and are the documented cut order: semantic
   search first, then generated labs. Neither is required for the submission.
4. Continue through the slices in order; preserve the Slice 3 submission
   checkpoint before adding semantic retrieval or generated labs.
5. Use the real Chapter X content from the bundled EPUB; the approved mock's
   prose and figure are illustrative and must not be copied into the reader.

## Handoff notes

- `npm run dev` does not work by design: the production CSP blocks the dev
  server's inline React preamble. Use `npm run build && npm run preview`.
- Sudo is not available to agents on this machine, and that is deliberate. Ask
  the owner to run privileged commands, saying why it helps.

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
