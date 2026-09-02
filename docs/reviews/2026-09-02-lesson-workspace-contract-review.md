# Durable lesson model and lesson-first Study: contract review

Date: 2026-09-02

Reviewer: Claude (clean-context pass). Read-only review; this document is the
only file added, and nothing else was changed.

Sources: `AGENTS.md`, `docs/product-north-star.md`,
`docs/reviews/2026-09-02-study-platform-synthesis.md`,
`docs/plan/study-surface-and-tutor-layer-proposal.md`, the current Study
implementation (`src/domain/study.ts`, `src/domain/source.ts`,
`src/study/useStudy.ts`, `src/study/StudyBoardPanel.tsx`,
`src/study/StudyItemCard.tsx`), and the W7/W8 contracts
(`VAL-STUDY-SCHEMA-SECURITY`, `VAL-STUDY-MATH-RENDERING`,
`VAL-INTERACTIVE-PLOT`, `VAL-STUDY-EXPERIENCE-LIFECYCLE`,
`VAL-STUDY-SAFE-REMOVAL`, `VAL-STUDY-COMPOSITION-HIERARCHY`,
`VAL-AGENT-ACTIVITY-PRESENTATION`, `VAL-STUDY-WORKSPACE-RESPONSIVE`,
`VAL-STUDY-LOAD-RECOVERY`) plus their named dependencies
(`VAL-STUDY-ID-OWNERSHIP`, `VAL-ACTION-PROVENANCE-UNDO`,
`VAL-SOURCE-EXCERPT-LIFECYCLE`, `VAL-BOARD-VIEW-PARITY`).

## 1. Domain and UI contradictions

### 1.1 Two block vocabularies, and no decision about their relationship

`StudyItemPayload` (`src/domain/study.ts`) has five kinds: `prose`,
`quotation`, `equation`, `steps`, `question`. `VAL-STUDY-SCHEMA-SECURITY`
declares eight v0 discriminators: `markdown`, `quotation`, `equation`, `steps`,
`callout`, `question`, `mermaid`, `interactive_plot`. There is no `prose` and no
`markdown` on the other side. The synthesis review leaves `upsert_study_item`
"kind-discriminated **or** retired in favor of a lesson operation" — an
unresolved fork that W7 will otherwise implement both halves of.

Decide before writing the schema, and write it down: **standalone items keep
today's five-kind payload; experiences use the eight-kind block vocabulary; the
two are not unified in v0.** `VAL-STUDY-EXPERIENCE-LIFECYCLE` already requires
`list_study_items` to return "standalone-item **and** first-class experience
summaries," and `VAL-STUDY-COMPOSITION-HIERARCHY` requires that "standalone
notes remain distinct from lessons." Two entities is the contracted shape.
Unifying them buys a migration of every existing record for no learner benefit.

### 1.2 Agent deletion is granted in one contract and withheld in another

`VAL-STUDY-ID-OWNERSHIP`: "this mission exposes no agent delete operation."
`VAL-STUDY-SAFE-REMOVAL`: "Agent tools cannot permanently delete user-owned
content" — which reads as a grant to delete agent-owned content. They should say
the same thing. Recommend the strict reading: no agent delete of anything in
W7/W8; the removal clause describes the outcome, not a capability. Note also
that no Undo tool exists today, so per-item Undo is person-only; if that ever
becomes a tool, it becomes an agent-triggerable removal and re-opens this.

### 1.3 "Undo of update preserves interleaved later user edits" is a merge problem

`VAL-STUDY-EXPERIENCE-LIFECYCLE` promises that undoing an experience update
"restores its prior version while preserving interleaved later user edits."
Today's guard (`StudyItem.revision`, `src/domain/study.ts`) does the honest,
much weaker thing: it *refuses* an undo that would discard newer work. For a
multi-block lesson, "preserve interleaved edits" means a three-way merge across
blocks, in a hackathon, with no conflict UI.

Narrow it: revisions are tracked **per block**; an update or undo that would
touch a block the learner edited since is rejected with a conflict result naming
that block; nothing merges. That is implementable, honest, and matches the
behavior `VAL-ACTION-PROVENANCE-UNDO` already validates for items.

### 1.4 The design-context gate has a documented bypass

Experiences require a current `designContextVersion`;
`VAL-ACTION-PROVENANCE-UNDO` states that "routine one-block calls remain usable
without a design-context version." So an agent refused for a stale version can
compose the same lesson as five ungoverned `upsert_study_item` calls. That is
acceptable — the fallback produces five visibly separate records rather than one
lesson, which is a truthful degradation — but it must be stated so nobody
"repairs" it later by grouping items into a pseudo-lesson.

### 1.5 `actionGroupId` will be reached for exactly where the renderer is written

It is provenance only, and does not group rendering or Undo (`current-work.md`,
`VAL-ACTION-PROVENANCE-UNDO`). W8's "collapse shared sources" is precisely the
task where someone will group by it. The prohibition belongs in the renderer's
own contract text, not only in the provenance contract.

### 1.6 Two titles compete for one heading

`StudyBoard.title` renders as the panel `<h2>` (`StudyBoardPanel.tsx:81`), and
an experience also has a title that `VAL-STUDY-COMPOSITION-HIERARCHY` wants to
outrank everything. With three lessons on a board, what is the `<h2>`?

Recommend: the panel keeps a stable landmark label ("Study"); lesson titles are
`<h3>` headings that own their scroll and focus targets — which
`VAL-TUTOR-STUDY-REVEAL` needs anyway. The board title stays in storage and
stops being displayed.

## 2. Missing lifecycle and migration states

1. **Storage shape.** Experiences need their own table. A nullable
   `experience_id` on `study_items` is the trap: it makes a row simultaneously a
   standalone item and a lesson block, and forces every `list_study_items` query
   to filter on it forever. Separate tables; items stay items.
2. **Ordering across mixed content.** `StudyItem.sortOrder` is board-scoped.
   Lessons need block order *within* the lesson and lesson order *within* the
   board. Nothing defines the order of a board holding both. Assign one
   board-level sort key across both kinds at creation, or
   `VAL-STUDY-COMPOSITION-HIERARCHY`'s "existing learning content precedes
   manual authoring" has no implementable meaning.
3. **Tombstones are an unowned new entity.** `VAL-STUDY-SAFE-REMOVAL` requires a
   persisted tombstone with a ten-minute TTL, but nothing says who purges it
   (recommend: on board load and on each removal), what happens when its book is
   removed from the library (cascade), or how "recreated identity" is detected.
   Detection needs a rule: while a tombstone holds an ID, that ID cannot be
   reused; if the row exists again at Undo time, report a conflict and change
   nothing.
4. **Stale sources inside a lesson.** `SourceLink` today is
   `resolved | pending-legacy | stale` with per-item Retry/Relink. A lesson has
   one shared source plus optional block-specific ones, and no contract says
   what a lesson shows when the shared source is stale while three blocks
   resolve. Recommend: a lesson-level stale notice that never hides blocks;
   Relink at lesson level rewrites only the shared source; block-specific
   sources relink individually.
5. **Reload discovery has no read path.** The lifecycle contract requires
   `list_study_items` to return summaries and explicitly *not* full payloads
   "unless requested by ID" — but no tool takes an ID. `reveal_study_item` will
   have a summary and no way to read what it is revealing. Either add a by-ID
   read tool or a `detail` field in W7; today this is an unassigned gap.
6. **Study load failure is worse than "not rendered."** In `useStudy.ts`, if
   `client.getBoard` rejects, `setError` is called (line 80) and nothing renders
   it — and `commands` is never constructed, so `onCommandsReady` never fires
   and **every study WebMCP tool silently vanishes from the registry**. The
   board does not merely look empty; the agent surface loses tools with no
   message anywhere. Separately, the subscribe effect calls `void reload()` with
   no `.catch`, so a failing refresh is an unhandled rejection —
   `VAL-STUDY-LOAD-RECOVERY` forbids exactly that. Both are concrete W8 work
   with real teeth.
7. **Schema migration for experiences must refuse a newer schema**, the way the
   source-excerpt migration already does. Nothing states it for this table.

## 3. Quotations, highlights, and source excerpts without duplication

One rule, applied consistently:

- **The `SourceExcerpt` is the only canonical text.** It is versioned, verified,
  and book-derived (`src/domain/source.ts`).
- **A highlight is a user-owned record that marks the book.** Its display text
  is preserved even when the source goes stale.
- **A quotation block is lesson-owned.** When source-derived it is canonicalized
  *from the excerpt*, never from a caller-supplied string
  (`VAL-SOURCE-EXCERPT-LIFECYCLE`); when authored it is preserved verbatim and
  merely linked to the source.
- **Annotation references inside a lesson are pointers, never copies.** Store
  the annotation ID and range; render the current note. A lesson that copies
  note text goes stale the moment the learner edits the note.
- **De-duplication happens at presentation, never in storage.** ADR 0004 and
  `VAL-SOURCE-EXCERPT-LIFECYCLE` both require that identical annotation
  references and quotations remain separate user-owned records. So: when a
  lesson quotation and a highlight share range and fingerprint, the lesson
  renders the quotation and shows a compact "also highlighted" marker; the
  Highlights index shows the highlight once and links to the lessons citing it.
  Neither record is deleted, neither is silently merged.

The concrete duplication to remove is in today's board: `StudyBoardPanel`
renders full `annotation.quote` text in the Highlights list below items that may
quote the same passage. `VAL-STUDY-COMPOSITION-HIERARCHY`'s "compact
index/reference, not duplicated full documents" is the fix, and it is a W8
rendering change, not a domain change.

## 4. Safe math and plot rendering boundaries

**The boundary that matters is that model-supplied text never becomes markup.**
No `innerHTML`, no `dangerouslySetInnerHTML`, no SVG `foreignObject` carrying
payload strings, on any path. `equation` carries a TeX *string* rendered by a
trust-disabled renderer or shown as text; `markdown` is a CommonMark subset with
raw HTML and links disabled; `mermaid` needs `securityLevel` non-loose, HTML
labels off, and clicks off.

Three recommendations:

1. **Cut `mermaid` from v0.** It is the largest new parser, the largest bundle
   cost, and the largest attack surface in W7, and no hero scenario needs it.
   This is a proposed contract amendment for the manifest owner, not a change I
   made.
2. **Add a per-block error boundary.** No contract states it, and it is the
   difference between one broken equation and an empty Study surface during the
   demo. A block whose renderer throws — a malformed TeX string, a plot AST that
   evaluates non-finite at the domain edge — must degrade to a bounded fallback
   in place. It must never take down the lesson or the board.
3. **Test the bounds where they interact, not just the hostile fixture.**
   Exponents −12…12, |literal| ≤ 1,000,000, domain span ≥ 0.000001: `x^-12`
   near a domain edge overflows to non-finite, and the contract requires a
   bounded *gap*, not a throw inside a render pass.

The plot's AST evaluator must be a plain recursive interpreter over the
whitelisted nodes, with no compilation step of any kind. And math and plots
should share one accessibility pattern: a visually-hidden description generated
from the declarative data and referenced by `aria-describedby`, never derived
from the renderer's own output.

## 5. Manual, no-agent authoring

`VAL-STUDY-COMPOSITION-HIERARCHY` says "no-agent use remains complete," and the
product boundary in `AGENTS.md` says study capabilities must be useful without
an agent. Once the lesson is the primary unit, that requires more than the
contracts enumerate:

- A person must be able to **create a lesson**, not only standalone items: a
  title, add/remove/reorder blocks, edit a block, delete the lesson. Otherwise
  "complete without an agent" is false the day lessons ship.
- **Content precedes authoring controls.** Today five equal kind buttons sit
  above the content (`StudyBoardPanel.tsx`, the `add-row` block), which the
  Impeccable critique called an administrative first impression. One primary
  create control; other kinds progressively disclosed.
- **Manual authoring requires no design-context version** — it is a person — and
  must route through the same command path as the tools, so UI and WebMCP
  produce identical state.
- **Reordering must be keyboard-reachable.** Move-up/move-down controls, not
  drag-only, or the accessibility contracts fail on the primary new surface.
- **The equation composer needs the `tex | plain` choice visible**, defaulting to
  `plain`. Today it takes a bare string with a `dy/dx = y / (x - a)` placeholder;
  once the format is declared, people will type prose into a TeX field and get a
  fallback they cannot explain.

## 6. Responsive composition

- **Docked** is a companion: one lesson at a time, title plus blocks, Highlights
  collapsed to a count, book measure preserved. No rails.
- **Expanded** must *add navigation*, not width — a centered lesson column at a
  readable measure plus one optional rail (lesson contents or sources).
  `VAL-STUDY-WORKSPACE-RESPONSIVE` explicitly rejects "the same feed widened,"
  which is what expanded is today.
- **Mobile** replaces the reader cleanly with an obvious return that restores
  reading location; the docked preference must not produce a squeezed split.
- **Stable identity is a W8 deliverable that W9 depends on.** Every lesson and
  block needs a stable DOM id and a meaningful heading before
  `reveal_study_item` can scroll to and focus one. Designing the renderer with
  that from the start is free; retrofitting it is not.
- **The plot is the reflow risk** at 320 pixels and 200 percent: a fixed-aspect
  SVG must shrink without clipping its readouts.

## 7. Diagnostics never live in Study — protect this structurally

This is the finding the two contract-review passes had to make twice, so it
deserves a mechanism rather than a guideline:

1. **Delete the `agentActivity` prop from `StudyBoardPanelProps`**
   (`StudyBoardPanel.tsx:38`, rendered at line 107). Do not pass `undefined`. A
   prop that exists will be filled in again by the next agent that has a call
   list and nowhere to put it.
2. **Assert absence in the Study spec**: no element inside
   `#reader-study-panel` contains a tool name or a diagnostics container.
   `VAL-AGENT-ACTIVITY-PRESENTATION` owns the assertion; the composition
   contract should point at it rather than restating it.
3. **The one permitted exception is the compact tutor status** ("showing this
   passage") with Back and Stop — and that indicator should be owned *above* the
   panel switch, so it is not Study's content at all. Keeping it outside the
   panel is also what makes assertion (2) trivially true.
4. **No tool call may open Study, expand it, steal focus, or change its
   geometry.** The existing `focusNonce` path (`SurfaceStore`) must stay
   deliberate — person-initiated or explicitly guidance-initiated — never a side
   effect of a mutation tool.

## 8. Smallest coherent W7 / W8 split

**W7 — domain and one correct renderer.** Experiences table and migration
(refusing a newer schema); block vocabulary v0 (recommended without `mermaid`);
the validator with every bound; per-block error boundary; math renderer with
visible fallback; plot with keyboard, text equivalent, and Reset;
`upsert_study_experience` gated on design-context version, plus the missing
by-ID read path; atomic write leaving zero partial records; structured receipts;
per-block revision conflicts; Undo of create and update; tombstones and Safe
Removal across every record kind. The W7 renderer may look plain. It must be
correct, and it must already expose stable ids and headings.

**W8 — composition, recovery, and authoring.** Lesson-first hierarchy and visual
grammar; shared-source collapse and highlights as a compact index; removal of
`agentActivity` from Study plus the separate diagnostics surface; docked,
expanded, and mobile compositions; manual lesson authoring with progressive
disclosure; load and mutation recovery including the unhandled-rejection fix;
the two-pass Impeccable critique once the surface is stable.

**One dependency worth naming:** removing diagnostics from Study depends on
nothing in W7. It is the highest-visibility single change in the mission and the
one the Impeccable critique scored hardest. If a demo is recorded before W7
lands, pulling Agent Activity out of Study is worth doing on its own, early.

## 9. Acceptance scenarios

1. **One lesson, one title.** An agent creates a titled three-block lesson. The
   board shows one titled unit, not three cards; the title is a heading with a
   stable id; no block-type labels appear in ordinary reading mode.
2. **Shared source appears once.** Three blocks cite the same range: one source
   chip at lesson level, no per-block chips. A fourth block citing a different
   range shows its own chip and the lesson chip stays.
3. **Quotation and highlight coexist.** A highlight and a lesson quotation share
   a range and fingerprint. Both records exist in storage after reload; the
   lesson shows the quotation with an "also highlighted" marker; the Highlights
   index shows it once, compactly, linking to the lesson.
4. **Annotation reference tracks the note.** A lesson references an annotation;
   the learner edits that note; the lesson shows the new text without any
   lesson write.
5. **Interleaved edit conflicts, not merges.** The learner edits block two; the
   agent updates the lesson. The update is rejected with a conflict naming block
   two; storage is unchanged; a bounded error is visible.
6. **Mid-write fault leaves nothing.** A fault injected inside the experience
   write leaves zero partial rows, shows a bounded error, and leaves unrelated
   items and highlights untouched.
7. **One bad block, one bounded fallback.** A malformed TeX equation and a plot
   whose AST evaluates non-finite both degrade in place; every other block in
   the lesson renders; the board is never blank.
8. **Removal is recoverable.** Delete a lesson, reload within ten minutes, press
   Undo: exact record, block order, source relationship, provenance, and
   revision return. Reload after ten minutes: the tombstone is gone and Undo is
   not offered. Recreate the same ID inside the window, then Undo: conflict, no
   overwrite.
9. **Study load failure is visible and does not disarm the agent.** With
   `getBoard` failing, Study renders a bounded error with Retry, Retry succeeds
   and is idempotent, and the WebMCP study tools are either still registered or
   their absence is stated — never silently gone.
10. **No diagnostics in Study.** After ten tool calls, no tool name, timestamp,
    or call list appears anywhere inside `#reader-study-panel`; Study geometry
    is unchanged; focus never moved.
11. **No-agent completeness.** With WebMCP absent, a person creates a titled
    lesson, adds a prose and a quotation block from a selection, reorders them by
    keyboard, edits one, deletes the lesson, and undoes the deletion.
12. **Composition differs by mode.** Docked preserves a useful book measure and
    shows one lesson; expanded shows a centered lesson with a navigation rail
    (not the docked feed widened); mobile replaces the reader and returns to the
    same reading location. All three at 320 pixels and 200-percent reflow, in
    every shipped theme.
13. **Reveal targets exist before W9.** Every lesson and block exposes a stable
    id and a meaningful heading, asserted in the DOM, so `reveal_study_item` has
    something to scroll to.
