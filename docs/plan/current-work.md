# Current work

Last updated: 2026-09-02

## Next executable wave

Review and integrate the isolated **document-remaster coding harness** after
W6 commit `d9f204d`. Its primary contract is deliberately small and powerful:
an agent reads a section's real XHTML and CSS, rewrites the whole section, and
the person can compare, Undo, or Reset. A deterministic `data-tex` compiler is
an optional shortcut, never the architecture or a restriction on the agent's
edit. Before integration, prove that render and extraction see the same
rewrite, remove temporary test files, reconcile the branch with W6 rather than
blindly cherry-picking it, and state honestly whether revisions survive reload.

The owner-visible **ChatGPT Desktop smoke** remains required after the next
deployment. It must confirm the model discovers and uses the shipped tools from
intent-only prompts; deterministic Playwright evidence proves the application
contract, not model-authored behavior.

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
- The deployed open-book runtime exposes thirteen tools: three library/global
  tools plus ten reading/study/search tools. `search_book` is the W5 addition.
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
- `actionGroupId` is provenance only in the current product. It does not group
  rendering or Undo; tool and domain copy now state per-item Undo truthfully.
- Study remains a flat record feed. Equations render as raw-looking `<pre>`
  content, raw Agent Activity occupies the Study viewport, initial Study load
  failure is not rendered, and removal is still permanent one-click behavior.
- There is no production transient passage cue, item reveal target, or
  temporary anchored explanation yet. The navigation/session core is present.
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
  The local open-book runtime therefore exposes fifteen tools. The production
  passage cue and anchored explanation remain W9 work.

## Accepted remaining topology

- W4: complete — runtime/tool truth and canonical source lifecycle.
- W5: complete and deployed — local lexical retrieval and `search_book`.
- W6: complete — shared origin-aware navigation, navigation-only
  `focus_passage`, and the non-persistent tutor-session core.
- W7: first-class durable lesson domain, safe math/plot, atomic lifecycle, and
  recoverable removal.
- W8: lesson-first Study composition, diagnostics separation, responsive
  workspace, manual no-agent authoring, and visible recovery.
- W9: source cue presentation, Study reveal, and bounded temporary explanation.
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
- Deployed commit `74b880b` was verified with persistent browser storage,
  thirteen genuine WebMCP tools, `search_book` reaching `ready / results` with
  corpus-derived hits, ordinary human Search, reload survival, and no observed
  page, console, request, or off-origin errors.
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
- The bundled *Calculus Made Easy* is judging content, not a permanent product
  dependency.
- Keep embeddings optional and after lexical retrieval.
- Do not add arbitrary generated code to the reader or Study. The current rich
  path is trusted native rendering from bounded declarative data.
- Physical Pixel validation is non-gating under ADR 0003; ChatGPT Desktop is
  the owner-only judged surface for the real-model hero.
- Update this file whenever completion changes the next executable wave.
