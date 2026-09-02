# Current work

Last updated: 2026-09-02

## Next action

W1, W2, and W3 are implemented with evidence. Next is a review pass, then W5 —
the generated study experience, which is what makes the submission worth
judging.

W2 gave the reading style and the study board one owner each
(`src/app/presentation.ts`, `src/app/surface.ts`). Both are shared state the
interface and the tools write through, so a tool change reaches the controls
and storage, a control change cannot carry a stale snapshot back over an
agent's, and the board's `focus` and `close` modes exist at all. Custom EPUB
CSS now requires the current `get_design_context` version.

W3 rebuilt the reader's mobile interaction. The outcome, the measurements, and
what is still open are recorded at the end of
`docs/reviews/2026-09-02-pixel-7-reader-diagnosis.md`. Seven of its eight
defects are closed; Defect 2 (the per-section iframe rebuild) is improved but
not gone, and Defect 6 needs a real Android device rather than emulation.

W7 (`VAL-COMPOSITION-QUALITY`) was added on 2026-09-02 after the owner observed
that nothing in this mission measures whether a frontier model given these
affordances composes anything worth reading. It runs after W5.

The wave order is being read as a dependency graph rather than a chain, because
the deadline is 2026-09-03T20:00Z. W5 is what makes the submission worth
judging: without it there is a well-behaved reader and nothing to demonstrate.
W4 (`VAL-INDEX-LIFECYCLE`, `VAL-SEARCH-BOOK`) depends only on W1 and can be
taken at any point.

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
  whose reading and study capabilities are registered as WebMCP tools. The
  post-Slice 3 audit found important trust and mobile-interaction gaps before
  the generated teaching showcase.
- Slice 2: highlights and notes on CFI ranges drawn over the book, one study
  board per book in docked and expanded views, and prose/quotation/equation/
  steps/question blocks that each carry the source range they came from.
- Slice 3: eleven tools registered through `document.modelContext`. `list_books`
  and `open_book` are offered from first load; a book's reading and study tools
  join them when it opens. Every tool calls `BookhandCommands`, but style and
  board-view tool mutations do not yet share the mounted interface's observable
  state path. Book text is returned inside an untrusted-data boundary, but
  exact range/quote ownership is not yet enforced before mutation. Every call
  is listed in the study board as it happens.
- Evidence: 110 unit tests and 7 Playwright tests against the production build,
  including a deterministic scripted path through Chromium's genuine
  `document.modelContext` runtime. This proves tool registration and execution;
  it does not yet prove model-authored lesson quality.
- The 2026-09-01 post-Slice 3 audit is recorded at
  `docs/reviews/2026-09-01-post-slice-3-polish-audit.md`. The active mission and
  validation contracts are `docs/plan/polish-and-showcase-mission.md` and
  `docs/contracts/polish/`.
- Five sequential independent contract-review passes closed every material
  acceptance-oracle issue in the original mission. The topology was reopened
  on 2026-09-02 for the newly identified browser-agent design-context gap.
  Three sequential review rounds resolved the amended contract and ownership
  issues, and final verification passed; W0 through W6 are frozen again in
  `docs/plan/polish-and-showcase-build-tasks.md`.
- First post-audit fixes are implemented: the real file-import path reaches the
  one-time durable-storage request; SQLite rejects study-item IDs owned by a
  different book; the unnecessary Cloudflare COOP header is removed; reader
  themes now cover the whole shell; mobile toolbar controls retain accessible
  names; panel focus enters and returns correctly; current TOC state is exposed;
  hidden-book arrow navigation is guarded; and Study authoring targets meet 44
  pixels. The larger mobile chrome/gesture redesign and remaining W1 trust work
  are still open.
- Impeccable 4.1.3 project context is reconciled with the repository-facing
  product and design sources.
  `PRODUCT.md` now follows the current product schema, and `DESIGN.md` plus
  `.impeccable/design.json` define “The Working Library” as both the strong
  default and an embedded composition guide for user- and agent-authored
  worlds. Runtime browser agents do not receive that guidance yet. The required
  page-owned `get_design_context` surface, version handshake, mutation receipts,
  and semantic-rendering integration are planned in
  `docs/plan/agent-facing-design-guidance.md` and
  `VAL-AGENT-DESIGN-CONTEXT`. W0 of that plan is implemented: browser agents now
  discover the composition guidance, live surface state, mutation scopes, and
  reversal actions from the page itself, versioned by a digest of the canonical
  `DESIGN.md` block. The version handshake, mutation receipts, and study
  composition remain with W2 and W5. Impeccable
  stays code-first by default to conserve image-generation tokens and latency;
  a task may explicitly use a visual comp when that reference would materially
  improve a novel surface.
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
- Pushed and deploying: Cloudflare Workers Builds pulls from GitHub on every
  push to `main`.
- Live at https://bookhand.jomi-se.workers.dev/ (bookhand.dev is attached once
  the repo goes public). `npm run check:live` drives that deployment through the
  browser's real WebMCP runtime: all eleven tools register, storage reports
  persistent and survives a reload, and no console or request errors appear.
  `docs/deployment.md` records the flow: no Cloudflare credential lives in this
  repository, and `npm run deploy` is a manual escape hatch only.
- A public YouTube demo video under three minutes, with audio covering what was
  built and how WebMCP was used, is a hard requirement.

## Next actions

1. Implement W0's browser-agent design context: the bounded, page-owned
   `get_design_context` tool, safe live state, canonical-block digest, tool
   description pointers, and visible read activity. Full application-shell
   custom worlds remain behind the explicit ADR gate in
   `docs/plan/agent-facing-design-guidance.md`.
2. Complete the trust reset: exact source verification, observable shared
   style/board mutations, book-scoped study IDs, real durable-storage prompting,
   math-faithful passages, visible mutation errors, and the COOP decision.
3. Complete the mobile reading reset: shell-wide themes, immersive navigation,
   intentional gestures, coherent panels/focus, and mobile browser evidence.
4. Implement local lexical retrieval and the bounded native
   slope-microscope experience, then run an actual compatible model through the
   deployed tool surface.
5. Confirm the real storage mode and the hero flow in the ChatGPT **desktop**
   app's built-in browser, the judged surface under ADR 0003 and its 2026-09-01
   amendment. The Pixel 7 cannot close this: WebMCP shipped in the ChatGPT
   desktop app, not the Android one. An in-app browser may also refuse OPFS sync
   access handles, in which case the session-only fallback becomes the judged
   path and must read as truthful.

   The tools themselves are no longer an unknown. `--enable-features=WebMCPTesting`
   gives Playwright's bundled Chromium a genuine `document.modelContext`, so
   `tests/e2e/webmcp-agent.spec.ts` exercises the production build through the
   real runtime and passes. What remains untested is that browser's presentation
   and storage policy, not the tool contract.
6. Deploy to bookhand.dev and confirm the live URL in the judged surface.
7. Keep embeddings optional and after lexical retrieval. Slice 5's first rich
   artifact is a trusted declarative experience, not arbitrary generated code.
8. Use the real Chapter X content from the bundled EPUB; the approved mock's
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
