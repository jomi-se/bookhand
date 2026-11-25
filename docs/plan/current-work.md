# Current work

Documentation updated: 2026-11-25.

## Next: book artifacts and the daily study loop

On 2026-09-29 the owner redirected the study and tutor work toward their own
daily routine with technical books on a phone. The
[book artifacts spec](book-artifacts/spec.md) is accepted and owns the order:
a phone artifact-surface prototype first, then artifacts, conversations with
memories and voice, the Notebook with markings, technical-book readability,
and chapter-scale reading with web search. The
[North Star](../product-north-star.md), [CONTEXT.md](../../CONTEXT.md),
[ADR 0012](../decisions/0012-keep-conversations-memories-and-voice.md), and
[ADR 0013](../decisions/0013-generated-artifacts-run-in-their-own-frame.md)
record the change: tutoring is no longer transient, lessons and fixed study
blocks give way to artifacts of any shape, and the old Study model is deleted
without migration. Sections below that describe Study lessons, native blocks,
or transient guidance are history, not direction.

Ticket 01's prototype is merged into `main` (2026-11-25): the owner accepted
it as the base to build on ("We build on that"). [The
ticket](book-artifacts/issues/01-phone-artifact-surface-prototype.md) says
what it contains and how to run it. Its bottom-sheet surface is the
direction; the marking choice is still open. The live Tutor uses the Agent
Connect ACP SDK. [ADR 0014](../decisions/0014-tutor-agent-connect-acp.md)
records gateway approval, tool execution and continuation. The phone
prototype’s scripted chat and Notebook remain the starting point for
the artifact and durable conversation tickets.

### Verify the live Tutor

Run `npm run build` in Bookhand. In a separate Agent Connect checkout,
build the gateway with `cargo build --locked --bin agent-connect` and
install its pinned test adapters with
`npm ci --prefix deploy/gateway/test/fixtures/adapters`. Point
`AGENT_CONNECT_CHECKOUT` at that checkout when running
`npm run test:e2e:tutor-acp` from Bookhand. Run it again with
`BOOKHAND_TUTOR_FIXTURE_MOBILE=1` for the same-tab phone approval flow.
The fixture uses a private disposable gateway, a Chromium virtual passkey
and a local scripted model. It exercises browser consent, MCP-over-ACP page
tools, follow-up and transcript restore without a provider login.

### Waiting on the owner (2026-10-02)

1. **Marking.** Wash, margin or pin? The surface is settled (the prototype's
   bottom sheet).
2. **Tickets 05 and 06.** Both are `needs-triage` but not blocked by 01.
   Should either start before the surface is decided?

### Notes for the next agent

- Oversized EPUB imports now apply the existing 1 GiB limit to file metadata
  before reading the whole file. Synthetic regressions cover rejection before
  byte/metadata reads or storage and acceptance at the exact declared limit.
- `npm run dev` no longer reports the library as open in another tab: React
  StrictMode's double-run load effect sent two overlapping `initialize`
  requests, and the storage worker now shares one attempt.
- At 412px wide the reader toolbar is a horizontally scrolling strip, and its
  last button (Text) sits 8px past the edge with no visible cue. Ticket 04
  reworks this toolbar; give the overflow an affordance there.
- The artifact frame has no production header policy in `public/_headers`;
  ticket 02 owns that when the frame leaves the prototype.

## Completed: RE-003 production continuous scrolling

Bookhand now has a production candidate for a per-book **Pages / Scroll**
choice. Pages remains the polished default and keeps the persistent single
same-origin reader frame. Scroll uses a globally bounded window of at most
eight adjacent same-origin frame shells so wheel and touch input can cross EPUB
section boundaries naturally without restoring forbidden `blob:`, `data:`, or
`srcdoc` frame navigation.

The candidate preserves the `ReaderAdapter` boundary, exact CFI and visible
text grounding, annotations, remaster switching, hostile-book containment, and
the existing paginated behavior. Eviction measures the browser's actual
post-removal geometry and corrects only the residual displacement, avoiding a
double compensation when native scroll anchoring already kept the passage in
place. Fixed-layout EPUB remains out of scope and is never forced into this
reflow path.

The focused deterministic gates are green: long bidirectional traversal never
exceeds eight unique frames; forward and backward eviction preserve the exact
visible WebMCP passage; annotation fingerprints and tamper rejection remain
correct; publisher-original and rewritten remaster views remain grounded; the
malicious EPUB stays contained in Scroll; the RE-001 compatibility suite and
Pixel reader suite still pass. Full repository verification is green on an
isolated browser port: lint, typecheck, 578 unit tests, production build,
bundle, SDK packaging, CSP, the complete built-browser suite, and setup checks
all pass.

Genuine Windows in-app-browser validation passed on exact implementation
commit `844a581`, JavaScript asset `index-BDRWv4f6.js`, and CSS asset
`index-D7-rRr33.css`. Native wheel input traversed the book in both directions;
the window grew to eight frames and stayed bounded while its section range
moved forward and back, with no blank gap, visible jump, oscillation, dead end,
focus loss, or scroll trap. Genuine WebMCP context and passage calls agreed on
the visible text and range, annotation saving succeeded, view switching
remained functional, and returning to Pages restored exactly one retained frame
with working native navigation. The Windows console had no warnings or errors.

[ADR 0010](../decisions/0010-bounded-multi-view-continuous-scroll.md) records
the accepted architecture and
[the RE-003 production mission](re-003-continuous-scroll-production.md) owns
the completed evidence.

## Decision checkpoint: post-adoption reading quality and Book Health

The post-RE-001 design review is complete. Readest is now an active quality
baseline and source of battle scars, not a product or UI to copy. Future reader
missions use the two-layer
[reading-quality baseline](../specs/reading-quality-baseline.md), consult the
relevant distilled renderer specifications, and add only targeted fixtures and
observability for the chosen risk. A gigantic speculative regression corpus is
not a prerequisite to improving the reader.

The review also established the
[Book Health and repair model](../specs/book-health-and-repair.md). Bookhand
renders as well as it safely can, explains known issues in ordinary language,
gives connected agents precise technical evidence, and lets the reader judge a
coherent repair by the resulting experience. Accepted repairs form the current
personal copy; recovery remains available but out of the ordinary reading
path. A standalone repaired-EPUB export is the preferred first portability
direction.

[ADR 0009](../decisions/0009-stage-book-repairs-outside-the-personal-copy.md)
fixes the architectural boundary for future repair work: one staged
source-changing workspace per book, ordinary reading remains available, the
visible personal copy does not change before acceptance, versions increase
monotonically, and recovery is linear. Exact proposal-finalization tools, live
draft viewing, and visual design remain evidence-gated.

The design pass itself implemented no reader capability. RE-003 has since
shipped the selected continuous-scrolling direction. The remaining eligible
reader work includes RE-011 content-anchor stability and RE-010 lifecycle and
stale-work cancellation. RE-002 is ongoing mission-bounded baseline evidence
rather than a standalone corpus project.

## Completed: RE-001 owner-fork adoption

The compatibility spike completed with a `compatible with bounded Bookhand
patches` outcome, and the owner authorized adoption after the deterministic and
controlled-browser gates passed. `main` pins the exact MIT owner-fork archive
`jomi-se/foliate-js@ca3f118269f8d78811ef17a1b147363c321273d7` behind the
existing `ReaderAdapter`; it does not import or depend on the AGPL Readest
application.

The adopted integration preserves ADR 0005's one same-origin iframe and
fail-closed source transform. It also carries two independently authored
Bookhand repairs found during owner validation: fragment links whose publisher
marker has no rendered box measure the first following visible text, and a
normal page turn across a spine boundary gets the same visible motion contract
as an in-section turn. The retained Window, CSP, script blocking, remaster,
CFI, annotation, and search boundaries remain mandatory.

Deterministic fragment and animation regressions, the full RE-001 compatibility
file, adapter tests, typecheck, and production build are green. License
accounting now distinguishes the pinned fork, its generated vendor assets, and
the direct stylesheet polyfill.

Windows validation of the first adoption commit found that its custom
cross-spine animation translated the sole retained iframe completely offscreen
before replacing its document. Navigation and frame identity stayed correct,
but the uncovered reader background produced a visible blank interval. The
follow-up regression samples every animation frame through the native reader
controls and fails if neither visible book text nor a browser-owned transition
snapshot covers the reader; it also requires compositor transforms and retained
frame identity in both directions. The repair keeps the old page painted as a
document-transition snapshot while the same iframe loads its next section, then
slides that snapshot over the ready destination. Reduced-motion and browsers
without the transition API retain an immediate, navigation-first fallback.

Full repository verification passed: lint, typecheck, 577 unit tests,
production build and bundle checks, SDK packaging, CSP verification, setup
verification, and the 52-test browser suite. Genuine Windows in-app-browser
validation then passed on exact commit `fc8e0cd`: forward and reverse native
button turns across Relativity sections 42 and 43 kept continuously painted,
visibly sliding pages, settled at the correct chapters, retained the reader
frame, and preserved `get_reading_context`. Local `main` was fast-forwarded to
that commit. No remote push was performed. RE-002 remains paused.

## Earlier reader compatibility work

Two reproducible Pixel 7 failures were repaired on 2026-09-17. Tutor CSS had globally changed the compact reader toolbar into a
two-row grid, making the chrome 111px tall; the reader now owns a one-row,
horizontally scrollable toolbar with unchanged 44px targets. The panel assertion
now excludes the intentionally mounted-but-hidden Tutor, whose persistent mount
preserves conversation state. The focused Pixel suite passes; these fixes do
not constitute physical-device evidence.

[Readest navigation, pagination, and scrolling lessons](../research/2026-09-17-readest-navigation-pagination-scrolling.md)
records the exact application and Foliate snapshots, licensing boundary,
renderer/input/progress findings, regression catalogue, and a staged future
evaluation plan. The durable, implementation-neutral requirements distilled
from that study are indexed in the
[reader-engine specifications](../specs/reader-engine/README.md), including a
capability coverage inventory, compatibility-spike checklist, and owner-fork
update gate. This is research and specification only: no renderer approach,
dependency, implementation task, or validation contract was adopted here.

The [reader-engine candidate backlog](reader-engine-candidate-backlog.md)
classifies the findings into prerequisite, correctness, capability, deferred,
and rejected work. It also defines the owner-selection loop: present three
eligible candidates, plan the chosen one in detail, use bounded clean-context
Luna implementation lanes, then integrate and validate centrally. No candidate
has been selected or started.

## Development-fork handoff

Remaining root brainstorming is indexed in
[`../ideas/README.md`](../ideas/README.md); these are not accepted implementation
plans. The shipped remastering proposal and old handwritten defect reports were
removed at the user's request. Code inspection found fixes for the main reports;
no remaining runtime defect was confirmed during this documentation pass. Track
fresh reproductions if problems recur rather than revive speculative backlog.

Standalone EPUB restoration work lives in its own repository. This checkout
tracks `bookhand-next`; leave the judged Bookhand repository and deployment
unchanged. Agent Connect integration is now authorized under ADR 0006; current
the Tutor’s current transport is documented in
[ADR 0014](../decisions/0014-tutor-agent-connect-acp.md). The owner pushes and deploys.

The execution notes below are the **2026-09-03 pre-submission snapshot**. Their
deployment/recording instructions and runtime counts are historical, not current
authorization to alter the submitted project.

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

- Live surface: https://bookhand.dev/
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
