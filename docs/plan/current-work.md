# Current work

Last updated: 2026-09-02

## Next executable wave

Implement **W5: local lexical retrieval** from
`docs/plan/polish-and-showcase-build-tasks.md`: build its transactional index
lifecycle, cancellation, resume, and failure truth from the frozen contracts,
then expose bounded current-book `search_book` through genuine WebMCP and prove
it against the two-book oracle. An interrupted concurrent W5 draft was audited
against its transcript and removed rather than being mistaken for accepted
groundwork.

## Active product direction

Bookhand is a local-first EPUB reader and page-owned WebMCP study environment.
The active polish mission now distinguishes:

- **Study:** durable, coherent learner-owned lessons and annotations.
- **Tutor guidance:** transient attention that can search, point, explain,
  reveal, Back, and Stop without creating permanent content implicitly.
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
- The current open-book runtime exposes twelve tools: three library/global
  tools plus nine reading/study tools. `get_design_context` is the twelfth.
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
- There is no tutor session, exact transient passage cue, item reveal target,
  temporary explanation, Back stack, or Stop-guiding action yet.

## Accepted remaining topology

- W4: runtime/tool truth and canonical source lifecycle.
- W5: local lexical retrieval and `search_book`.
- W6: shared origin-aware navigation and non-persistent tutor-session core.
- W7: first-class durable lesson domain, safe math/plot, atomic lifecycle, and
  recoverable removal.
- W8: lesson-first Study composition, diagnostics separation, responsive
  workspace, manual no-agent authoring, and visible recovery.
- W9: source focus, Study reveal, bounded temporary explanation, Back, and Stop.
- W10: combined real-model hero and evidence closure.
- W11: repeated composition-quality evaluation showing worst and best outputs.

The contracts under `docs/contracts/polish/` define acceptance. Two sequential
independent contract-review passes were completed and incorporated on
2026-09-02; the amended W4-through-W11 topology is frozen.

## Submission state

The WebMCP Challenge closes 2026-09-03T20:00Z.

- Live surface: https://bookhand.jomi-se.workers.dev/
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
  WebMCP runtime checks. W5 remains unimplemented and is the next clean wave.
- The bundled *Calculus Made Easy* is judging content, not a permanent product
  dependency.
- Keep embeddings optional and after lexical retrieval.
- Do not add arbitrary generated code to the reader or Study. The current rich
  path is trusted native rendering from bounded declarative data.
- Physical Pixel validation is non-gating under ADR 0003; ChatGPT Desktop is
  the owner-only judged surface for the real-model hero.
- Update this file whenever completion changes the next executable wave.
