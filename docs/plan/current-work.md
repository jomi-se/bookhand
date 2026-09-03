# Current work

Last updated: 2026-09-03

## Next executable wave

Deploy and exercise the combined **tutor + document remaster + composed Study**
surface through ChatGPT Desktop. The local runtime now has twenty-three tools. The
highest-value engineering continuation is W9's bounded temporary explanation
and direct Study reveal; the highest-value owner action is an intent-only model
run that proves the agent discovers the six remaster tools, reads actual XHTML,
rewrites one chapter, and leaves the person able to compare, Undo, Reset, and
reload the result.

The exact morning preflight, intent-only prompts, fallback prompts, and 2:45
shot order are in `docs/submission/demo-runbook.md`.

The final broad Impeccable review is complete. Its submission-critical findings
have been implemented locally; after this lands, stop opening new general review
cycles. Validate the deployed product with the real model, fix only defects that
the run exposes, then record and submit.

The owner-visible **ChatGPT Desktop smoke** remains required after the next
deployment. It must confirm the model discovers and uses the shipped tools from
intent-only prompts; deterministic Playwright evidence proves the application
contract, not model-authored behavior.

The judging build now seeds three checksum-pinned public-domain restoration
corpora through the ordinary library path: *Calculus Made Easy* for the primary
tutor/remaster story, Einstein's *Relativity* for pervasive image-based math,
and *Flatland* for legacy document structure and illustrations. All are marked
for removal after judging.

## Active product direction

Bookhand is a local-first EPUB reader and page-owned WebMCP study environment.
The active polish mission now distinguishes:

- **Study:** durable, coherent learner-owned lessons and annotations.
- **Tutor guidance:** transient attention that can search, point, explain,
  reveal, Back, and Stop without creating permanent content implicitly.
- **Document remaster:** agent-authored restoration of the EPUB document
  itself, with original bytes preserved and recovery controlled by the reader.
- **Agent diagnostics:** separate observability. Raw tool names, calls, and logs
  have no place in Study; only compact semantic status for an active tutoring
  action belongs near the learning surface.

This direction is recorded in:

- `docs/product-north-star.md`
- `docs/reviews/2026-09-02-study-platform-synthesis.md`
- `docs/plan/study-surface-and-tutor-layer-proposal.md`
- `docs/plan/polish-and-showcase-mission.md`

## Current implementation truth

- Slices 1 through 3 are implemented: local library/import, Foliate EPUB
  reading, SQLite WASM persistence, highlights/notes, the native Study board,
  and genuine `document.modelContext` registration.
- Deployed commit `bf7b2f0` exposes twenty-one open-book tools. The current
  local runtime exposes twenty-three: the deployed set plus atomic
  `create_study_lesson` and summary-only `list_study_lessons`. Deployment truth
  must remain separate until this change is pushed and verified.
- W0 through W3 are implemented: runtime design-context discovery, source and
  persistence trust, shared observable style/board state, and the mobile/desktop
  reader reset.
- W4 is implemented: runtime design guidance is derived from a canonical
  capability manifest and versioned with it; WebMCP handlers defensively reject
  invalid calls and preserve actionable structured success/failure results.
- Passage extraction now covers image-only visibility, MathML `aria-label`,
  figure-only semantic CFI round trips, and mixed math. A real bundled-book
  Foliate regression proves Fig. 52 keeps its description, caption, typed
  figure/math segments, `AB`, `x`, `P`, `Q`, `OM=x_1`, and `PM=y_1`.
- Source-linked records use bounded typed canonical excerpts. Legacy derived
  records and resolved excerpts from older extraction versions repair lazily
  without a learner edit/revision; authored text remains unchanged; unresolved
  records preserve their display and expose Retry and Relink. Source-bearing
  migration and browser reload persistence are covered. ADR 0004 fixes and a
  regression proves the non-destructive deduplication policy.
- Source-linked mutations verify current book, range, fingerprint, and quote.
  Agent-created item updates use ownership tokens, retry idempotency, revisions,
  provenance, and per-item Undo.
- A first-class titled lesson now stores one ordered native-block composition
  atomically in schema v6, with stable lesson/block IDs, source verification,
  provenance, and retry idempotency. Lessons render as semantic articles;
  legacy single blocks remain separately under Notes rather than masquerading
  as lessons through action-group metadata.
- Study equations compile through the bounded native MathML renderer, with
  unsupported notation kept visibly as code rather than disappearing. Storage
  delimiters in lesson blocks and saved highlight quotations use the same safe
  inline MathML path instead of leaking raw TeX. Storage type labels no longer
  outrank the lesson, existing content comes before one
  progressively disclosed manual-authoring path, and raw Agent Activity is no
  longer part of Study.
- An initial Study-load failure is visible and retryable without unregistering
  the reading/search/style/tutor tool surface. Independent Study streams retain
  successful lesson, block, or annotation data when another stream fails.
  Expanded desktop gives Study the primary 48rem reading measure and keeps the
  book as a narrow reference; compact Study is a full surface with an explicit
  route back to the book. Recoverable removal, lesson updates, safe plots, and
  richer per-block source relationships remain open W7 work.
- `focus_passage` now draws a production transient cue over exact verified
  words. Precise ranges become one composed highlight, underline, or outline;
  broad ranges become a bounded tonal wash and accent rule instead of dozens of
  fragment boxes. It briefly settles into place, respects reduced motion,
  coexists with durable marks, and clears through the W6 session lifecycle.
  The preferred input accepts Bookhand's returned `range` envelope unchanged,
  while legacy flattened calls remain valid. Search hits expose the same
  reusable envelope. Direct Study reveal and a temporary anchored explanation
  remain open.
- W5 is implemented locally: canonical Foliate chunks feed a schema-v4,
  worker-owned FTS5 index with transactional batches, truthful lifecycle state,
  cancellation, resume, failure recovery, and book/version isolation. Ordinary
  Search exposes a bounded 1–10 result limit; genuine `search_book` returns
  structured availability, outcomes, exact source envelopes, and never moves
  the reader. This makes thirteen open-book tools after deployment.
- W6 is implemented in `d9f204d`: source-verified `focus_passage`, Back and
  Stop, one origin-aware transient session, learner takeover, anchored reading
  persistence, serialized navigation, stalled-view recovery, and a dedicated
  tutor-overlay identifier space that cannot replace durable annotations.
  W9 now supplies the production cue; anchored explanation remains open.
- Document remaster is implemented through six genuine WebMCP tools. An agent
  reads current package-relative XHTML/CSS, diagnoses it without heuristic
  classification, rewrites the complete section through Foliate's own loader,
  makes small fingerprinted exact edits without returning the whole chapter,
  or optionally compiles publisher-supplied `data-tex` to MathML. Exact-edit
  batches are serialized, all-or-nothing revisions and preserve the existing
  agent stylesheet when omitted. Publisher bytes remain immutable;
  Original/Rewritten, Undo, and Reset are visible. The persistent-frame build
  patch rebinds Foliate's private body measurement range before each pagination
  pass. Version toggles retain the nearest logical TOC fragment inside
  monolithic spine files and perform one final pagination after bounded local
  image/font settling, preventing blank pages and jumps to an unrelated start.
- Schema v5 persists bounded sanitized rewrite history before it is shown and
  hydrates it before Foliate's first render. Markup, CSS, summary, Undo, and
  Reset survive reload. Reindexing, EPUB export, and annotation re-anchoring do
  not exist and must not be claimed.
- The final product audit fixes are local: named themes now paint shell, EPUB,
  overscroll canvas, and mathematical image treatment from one synchronous
  palette; Search receives focus and meets the 44px target floor; Study opens at
  the lesson top without mobile question bleed; and remastering is presented as
  a reader-controlled advisory with truthful sanitizer feedback, visible
  Original/Rewritten state, and reachable mobile controls. The source audit is
  `docs/reviews/2026-09-03-full-product-impeccable-audit.md`.

## Accepted remaining topology

- W4: complete — runtime/tool truth and canonical source lifecycle.
- W5: complete and deployed — local lexical retrieval and `search_book`.
- W6: complete — shared origin-aware navigation, navigation-only
  `focus_passage`, and the non-persistent tutor-session core.
- W7: partial — native safe math plus the focused first-class titled lesson
  create/list lifecycle have landed atomically; updates, safe plots, richer
  block types/sources, and recoverable removal remain.
- W8: focused rescue landed — diagnostics separation, lesson-first semantic
  composition, visible partial-load recovery, and distinct docked, expanded,
  and compact layouts are implemented. Broader workspace refinement remains an
  iterative quality wave rather than a missing data-model foundation.
- W9: partial — production source cue presentation is complete; Study reveal
  and a bounded temporary explanation remain.
- W10: combined real-model hero and evidence closure.
- W11: repeated composition-quality evaluation showing worst and best outputs.

The contracts under `docs/contracts/polish/` define acceptance. The original
W4-through-W11 topology received two sequential reviews on 2026-09-02. Later
runtime evidence exposed additional tutor-navigation races; the amended W6/W9
contracts then received three sequential passes, with findings incorporated
after the first two and a clean third verdict. The amendment is frozen and W6
passed implementation scrutiny plus real-surface validation. The
document-remaster slice now takes priority before the remaining
lesson-composition waves because it is the strongest new WebMCP-specific
demonstration; W7 through W11 remain recorded rather than discarded.

## Submission state

The WebMCP Challenge closes 2026-09-03T20:00Z.

- Live surface: https://bookhand.jomi-se.workers.dev/
- ADR 0005 replaces Foliate's blocked per-section `blob:` iframe navigation
  with one persistent same-origin frame. Focused production tests prove frame
  identity across Chapter X to XI to X, offline navigation, remaster reload,
  keyboard paging, and hostile-book containment. Confirm the deployed build in
  a fresh ChatGPT browser tab before recording.
- Deployed commit `bf7b2f0` was verified with persistent browser storage,
  twenty-one genuine WebMCP tools, `search_book` reaching `ready / results` with
  corpus-derived hits, the document-remaster tools present, reload survival,
  and no observed page, console, request, or off-origin errors.
- Cloudflare Workers Builds deploys pushes to `main`.
- `LICENSE` is committed. Making the GitHub repository public and attaching the
  final domain are owner actions.
- A public YouTube demo under three minutes with audio is still required.
- Final judged-surface evidence requires the compatible ChatGPT Desktop app and
  a named real model; deterministic Playwright WebMCP tests prove plumbing, not
  model-authored teaching quality.

## Verification and handoff notes

- Use `npm run build && npm run preview`; development CSP intentionally makes
  `npm run dev` unsuitable.
- Use `scripts/quiet-run.sh` for routine checks and preserve validation evidence
  under ignored `artifacts/validation/polish/<commit>/`.
- W4 passed independent post-fix scrutiny for WebMCP boundaries, real-Foliate
  math/figure meaning, canonical-source migration/repair, and genuine browser
  persistence. The separate real-surface lane also passed design-context and
  WebMCP runtime checks.
- W5 passed independent scrutiny, the complete two-book frozen oracle, 288
  unit/component checks (the real-book timing guard passed unchanged when run
  without competing browser work), production build and bundle-exclusion
  checks, the complete production Playwright suite, and the dedicated secure
  lifecycle harness. Browser evidence covers genuine WebMCP ready/partial/
  unavailable states, cancellation and reopen, injected transactional failure,
  repeated Retry coalescing, explicit result navigation, non-navigation on
  search alone, and narrow-panel containment with no console/page errors or
  off-origin requests.
- W6 passed independent source scrutiny, focused unit suites, typecheck, lint,
  production build and bundle exclusion, the complete 33-test production
  Playwright suite, and separate desktop/compact/production browser validation.
  Evidence covers focus supersession, learner links, Back/Stop, reload
  anchoring, style persistence, stalled-navigation recovery, 44px compact
  controls, and same-range durable/tutor overlay isolation. The unchanged
  real-book timing guard passed alone after one resource-contended full run.
- Document remaster passes its sanitizer/compiler/source-path units and four
  production-browser scenarios: free-form rewrite, deterministic MathML
  shortcut, compact 44px controls, and persistent rewrite + persistent Reset
  across full reload. Schema-v5 migration, bounded history, cross-book
  isolation, worker request/result validation, refused-write truth, and
  first-render hydration are covered. The combined post-merge typecheck, lint,
  targeted units, production build, remaster browser, and Study/WebMCP browser
  suites pass.
- The focused W7/W8 lesson rescue passes schema-v6 migration, protocol
  rejection, atomic rollback, conflicting retry, source-handshake, partial-load,
  and genuine WebMCP create/list/reload coverage. Production screenshots cover
  docked and expanded desktop plus 390px and 320px light, dark, and sepia Study;
  compact tests assert no horizontal overflow and 44px Book, source, and answer
  controls. This evidence closes only `VAL-STUDY-LESSON-CORE`, not the broader
  experience-update, safe-removal, or plot contracts.
- Fingerprinted surgical remaster editing adds focused ordered/missing/
  ambiguous/stale/concurrent/CSS-preservation units and a genuine production
  WebMCP browser flow covering targeted rendering, atomic rejection, reload,
  and one-step Undo. It remains local until pushed and checked on the deployed
  origin.
- The production tutor cue passes typed/schema validation, exact verified-range
  resolution, bounded composed rendering for both browser `DOMRectList` and
  array-shaped test geometry, durable-highlight coexistence, transient cleanup,
  reduced-motion behavior, and the real Chromium guidance flow. The actual
  bundled-book browser surface confirms the broad visible range renders four
  marks total rather than per-fragment boxes. The existing reload/style timing
  guard passed alone after one resource-contended combined run.
- Final live-demo blockers now have focused regressions: `open_book` waits for
  the first readable section before returning success; WebMCP remaster writes
  persist without replacing the mounted Foliate frame and wait for the person
  to select Rewritten; remastered documents cannot impose fixed page geometry, hidden
  overflow, mid-word display breaks, or poster-sized headings; desktop text
  size controls are visible; and Left/Right plus PageUp/PageDown page the book
  even after reader chrome receives focus. The focused remaster and ordinary
  desktop browser flows pass against the production build.
- The chapter-remaster provenance strip can collapse to one quiet, session-only
  disclosure without changing the selected version or its history.
- Page layout is a persisted reader preference with Auto, Single, and Spread
  controls in Text and the same bounded `set_reading_style` field for agents;
  compact/coarse-pointer reading remains single-column.
- Text zoom scales the reader root, so repaired chapters cannot strand rem-based
  headings or native MathML at a fixed size.
- Original, Rewritten, Undo, and Reset now update the mounted section in place
  and ask Foliate to repaginate. They never replace the reader or trigger a new
  post-load `blob:` iframe navigation, which the ChatGPT/Codex browser blocks.
- The bundled *Calculus Made Easy* is judging content, not a permanent product
  dependency.
- Keep embeddings optional and after lexical retrieval.
- Do not add arbitrary generated code to the reader or Study. The current rich
  path is trusted native rendering from bounded declarative data.
- Physical Pixel validation is non-gating under ADR 0003; ChatGPT Desktop is
  the owner-only judged surface for the real-model hero.
- Update this file whenever completion changes the next executable wave.
