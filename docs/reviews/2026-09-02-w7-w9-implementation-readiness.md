# W7–W9 implementation readiness

Date: 2026-09-02
Reviewed at commit: `4780220` ("Freeze embodied tutor contract boundary")
Working tree at review time: clean except untracked `IDEAS.md`
Reviewer scope: read-only. No code, canonical contract, plan, `DESIGN.md`, or
existing file was modified. This review is the only file produced.

## How to read this document

The contracts under `docs/contracts/polish/` are **accepted**. This review does
not amend them. Where it disagrees with one, it says so under an explicit
**Proposal** label, and the proposal is not in force until the contract itself
changes. Everything else is either an observation about code at `4780220` with
a file and line, or a sequencing recommendation.

Three labels are used throughout:

- **Accepted** — already written into a canonical contract or the build tasks.
- **Proposal** — this review's recommendation; requires a contract edit or an
  owner decision before it binds.
- **Observation** — a fact about the code or fixtures at `4780220`.

The purpose is to make W7 through W9 executable *and ambitious*. The failure
mode this document is written against is not a red test. It is a wave that goes
green while the product quietly becomes an ordinary ebook reader with a record
feed bolted to it — which the North Star names as the thing Bookhand must beat
(`docs/product-north-star.md`, "The core realization").

---

## Part 1 — The six reconciliations

These were raised as open questions. Each is resolved here with the evidence
that decides it.

### 1.1 Mermaid: optional and non-blocking, without unfreezing the fixtures

**The apparent conflict.** `VAL-STUDY-SCHEMA-SECURITY` names `mermaid` as one
of eight accepted v0 discriminators and requires "a locked-down parser with
clicks/HTML/securityLevel-loose disabled" (accepted).
`docs/reviews/2026-09-02-lesson-workspace-contract-review.md:177` recommends
cutting `mermaid` from v0 as the largest new parser and bundle for the least
teaching value. Both cannot be literally true.

**Observation — no library is installed.** `package.json` dependencies are
exactly `@fontsource-variable/inter`, `@fontsource-variable/source-serif-4`,
`@sqlite.org/sqlite-wasm`, `foliate-js`, `lucide-react`, `react`, `react-dom`.
There is no `mermaid`, and no TeX renderer either. Both W7 rendering contracts
require a dependency that does not exist yet.

**Observation — the frozen fixtures do not actually require a Mermaid
renderer.** This is the decisive fact and it appears to have been missed.

- `tests/fixtures/study-experience/non-slope.json` contains one `mermaid`
  block (`"flowchart LR\n  A[Input] --> B[Output]"`), but its `oracle` object
  asserts only plot numerics: `initial`, `afterKeyboardRight`, `reset`, and two
  tolerances. **The oracle makes no assertion about Mermaid output at all.**
- `tests/fixtures/study-experience/hostile.json` case `mermaid-click` expects
  `rejected-visible-error` for `click A javascript:alert(1)`. A *validator* that
  rejects `click` satisfies this. A *renderer* is not needed to reject input.

**Resolution (Proposal).** Split the discriminator from the renderer. W7 ships
the `mermaid` **discriminator, validator, and rejection behavior** — flowchart
grammar only, `click` rejected, HTML labels rejected, source length bounded —
and renders an accepted block as a bounded accessible fallback: the labelled
source in the `code` type role inside a figure with a caption, exactly as the
malformed-input fallback in `VAL-STUDY-MATH-RENDERING` already requires for
equations. Shipping the actual Mermaid graphics library becomes a **W11
enhancement**, not a W7 gate.

This keeps `VAL-STUDY-SCHEMA-SECURITY` literally satisfiable (the discriminator
exists, the hostile case is rejected, no `securityLevel` is ever loose because
no parser is loaded), keeps both frozen fixtures passing unchanged, and removes
the single largest bundle risk from the critical path. If the contract's phrase
"rendered by a locked-down parser" is read as requiring graphics, that clause —
and only that clause — needs an amendment; the rest of the contract is
unaffected.

**Why not simply cut the discriminator.** Because `non-slope.json` and
`hostile.json` are frozen and both contain `mermaid` blocks. Cutting it turns
`non-slope.json` into a rejection fixture and silently deletes the
`mermaid-click` security case. Validating without rendering costs a schema
branch; cutting costs a fixture unfreeze and a lost hostile case.

**Ambition note.** A flowchart is the weakest visual affordance in the
catalogue for a calculus book. `interactive_plot` is the one that proves the
North Star's "construct an interactive geometric explanation tied to a selected
equation." Spend the rendering budget there.

### 1.2 The two study vocabularies

**Observation.** They are genuinely different objects, not two names for one.

| | Shipped (`src/domain/study.ts:39-54`) | Contract v0 (`VAL-STUDY-SCHEMA-SECURITY`) |
|---|---|---|
| kinds | `prose`, `quotation`, `equation`, `steps`, `question` | `markdown`, `quotation`, `equation`, `steps`, `callout`, `question`, `mermaid`, `interactive_plot` |
| container | none — flat items on a board | an experience of 1–16 ordered blocks |
| quotation source | `sourceRange` + `sourceLabel` on the item (`:69-71`) | `citation` inside the block |
| steps shape | `readonly string[]` (`:43`) | `{title, text}` objects, 1–12 |

The frozen fixtures use the **contract** shape: `non-slope.json` steps are
`{"title": "First", "text": "Read the intercept."}`.

**Resolution (Proposal): two vocabularies, one storage table, and a hard rule
that they never merge.**

- `StudyItemPayload` stays exactly as it is and keeps its five kinds. It is the
  **standalone note vocabulary** — what a person types into the composer at
  `src/study/StudyBoardPanel.tsx:110-130` with no agent present.
  `VAL-STUDY-COMPOSITION-HIERARCHY` already requires that "standalone notes
  remain distinct from lessons" (accepted), which means the product wants two
  shapes, not one.
- The experience block union is **new and separate**, lives in a new
  `src/domain/experience.ts`, and is never assignable to `StudyItemPayload`.
- `prose` and `markdown` are not unified. `prose` is a plain string rendered as
  a paragraph (`StudyItemCard.tsx:18`); `markdown` is a parsed CommonMark
  subset. Renaming `prose` would migrate every existing row for no user-visible
  gain.

**Collision risk.** The tempting move is to widen `StudyItemPayload` with the
three new kinds and reuse `StudyItemCard`. Do not. `upsert_study_item`'s schema
enumerates the kinds inline (`src/webmcp/tools.ts:553`, `oneOf` at `:578-584`,
`toPayload` allow-list at `src/webmcp/tools.ts:701-720`), so widening the union
silently widens the *agent-facing standalone* tool to accept lesson blocks with
none of the experience-level limits — which is exactly the design-context gate
bypass recorded at
`docs/reviews/2026-09-02-lesson-workspace-contract-review.md:66`.

### 1.3 Load failure and tool disappearance

**Observation — this is the most severe defect on the W8 list, and it is worse
than "the board does not render."** The chain, verifiable at `4780220`:

1. `src/study/useStudy.ts:61-87` — the mount effect awaits
   `client.getBoard(entry.id)`. On rejection it runs `setError(...)` at `:81`
   and **`setCommands` is never called**, so `commands` stays `undefined`.
2. `src/study/useStudy.ts:140` returns `error` — and **nothing consumes it**. A
   repository-wide grep for `study.error` returns zero hits;
   `src/reader/ReaderScreen.tsx:462` renders only `reader.error`. The failure is
   invisible.
3. `src/reader/ReaderScreen.tsx:89-91` — the effect calls
   `onCommandsReady(study.commands)`, i.e. `onCommandsReady(undefined)`.
4. `src/App.tsx:51-52` — `const bookTools = readerCommands ? createBookhandTools(...) : []`.

**So a single storage rejection silently unregisters all ten book tools.** The
agent sees the three library/global tools and no reading, study, or search
capability, with no error anywhere in the interface and no signal on the tool
side either. During a judged run this is indistinguishable from Bookhand not
implementing WebMCP.

**Resolution (Accepted, but under-specified).** `VAL-STUDY-LOAD-RECOVERY`
covers the visible-error half ("Initial Study load ... produce bounded
user-facing states with Retry"). It says nothing about the tool registry.

**Proposal — add a tool-availability clause.** Board load failure must not
remove `get_reading_context`, `get_passage`, `navigate_book`,
`get_table_of_contents`, or `search_book`. None of those five needs the board.
Only the four study-mutating tools legitimately depend on it, and they should
register and return a structured `unavailable` result naming the failure and
the Retry path, rather than vanishing. A tool that disappears teaches the model
that the capability does not exist; a tool that returns `unavailable` teaches
it to retry or tell the person.

**Implementation seam.** `BookhandCommands` construction is the coupling point
(`src/study/useStudy.ts:68-79`): it takes `board: loaded` in its constructor
context. Splitting construction so that reading-only commands do not require a
board is a small refactor with a large blast radius on tool registration, and it
is the single highest-value structural change in W8. Do it early in the wave,
not late.

### 1.4 Diagnostics are not Study

**Observation.** `src/study/StudyBoardPanel.tsx:38` declares
`readonly agentActivity?: ReactNode` and `:107` renders `{props.agentActivity}`
as the first thing in the panel body — above the composer and above every piece
of the learner's own content. `src/reader/ReaderScreen.tsx:441-448` passes
`<AgentActivity>`, which renders raw tool names in monospace accent
(`src/webmcp/AgentActivity.tsx:52`), a summary line, strike-through on failure
(`src/study/study.css:332-335`), a tool count, and a 180px scrolling call list
(`study.css:305-311`).

`VAL-AGENT-ACTIVITY-PRESENTATION` forbids all of it (accepted). `DESIGN.md`
now carries it as **The Diagnostics Are Not Study Rule** and names this exact
violation.

**Resolution: delete the prop, do not pass `undefined`.** This is a structural
point, not a stylistic one. If the prop survives as optional, the contract is
satisfied by one call site choosing not to pass it, and the next feature that
wants "just a small status" has a typed, documented socket waiting in the study
panel. Removing `agentActivity` from `StudyBoardPanelProps` makes the rule a
compile error instead of a review finding.

**What replaces it.** `VAL-AGENT-ACTIVITY-PRESENTATION` requires a separate
reachable diagnostics surface holding at most twenty records with correct
`aria-expanded` disclosure behavior. The retention seam already exists:
`src/webmcp/useWebMcpTools.ts:25` defaults `historyLimit = 20`. The
`.agent-activity`, `.agent-status`, `.agent-calls`, and `.agent-tool-count`
rules at `src/study/study.css:280-339` should **move out of `study.css`**, not
be re-pointed. Leaving diagnostics styling in the study stylesheet is how it
comes back.

**Caution — one thing is not diagnostics.** The compact semantic guidance
indicator that W6 is building is *not* covered by this rule and must not be
swept out with it. `VAL-TUTOR-SESSION-LIFECYCLE` requires that indicator to be
"mounted outside panel replacement and chrome recession" — meaning it lives
neither in `StudyBoardPanel` nor in `.reader-chrome`. W8 should not treat
"remove agent UI from Study" as license to remove it.

### 1.5 Composed lesson presentation

**Observation — the current renderer leads with the storage type.**
`src/study/StudyItemCard.tsx:70-72` renders `data-kind` and then
`<span className="study-item-kind">{item.payload.kind}</span>` as the first
visible text in every card. The word a learner reads first is `equation`,
`prose`, or `steps`. `VAL-STUDY-COMPOSITION-HIERARCHY` requires the opposite:
title and teaching progression outrank block-type metadata, and "obvious storage
labels are absent from ordinary reading mode" (accepted).

**Observation — equations are rendered as code by design.**
`StudyItemCard.tsx:26-32` puts `payload.expression` in a `<pre>`. For a calculus
book this is the single most visible quality gap in the product, and it is on
the hero path.

**Resolution and sequencing.** These are two different waves and conflating
them is a real risk:

- The `<pre>` → rendered math change belongs to **W7**
  (`VAL-STUDY-MATH-RENDERING`), because it needs the strict validated renderer
  and its fallback semantics.
- Killing the kind label and leading with the lesson title belongs to **W8**
  (`VAL-STUDY-COMPOSITION-HIERARCHY`), because it is a composition decision that
  needs the experience container to exist first.

**Proposal — three composition rules W8 should hold itself to, none of which
is currently written down as a testable thing:**

1. **One heading, and it is the lesson's.** `StudyBoardPanel.tsx:80` renders
   `board?.title ?? 'Study'` as the panel `<h2>`. A lesson also has a title.
   Two titles competing for one heading is recorded at
   `docs/reviews/2026-09-02-lesson-workspace-contract-review.md:83`. The panel
   heading should name the surface; the lesson title should be the first
   heading *inside* it, and it is the one `reveal_study_item` focuses.
2. **The shared source appears once.** `VAL-STUDY-COMPOSITION-HIERARCHY` says
   this; the implementation risk is that `StudyItemCard.tsx:100-111` renders a
   per-item "Go to source" button, so a six-block lesson from one passage would
   show six identical source buttons. The lesson-level source belongs in the
   lesson header, and a block only renders its own when it *differs*.
3. **The first viewport is learning content.** Currently the first viewport is
   agent telemetry (`StudyBoardPanel.tsx:107`), then the add-row of five kind
   buttons (`:109-126`), then content. After W8 the order must invert:
   content, then authoring, with additional kinds progressively disclosed.

### 1.6 The W6 navigation / W9 presentation split

**Accepted and now clean.** `VAL-TUTOR-PASSAGE-FOCUS` owns verification,
navigation, session origin, and the indicator, and states explicitly "It does
not yet draw emphasis on the book." `VAL-TUTOR-PASSAGE-CUE` owns the drawn cue
and lives in W9. `VAL-TUTOR-OVERLAY-ISOLATION` sits in W6 and proves the seam
with a test-only sentinel before any public cue exists. This is the right split
and this review does not reopen it.

**One implementation risk that spans the seam.**
`src/reader/FoliateReaderAdapter.ts:300-315` is a delete-and-re-add renderer: it
computes `kept`, deletes every previous mark not in the new set, then calls
`addAnnotation` for **every** mark in the new set on each invocation. It is
re-invoked on every `create-overlay` event (`:392`), i.e. on every section
change. `src/domain/reader.ts:111-130` exposes exactly one annotation seam,
`renderAnnotations`.

So if W9's cue is expressed as a mark through that same path, an ordinary page
turn erases it — or worse, the cue's presence in the mark array causes a durable
highlight at the same CFI to be dropped. `VAL-TUTOR-OVERLAY-ISOLATION` requires
a *dedicated* seam whose "lifecycle and identifiers are separate from durable
annotation rendering," which means a second adapter method and a second
identifier space, decided in W6.

**Proposal.** W6's spike should land the seam as a real adapter method with a
real second identifier space, not as a research note. If W6 ends with the seam
"selected" but not present in `ReaderAdapter`, W9 will be under time pressure
and will reach for `renderAnnotations`, and the failure will be a durable
highlight disappearing during the recorded demo.

---

## Part 2 — W7: cohesive durable study domain

Targets: `VAL-STUDY-SCHEMA-SECURITY`, `VAL-STUDY-MATH-RENDERING`,
`VAL-INTERACTIVE-PLOT`, `VAL-STUDY-EXPERIENCE-LIFECYCLE`,
`VAL-STUDY-SAFE-REMOVAL`.

### 2.1 Current code seams

| Seam | Location | State at `4780220` |
|---|---|---|
| Block union | `src/domain/study.ts:39-54` | five standalone kinds; no experience type |
| Storage version | `src/storage/schema.ts:3` | `STORAGE_SCHEMA_VERSION = 4` |
| Item table | `src/storage/schema.ts:51-67` | has `origin`, `update_token`, `action_group_id`, `revision`, `source_json` |
| Version history | `src/storage/schema.ts:71-81` | `study_item_versions` already stores every superseded revision |
| Idempotency | `src/storage/schema.ts:87-96` | `action_receipts` keyed `(book_id, origin, action_token)` with a payload digest |
| Mutation authority | `src/domain/study.ts:86-101` | `create`/`update` only; no delete operation for agents |
| Removal | `src/storage/library-repository.ts:641-643` | **hard `DELETE FROM study_items`** |
| Renderer | `src/study/StudyItemCard.tsx:14-57` | five branches; equation is `<pre>` at `:29` |
| Agent write path | `src/webmcp/tools.ts:527-628` | `upsert_study_item`, inline `oneOf` per kind |
| Read path | `src/webmcp/tools.ts:628-643` | `list_study_items` returns `JSON.stringify(payload)` per row |

**The strongest seams W7 inherits.** `study_item_versions` and
`action_receipts` are already the right shape for
`VAL-STUDY-EXPERIENCE-LIFECYCLE`'s revision and idempotency requirements. The
ownership token model in `src/domain/study.ts:77-101` already implements
`VAL-STUDY-ID-OWNERSHIP` exactly. W7 extends proven machinery rather than
inventing it — this wave is smaller than it looks.

**The weakest seam.** `library-repository.ts:641-643` is an unconditional hard
delete with no tombstone. `VAL-STUDY-SAFE-REMOVAL` requires a persisted
ten-minute tombstone that survives reload and restores "the exact record,
ordering, source relationship, provenance, and revision." That is a schema v5
migration and it is on W7's critical path.

### 2.2 Prerequisite decisions

1. **Experience storage shape.** One `study_experiences` row with a JSON blob
   of ordered blocks, or a separate `experience_blocks` table? **Proposal: one
   row, one validated JSON payload.** `VAL-STUDY-EXPERIENCE-LIFECYCLE` demands
   "one atomic command" and "rejected or mid-write calls leave zero partial
   records." A single row makes atomicity free; a block table makes every write
   a transaction that must be proven not to half-apply. The block cap is 16, so
   there is no query pressure justifying normalization.
2. **Do standalone items and experiences share a table?** **Proposal: no.** A
   separate `study_experiences` table with its own `id` space, and a
   `board_id` FK. `docs/reviews/2026-09-02-lesson-workspace-contract-review.md`
   flags a nullable-FK design as a defect; a separate table avoids the question.
   Ordering across mixed content then needs one decision — see 2.3.
3. **The TeX renderer.** No dependency exists. The choice must be made before
   W7 starts because it is the only new runtime dependency in the wave and it
   interacts with CSP. **Constraint from `vite.config.ts:10-17`:** `script-src
   'self' 'wasm-unsafe-eval'` with **no `'unsafe-eval'`**, and `style-src 'self'
   'unsafe-inline' blob:`. A renderer that compiles expressions via `Function`
   is blocked at the CSP layer, which is the correct outcome and worth asserting
   as evidence. `font-src 'self' blob: data:` means any renderer's fonts must be
   self-hosted, not CDN-loaded — the same treatment
   `@fontsource-variable/*` already gets.
4. **Tombstone scope.** Does the ten-minute tombstone cover annotations too?
   `VAL-STUDY-SAFE-REMOVAL` says "an item, lesson, highlight, or note" —
   yes, all four. `src/app/commands.ts:359-361` deletes annotations with no
   tombstone either, and `src/reader/ReaderScreen.tsx:416-418` calls it with a
   bare `void`. Both paths need the same treatment.

### 2.3 Collision risks

- **Codex owns W6 and is editing the same tree.** W7's schema v5 migration
  touches `src/storage/schema.ts`, `library-repository.ts`, `protocol.ts`, and
  `client.ts`. W6 touches the reader/session/navigation files and
  `commands.ts`. `commands.ts` is the overlap — W6 adds `focus_passage` and
  `control_guidance` command methods, W7 adds experience mutations. Land W6's
  command surface before starting W7's, or expect a merge in a 742-line file.
- **`upsert_study_item`'s inline schema is a shared blast radius.** W7 adds a
  new tool rather than extending it (see 1.2), but both live in the same array
  in `src/webmcp/tools.ts:166-700`, and `VAL-DEPLOYED-RUNTIME-TRUTH` asserts an
  exact tool manifest. Every tool added in W7 or W9 changes the deployed count
  that W10 asserts (13 today, per `docs/plan/current-work.md`).
- **Ordering across mixed content.** `study_items.sort_order` is per board
  (`library-repository.ts:645-660`, `nextStudyItemOrder`). If experiences get
  their own table with their own ordering, the board has two sequences and no
  defined interleaving. **Proposal:** keep one `sort_order` space allocated by
  the board, with experiences and standalone items drawing from the same
  counter, so `VAL-STUDY-COMPOSITION-HIERARCHY`'s "existing learning content
  precedes manual authoring" has a single total order to work with.

### 2.4 Recommended sequence

1. Schema v5: `study_experiences`, `study_experience_versions`, and the
   tombstone table. Migration test first, from a real v4 database.
2. `src/domain/experience.ts` — the block union, the validator, and the limits.
   Pure, no React, no storage. Drive it entirely from the three frozen fixtures.
3. Repository + protocol + client for atomic create/update/undo/remove.
4. The renderer: math first (it is the visible one), then plot, then the
   fallbacks — `mermaid` as validated-with-fallback per 1.1.
5. `interactive_plot` interaction and its keyboard model.
6. The new WebMCP tool, last, once the domain is stable.

Rationale: every step before 6 is testable without a browser, and the fixtures
already exist, so the wave front-loads its own oracle.

### 2.5 Real-surface evidence

- Migration from a genuine v4 OPFS database written by `16233d0`, not a
  synthetic one. `tests/unit/storage-persistence.test.ts` is the existing
  pattern.
- Hostile corpus through the **production** CSP, with the network trace
  preserved. `tests/e2e/production-test-controls.spec.ts:41` already asserts the
  deployed policy string; extend that spec's approach rather than a new harness.
- The `mermaid-click` case must produce a *visible* error, not a silent skip.
- Math and plot screenshots under all shipped themes at desktop and 320px, per
  `VAL-STUDY-MATH-RENDERING`. The reader theme tokens are at
  `src/reader/reader.css:117-140`; a study block that hard-codes a color instead
  of consuming `--ink`/`--rule`/`--accent` will pass a light-theme screenshot
  and fail night reading.
- `VAL-STUDY-SCHEMA-SECURITY` requires a production source scan proving no
  fixture title, coordinate, or oracle value is compiled in. Plan for it: the
  natural way to make a plot work is to test it against `slope.json`, and the
  natural way to make that easy is to import the fixture.

### 2.6 How a green W7 could still miss the North Star

- **The lesson is a container and nothing more.** If `upsert_study_experience`
  produces the same five kinds in a titled box, the wave has added a database
  table and no teaching. The North Star's step 6 asks for "one titled, coherent
  study lesson — ideally visual or interactive — rather than a feed of unrelated
  records." The interactive plot is the difference; ship it working, not
  merely accepted by the validator.
- **Math that renders but is not readable.** `VAL-STUDY-MATH-RENDERING` asks
  for "readable spacing, a secondary caption, and accessible source text." A
  correct KaTeX-style render at 13px inside a 240px docked panel satisfies the
  contract and fails the learner. Check it at the docked width first, not the
  expanded one.
- **Safe removal that nobody can find.** A tombstone with no visible Undo is a
  database feature. The Undo affordance must be where the deletion happened.
- **The validator becomes the product.** The largest risk in W7 is spending the
  wave on `VAL-STUDY-SCHEMA-SECURITY`'s twenty-odd limits — which are
  enumerable, testable, and satisfying to complete — and arriving at W8 with a
  hardened schema and an unchanged-looking Study panel.

---

## Part 3 — W8: Study workspace composition and recovery

Targets: `VAL-STUDY-COMPOSITION-HIERARCHY`, `VAL-AGENT-ACTIVITY-PRESENTATION`,
`VAL-STUDY-WORKSPACE-RESPONSIVE`, `VAL-STUDY-LOAD-RECOVERY`.

### 3.1 Current code seams

| Seam | Location | State |
|---|---|---|
| Panel props | `src/study/StudyBoardPanel.tsx:15-39` | 20 props including `agentActivity` at `:38` |
| Telemetry mount | `StudyBoardPanel.tsx:107` / `ReaderScreen.tsx:441-448` | rendered first in the panel body |
| Diagnostics styling | `src/study/study.css:280-339` | lives in the study stylesheet |
| Retention limit | `src/webmcp/useWebMcpTools.ts:25` | `historyLimit = 20` — already the contract number |
| View state | `src/app/surface.ts:15,23-30` | `ReaderPanel` union, `BoardMode`, `BoardReversal` |
| Expanded layout | `src/reader/ReaderScreen.tsx:93` | `expanded = board?.view === 'expanded' && panel === 'study'` |
| Mobile panel rule | `src/reader/reader.css:495,524-528` | one surface at a time at `(max-width: 860px), (pointer: coarse)` |
| Load failure | `src/study/useStudy.ts:61-87,140` | `error` produced, never consumed |
| Mutation failure | `useStudy.ts:59` + `StudyBoardPanel` `mutationError` | this half **is** wired and visible |

**Observation.** The mutation-error path is already good — `MutationFailure`
carries a message and a `retry` closure (`useStudy.ts:40-43`), and it reaches
the panel. `VAL-STUDY-LOAD-RECOVERY` is therefore mostly about the *load* half
and the promise-rejection half, not a rebuild.

### 3.2 Prerequisite decisions

1. **Where does diagnostics live?** Options: a fifth reader panel, a
   library-level surface, or a collapsed disclosure in the reader footer.
   **Proposal: not a reader panel.** `src/app/surface.ts:15` `ReaderPanel` is
   `'contents' | 'search' | 'text' | 'study' | null`, and adding a fifth
   competes with the book for the one slot mobile has. Diagnostics is an
   inspection surface, not a reading surface. A disclosure anchored outside the
   panel region — the same place the W6 guidance indicator must live — keeps
   `VAL-AGENT-ACTIVITY-PRESENTATION`'s "new calls never ... change Study
   geometry" trivially true.
2. **What does expanded actually become?** `VAL-STUDY-WORKSPACE-RESPONSIVE`
   requires "a meaningfully different centered lesson workspace ... not merely
   the same feed widened," and `docs/reviews/2026-09-02-study-surface-code-review.md:137`
   already found that expanded currently changes allocation, not composition.
   This is the wave's most under-specified deliverable and needs a design
   decision before implementation, not during.
3. **Does the board load failure block reading tools?** See 1.3. This is an
   owner decision because it changes what the agent sees during a failure.
4. **Manual authoring parity.** The composer at `StudyBoardPanel.tsx:104-126`
   creates standalone items only. Can a person create an *experience* with no
   agent? `VAL-STUDY-COMPOSITION-HIERARCHY` requires "No-agent use remains
   complete." **Proposal: a person creates standalone items manually and can
   promote a selection of them into a titled lesson.** Building a full manual
   block-composer inside W8 is a second product; promotion is one command and
   satisfies "complete" honestly.

### 3.3 Collision risks

- **W8 rewrites `StudyBoardPanel.tsx` while W9 needs a stable scroll target.**
  `VAL-TUTOR-STUDY-REVEAL` requires `reveal_study_item` to scroll "the exact
  target into view" and focus "its meaningful heading." If W8 has not settled
  what the meaningful heading *is* (see 1.5, rule 1), W9 cannot implement it.
  The build tasks already record this: W9 "Depends on: ... W8 stable study
  destinations."
- **Removing telemetry from Study and adding the guidance indicator are
  opposite-direction changes in the same region.** Sequence them: strip first,
  then mount the indicator in its own owner (which W6 should already have
  built), never both in one edit.
- **The `focusNonce` mechanism is load-bearing for W9.**
  `src/app/surface.ts:36-38` and `StudyBoardPanel.tsx:76` implement
  focus-on-demand via a counter. `reveal_study_item` needs the same mechanism
  aimed at an item rather than the panel heading. Preserve the counter pattern
  when rewriting the panel; a boolean will not survive two consecutive reveals.

### 3.4 Recommended sequence

1. Delete `agentActivity` from `StudyBoardPanelProps` and its render site; move
   `study.css:280-339` into a diagnostics stylesheet; build the diagnostics
   surface with its disclosure semantics.
2. Fix the load-failure chain (1.3), including the tool-availability decision.
3. Recompose the panel: lesson heading, shared source once, content before
   authoring, kind labels out of ordinary reading mode.
4. Expanded workspace as a genuinely different composition.
5. Mobile focused replacement and the 320px / 200%-reflow passes.
6. Two-pass Impeccable critique, once the surface has stopped moving.

Step 1 first because it is pure subtraction and unblocks everything visual;
step 2 second because it is the highest-severity defect and it is independent
of composition.

### 3.5 Real-surface evidence

- A genuine multi-call trace showing Study geometry unchanged across twenty
  calls, per `VAL-AGENT-ACTIVITY-PRESENTATION`.
- Deterministic `getBoard` rejection at the await boundary in
  `useStudy.ts:65` — the fault seam must be test-only and excluded from the
  production bundle, which `tests/e2e/production-test-controls.spec.ts` already
  has a pattern for.
- An unhandled-rejection listener, explicitly required by the contract.
  `src/reader/ReaderScreen.tsx:416-418` has a bare `void study.commands?.deleteAnnotation(...)`
  with no catch — that is exactly the shape the listener exists to catch.
- Measured geometry, not screenshots alone, for docked vs expanded. "Meaningfully
  different" needs a number to be falsifiable.
- Every theme, including publisher mode, because study blocks that hard-code
  color pass light and fail the rest.

### 3.6 How a green W8 could still miss the North Star

- **Telemetry moves to a drawer and the drawer becomes the demo.** The point of
  separating diagnostics is that the *learner* never sees machinery. If the
  recorded demo opens the diagnostics panel to prove WebMCP is working, the
  product has re-taught the lesson the contract removed. Prove WebMCP by what
  the book and the board *do*.
- **The lesson reads as a prettier feed.** Removing the kind label is not the
  same as composing. If a lesson still reads as blocks stacked in insertion
  order with a title on top, `VAL-STUDY-COMPOSITION-HIERARCHY` can pass on its
  DOM assertions while the North Star's "coherent lesson, not a feed of
  unrelated records" fails.
- **Expanded is docked with more pixels.** The contract names this failure
  explicitly; it is also the easiest one to ship accidentally, because
  `ReaderScreen.tsx:93` already computes `expanded` and the cheapest change is
  a wider `max-width`.
- **No-agent use degrades.** Every W8 change is motivated by agent-composed
  lessons. The person with no agent must end the wave with a *better* board
  than they started with, not a board optimized for content they cannot create.

---

## Part 4 — W9: embodied tutor interactions

Targets: `VAL-TUTOR-PASSAGE-CUE`, `VAL-TUTOR-STUDY-REVEAL`,
`VAL-TUTOR-PRESENTATION-SAFETY`.

### 4.1 Current code seams

| Seam | Location | State |
|---|---|---|
| Adapter interface | `src/domain/reader.ts:111-130` | one annotation seam, `renderAnnotations` |
| Durable renderer | `src/reader/FoliateReaderAdapter.ts:300-315` | delete-then-re-add across the whole mark set |
| Overlay owner | `FoliateReaderAdapter.ts:102,319,381-383` | `#overlayer` from `module.Overlayer`; `draw-annotation` handler |
| Re-render trigger | `FoliateReaderAdapter.ts:390-392` | `create-overlay` → `renderAnnotations(this.#marks)` on every new section |
| Mark model | `src/study/useStudy.ts:108-118` | `marks` derived from annotations; CFI + color only |
| Focus mechanism | `src/app/surface.ts:36-38`, `StudyBoardPanel.tsx:76` | `focusNonce` counter |
| Board open without preference change | `src/app/surface.ts:79-84` | `openBoard({focus})` already exists and does not touch the stored view |

**Observation — `set_study_board_view`'s `focus` mode is already exactly what
`reveal_study_item` needs at the panel level.** `src/webmcp/tools.ts:644-700`
documents `focus` as "brings the board forward and moves focus to it without
changing their preference," and `SurfaceStore.openBoard` implements it. W9's
reveal is that plus a scroll target and an item-level focus. This is a smaller
tool than it appears.

### 4.2 Prerequisite decisions

1. **The overlay seam must exist before W9 starts.** See 1.6. This is W6's
   deliverable (`VAL-TUTOR-OVERLAY-ISOLATION`) and W9's hardest dependency.
2. **Where does the explanation render?** `VAL-TUTOR-PRESENTATION-SAFETY` says
   `present_explanation` "attaches it to the active verified source cue" —
   which places it in the book region, over publisher content, in the tutor
   overlay layer. That is the hardest possible placement: it must not reflow the
   book, must survive pagination, and must be reachable by keyboard.
   **Proposal:** render it in the reader shell anchored to the cue's geometry,
   not inside the EPUB document. Injecting into the book document would violate
   the containment boundary that `src/webmcp/design-context.ts:210-217` tells
   agents is enforced ("cannot style the library, reader chrome, panels").
3. **Does the cue survive a page turn within the same section?** The contract
   lists the terminal transitions that remove it (takeover/yield, new focus,
   Back, Stop, close, detach, book change, reload) and a page turn is not among
   them — but a page turn *is* learner navigation, which
   `VAL-TUTOR-SESSION-LIFECYCLE` classifies as takeover. So the cue does not
   survive. Worth stating explicitly because the implementation will be tempted
   to keep it "just while the section is the same."
4. **Cue message vs. indicator message.** `VAL-TUTOR-PASSAGE-CUE` says the cue
   message "is distinct from the W6 indicator message." Two 1,000-unit plain
   text fields on one call is a real risk of both being rendered at once. Decide
   the visual relationship before building either.

### 4.3 Collision risks

- **The delete-and-re-add renderer is the single biggest one.** If the cue and
  durable highlights ever share the mark array, `FoliateReaderAdapter.ts:307-309`
  will delete one when the other changes. `VAL-TUTOR-OVERLAY-ISOLATION`'s
  evidence requirement — "repeated durable-mark rerenders and sentinel removal"
  — exists precisely to catch this, and it must be run against the real Foliate
  fixture (`tests/unit/reader-foliate-fixture.test.ts` is the existing pattern),
  not a stub.
- **Generation guards must already exist.** `VAL-TUTOR-PASSAGE-CUE` requires
  "generation-guarded delayed-render races" and `VAL-TUTOR-STUDY-REVEAL`
  requires that stale work "cannot reopen Study, scroll, or steal focus." Both
  depend on the runtime-monotonic generation that `VAL-TUTOR-SESSION-LIFECYCLE`
  builds in W6. W9 must not invent a second one.
- **Tool count.** W9 adds `reveal_study_item` and `present_explanation` and
  extends `focus_passage`. With W6's `focus_passage` and `control_guidance` and
  W7's experience tool, the deployed manifest goes from 13 to roughly 18 —
  which is the number `VAL-DEPLOYED-RUNTIME-TRUTH` asserts. That assertion is
  W10's, and it is only satisfiable after W9 deploys.

### 4.4 Recommended sequence

1. `reveal_study_item` first. It reuses `openBoard({focus})` and the
   `focusNonce` pattern, touches no overlay code, and is the fastest route to a
   visible tutor capability.
2. The cue, on the isolated seam, with the same-CFI coexistence test written
   before the cue renders.
3. `present_explanation` last — it is the most constrained and the least
   load-bearing for the hero path.

If W9 is compressed, cut in that reverse order: the explanation is the piece a
capable model can substitute with its own chat reply at no loss to the
demonstration, whereas pointing at the exact passage cannot be substituted at
all.

### 4.5 Real-surface evidence

- Same-CFI coexistence: a durable highlight and a cue at identical CFIs,
  asserted before, during, and after repeated durable rerenders, plus a storage
  snapshot proving the cue wrote nothing.
- Reload absence, with the storage snapshot as the proof rather than the
  screenshot.
- Contrast and reduced-motion behavior for all three cue kinds. `underline`,
  `highlight`, and `outline` behave very differently against sepia and night
  tokens.
- Mobile placement for both the cue message and the explanation, at 320px.
- `reveal_study_item`'s Back fallback — the contract requires focusing "the
  stable Library toolbar button" and "report[ing] that fallback truthfully."
  That named fallback needs an assertion, not a best effort.

### 4.6 How a green W9 could still miss the North Star

- **Pointing that a person cannot tell apart from highlighting.** The North Star
  is explicit: "A permanent highlight is not a substitute for pointing." If the
  cue looks like a highlight, the learner learns that the agent highlighted
  their book — and the reload-absence test passing does not undo that
  impression. The cue must read as *temporary* at a glance.
- **A reveal that hijacks.** `VAL-TUTOR-STUDY-REVEAL` allows opening Study
  transiently. On mobile that *replaces the book*. An agent that reveals
  mid-sentence takes the page away from a reading learner. The contract's
  requirement to leave the stored preference alone is necessary but not
  sufficient; the interaction should feel offered, not executed.
- **Three tools that never compose.** The North Star's decisive demonstration
  is one continuous motion: retrieve, move, point, explain, then keep. If each
  W9 tool passes its own contract but the four-step sequence has never been run
  end-to-end by a real model, W9 is green and W10 has nothing to record.
- **Explanation becomes chat.** `present_explanation` is 2,000 characters of
  plain text anchored in the reading surface. It is one step from being a chat
  bubble in an ebook reader — the exact product the North Star opens by
  rejecting. Keep it short, anchored, and clearly transient, and prefer moving
  the learner to a real lesson over saying more.

---

## Part 5 — Cross-wave sequencing

**The dependency that actually orders the road** is not W7 → W8 → W9. It is:

- W6's **overlay seam** and **generation counter** gate W9 entirely.
- W7's **stable lesson IDs** gate `reveal_study_item`.
- W8's **meaningful heading** gates `reveal_study_item`'s focus target.
- W7's **math renderer** is the only W7 deliverable on the hero path; the
  validator limits are not.

**Proposal — one reordering worth considering.** `reveal_study_item` depends
only on stable IDs and a heading, both of which exist today in weaker form
(`StudyItem.id`, `StudyBoardPanel.tsx:80`). If time compresses, pulling
`reveal_study_item` forward into W8 — where the panel is already open on the
bench — costs less than deferring it behind a full W7. It is also the cheapest
tool that makes the WebMCP thesis visible: the agent says "look at what we made"
and the page does it.

**What to protect if the road collapses**, following
`docs/plan/vertical-slice-build-order.md` ("Cut order if time collapses"):
stable source citations, return-to-book navigation, the real WebMCP path, and
persistence of the hero artifact. Rendered math and the interactive plot are the
two additions that most raise the ceiling; the schema's limit table and the
Mermaid renderer are the two that least do.

---

## Part 6 — Blockers, ordered by risk to the product

1. **Study load failure silently unregisters ten WebMCP tools**
   (`useStudy.ts:61-87` → `ReaderScreen.tsx:89-91` → `App.tsx:51-52`). Highest
   severity: it is invisible, it is on the judged surface, and its symptom looks
   exactly like "this app does not implement WebMCP." Needs the
   tool-availability decision in 1.3 before W8 starts.
2. **No overlay seam exists yet** (`src/domain/reader.ts:111-130` has one
   annotation method; `FoliateReaderAdapter.ts:300-315` deletes and re-adds
   every mark). W9 is fully blocked, and the failure mode is durable highlights
   vanishing during the demo. This is W6's to land as real code, not as a
   selected approach.
3. **No math renderer dependency exists**, and CSP forbids `'unsafe-eval'`
   (`vite.config.ts:10`). W7's most visible deliverable has an unmade dependency
   decision. Equations are `<pre>` today (`StudyItemCard.tsx:29`) on a calculus
   book.
4. **Hard delete with no tombstone** (`library-repository.ts:641-643`, and the
   same for annotations at `commands.ts:359-361`). `VAL-STUDY-SAFE-REMOVAL`
   requires a schema v5 migration; it is easy to defer and painful to retrofit
   after experiences exist.
5. **`agentActivity` is a typed socket in the study panel**
   (`StudyBoardPanel.tsx:38,107`). Until the prop is deleted, the diagnostics
   rule is a convention, and conventions lose to deadlines.
6. **Expanded workspace is undesigned.** `VAL-STUDY-WORKSPACE-RESPONSIVE`'s
   "meaningfully different composition" has no decided answer, and it is the one
   W8 deliverable that cannot be derived from a contract sentence.
7. **The mermaid clause reads as requiring a renderer** even though no frozen
   fixture asserts one (1.1). Left unreconciled, it puts the largest bundle in
   the project on W7's critical path for the least teaching value.
8. **Two 1,000-character message fields** across `focus_passage`'s indicator and
   W9's cue, with no decided visual relationship (4.2.4).

---

## Appendix — files cited

`src/domain/study.ts`, `src/domain/reader.ts`, `src/domain/index.ts`,
`src/study/useStudy.ts`, `src/study/StudyBoardPanel.tsx`,
`src/study/StudyItemCard.tsx`, `src/study/study.css`,
`src/reader/ReaderScreen.tsx`, `src/reader/FoliateReaderAdapter.ts`,
`src/reader/reader.css`, `src/app/commands.ts`, `src/app/surface.ts`,
`src/App.tsx`, `src/webmcp/tools.ts`, `src/webmcp/AgentActivity.tsx`,
`src/webmcp/useWebMcpTools.ts`, `src/webmcp/design-context.ts`,
`src/storage/schema.ts`, `src/storage/library-repository.ts`,
`vite.config.ts`, `index.html`, `package.json`,
`tests/fixtures/study-experience/{slope,non-slope,hostile}.json`,
`tests/e2e/production-test-controls.spec.ts`.
