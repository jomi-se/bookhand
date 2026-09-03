# Full-product Impeccable audit

Date: 2026-09-03. Commit under review: **`57edfab`** ("Add composed study lessons"),
the requested `57edfab`. Working tree clean apart from the untracked, user-owned
`IDEAS.md`, which was excluded from every pass. `main` is **one commit ahead of
`origin/main` (`bf7b2f0`)**, so everything below describes the *local* build, not
the deployed one.

Method: Impeccable v4.1.3, `critique` + `audit` guidance, run as **dual-agent**
— Assessment A (design review) and Assessment B (detector plus code audit) ran
as two isolated sub-agents that never saw each other's output, with A completed
before any detector finding entered the synthesis context. Read-only throughout:
no source file, test, contract, plan, `DESIGN.md`, `PRODUCT.md` or `AGENTS.md`
was modified, and nothing was committed.

Evidence tiers are marked throughout:
**[B]** directly observed in a browser, **[D]** deterministic (code or detector),
**[I]** informed inference.

---

## 1. What was actually exercised

The project's Playwright MCP launches Chromium **without**
`--enable-features=WebMCPTesting`, so `document.modelContext` does not exist
there and no agent capability can be driven through it. A capture harness was
therefore written for this audit
(`.impeccable/review/full-product-2026-09-03/capture.mjs` and four companions)
which launches Chromium with the flag against the **local production build**
(`npm run build`, served at `http://127.0.0.1:4173`) and drives the shipped
WebMCP tools directly. **23 tools were confirmed live**, matching the
twenty-three claimed in `docs/plan/current-work.md:8`.

| Surface | States reached | Viewports |
|---|---|---|
| Library | cold (never opened), Continue-reading, footer agent line | 1440, 390, 320 |
| Reader | cover, chapter, page turn, footer progress | 1440, 1024, 390, 320 |
| Contents | open, current-chapter highlight, close | 1440 |
| Search | checking, `Preparing search · 32 of 36 sections`, ready, results, no-results | 1440, 390 (coarse) |
| Text controls | all four sliders, Book CSS, `Reset all text settings` present at `TextPanel.tsx:245` | 1440 |
| Theme worlds | publisher, light, sepia, dark + eight switch transitions + page turn + reload | 1440 |
| Study | empty, composed lesson (5 blocks), question reveal, source-linked lesson, legacy Notes, Highlights, docked, expanded | 1440, 390, 320 |
| Tutor | cue at whole-visible scope, cue at paragraph scope, indicator, Back, Stop, learner click | 1440 |
| Remaster | `get_section_source`, `edit_section`, bar, Original/Rewritten, Undo | 1440, 390 |
| Diagnostics | Study panel scanned for tool-name and call-history leakage | 1440 |
| Keyboard | first focus ring, panel focus-on-open for all four panels | 1440, 390 |

Artifacts: 37 screenshots plus `measurements.json`, `verify.json` under
`.impeccable/review/full-product-2026-09-03/` (git-ignored).

**Not reached, and why.** Search *failure* state (`status: 'failed'`) — no
fault could be injected read-only. Reduced-motion rendering — asserted from code
and the existing `tutor-guidance` e2e, not re-observed. Full keyboard tab-order
beyond first focus and panel entry. EPUB import of a user file. Physical touch
device (ADR 0003 already treats this as non-gating). Theme persistence across
reload was sampled but the result was ambiguous and is **not** reported as a
finding. Deployed-origin behaviour was deliberately not inspected: the brief
asked for local truth, and local is one commit ahead.

---

## 2. Scorecards

### Design health (Nielsen, 0–4)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Search readiness is exemplary; the Text panel shows Dark as pressed while the book still renders the previous theme |
| 2 | Match system / real world | 3 | Calm literary copy, broken by machine phrasing such as `too many semantic segments (73; maximum 64)` |
| 3 | User control and freedom | 3 | Back, Stop, Undo, Reset all exist and publisher bytes stay immutable; a lesson can only be deleted, never undone |
| 4 | Consistency and standards | 3 | Strong adherence to `DESIGN.md`; the Search panel and remaster bar are the two dialects that diverge |
| 5 | Error prevention | 2 | Nothing guards a theme switch that renders the book unreadable |
| 6 | Recognition rather than recall | 2 | Original/Rewritten is an A/B flip with no change indication |
| 7 | Flexibility and efficiency | 3 | Four themes, four typography axes, Book CSS, docked/expanded, bounded result limit |
| 8 | Aesthetic and minimalist design | 3 | The reader is genuinely beautiful; undermined by the cold library and the whole-page tutor cue |
| 9 | Error recovery | 2 | Study's Try again / Dismiss is well done; agent-facing errors are dead ends |
| 10 | Help and documentation | 1 | Nothing anywhere explains what an agent can do here or how to begin |

**Total: 25 / 40 — competent with real gaps.** No heuristic was `n/a`. The
distribution is the finding: the *reading* product scores 3s, the *agent* product
scores 1s and 2s.

### Technical audit (0–4)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | 24 correctly discriminated live regions and AA+ contrast in all three painted themes; but Search alone never receives focus on open, and index lifecycle controls are 15px tall on touch |
| 2 | Performance | 4 | Zero `@keyframes`, zero `will-change`, zero blur/filter, one 3px shadow, three layout reads and none in a loop; library visible ~1.0s, book rendered ~2s **[B]** |
| 3 | Theming | **2** | Four complete semantic token worlds that **do not survive their own switch** at runtime |
| 4 | Responsive | 3 | Zero page-level overflow at 1440/1024/390/320; one 6px negative-margin bleed, and sub-44px targets inside the Search panel |
| 5 | Implementation integrity | 3 | Overwhelmingly product-specific and self-documenting; two surfaces authored to a different standard |

**Total: 15 / 20 — Good.**

Theming is scored **2 rather than the 3 the code review assigned**, and the
disagreement is the most instructive result of this audit. Assessment B read
`FoliateReaderAdapter.ts:1509` and correctly praised the design: the book is fed
the shell's *live* computed tokens so the two can never drift, and
`FALLBACK_THEMES` is honestly documented as test-only. That reasoning is sound
on the page and wrong in the browser — the live read is exactly what fails. A
static audit cannot see it; only the running product can. Where the two
assessments conflict, the browser wins.

---

## 3. What is already excellent, and must survive any fix

1. **Search's readiness model is the best-designed thing in the product.** The
   header carries `Preparing search · 32 of 36 sections` as one live-region
   sentence, the form stays usable throughout, results stream from the partial
   index, and `Pause indexing` is a text button that never competes with the
   primary action **[B]**. It refuses both lazy options — a spinner that says
   "wait" without saying why, and a modal that says "you may not" — and states
   an actionable fact instead. Do not touch this except to fix its target sizes.
2. **The diagnostics boundary is enforced, not merely intended.** The Study
   panel scan returns `leaks: []` and `agentActivityNodes: 0` **[B]** while the
   tool result for the same operation is full of machinery. Two audiences, two
   surfaces, neither polluted.
3. **The Borrowed Voice Rule holds under pressure.** Search excerpts are set in
   `var(--serif)` (`reader.css:116-123`) inside a sans panel; the study
   quotation is serif while its sibling `Reading a slope` heading is sans
   **[D][B]**. Typography is doing semantic work — telling you at a glance whose
   words these are.
4. **Composition of the lesson itself is right.** Title, provenance line,
   then prose → quotation → equation → steps → question, ruled rather than
   carded, at a 48rem measure (`32-study-sourced-lesson.png`). This reads as a
   lesson, not a feed.
5. **Reversibility is real where it exists.** `edit_section` → `Undo` restored
   the chapter and removed the bar **[B]**; publisher bytes are preserved; the
   remaster bar returns `null` on an untouched book (`RemasterBar.tsx:52`), so
   the capability leaves no permanent trace.
6. **Performance posture is close to ideal** and the `pdf-*.js` /
   `sqlite3-worker1-*.js` chunks are **never fetched** — verified by network
   capture before anyone reported them as weight **[B]**.

---

## 4. Priority findings

Five, capped as requested. Everything else is in §5 and §6.

### [P0] A theme switch leaves the book one theme behind, and Dark erases every equation

**Observed [B].** The EPUB content renders the *previously selected* theme in
every transition. From `verify.json` `themeWalk`:

| Step | Shell | Book |
|---|---|---|
| Light | light | light ✓ |
| Sepia | sepia | **light** |
| Dark | dark | **sepia** |
| Light | light | **dark** |
| Dark | dark | **light** |

It does not self-heal on a page turn (`darkAfterPageTurn`: shell `#171717`, book
canvas still light). Assessment A independently reproduced it live at 412px.

The compounding failure is the demo-killer. `v-theme-dark-from-light.png` shows
a dark shell around a white page on which **every inline mathematical glyph has
vanished** — "any function of ⟨blank⟩, such, for example, as ⟨blank⟩, or
⟨blank⟩". A calculus book with its calculus deleted.

**Root cause [D].** `FoliateReaderAdapter.ts:396` — `applyStyle` builds the
book stylesheet from `#shellPalette()` (`:659-666`), which reads the *live
computed* `--canvas`/`--ink` off the host. It is invoked synchronously from the
presentation store's `apply` callback (`useReader.ts:141`) before React commits
the new `data-reader-theme` attribute (`ReaderScreen.tsx:280`), so it captures
the outgoing theme. Meanwhile `makeReaderCss` gates
`img[data-tex] { filter: invert(1) }` (`:1533`) on `style.theme === 'dark'` —
the *incoming* theme. Two inputs, two clocks: the math images invert instantly
while the canvas lags, so black-on-transparent glyphs become white on a white
page. The comment at `:1526-1532` says the inversion exists to prevent "a book
about dy/dx whose dy/dx cannot be seen"; the stale palette makes it cause
precisely that.

**Impact.** Dark is the first customization a judge in an embedded agent browser
is most likely to try, and the calculus book is the demo. This silently breaks
the Whole-World Theme Rule that `DESIGN.md` names twice, and by the peak–end
rule it is the memory a judge leaves with.

**Fix.** Stop deriving the book palette from computed shell state. Resolve the
palette from the same token definition the shell uses, keyed by the theme being
applied, and pass it into `makeReaderCss` as data — so the background and the
`invert(1)` branch physically cannot disagree. Re-applying after commit is a
weaker belt-and-braces alternative. Add a regression asserting book background
and `img[data-tex]` filter agree for all four themes.
**Command:** `$impeccable harden`

### [P0] The tutor cue outlines the entire page instead of pointing at anything

**Observed [B].** `13-tutor-cue.png` and `v-cue-whole-visible.png`: roughly sixty
terracotta rectangles across both columns, boxing individual words ("or",
"and") and each `dy/dx` separately. The bar says "Showing where the ratio is
defined" while the page reads as a rendering fault.

**The mechanism is sound; the scope policy is missing.** `v-cue-narrow.png`
shows the same painter given a search-derived paragraph: it navigates to the
right page and outlines one passage legibly. The failure is that the *natural*
agent composition produces the bad result — `get_reading_context` hands back a
2,922-character visible range, and passing that straight to `focus_passage` is
the obvious next move. Nothing in the schema, the description, or the design
context steers toward a narrower range, and the tool accepts the wide one
without comment. Even in the good case, per-fragment rects box each math image
separately, which is visually noisy.

**Impact.** This is the North Star's decisive demonstration — the moment the
agent points at the exact source. Today it looks broken in the fifteen seconds
that claim has to land.

**Fix.** Give the cue a scope policy with two presentations: below a threshold,
one merged outline (union the rects into a single path rather than one box per
fragment); above it, a whole-block treatment — a single accent rule in the
margin plus a quiet tonal wash — and never dozens of boxes. Consider dimming
non-focus content instead of outlining focus content: a subtractive cue degrades
gracefully as the range widens, where the additive one degrades catastrophically.
Have `focus_passage` tell the agent in its result when it scoped too wide.
**Command:** `$impeccable shape`

### [P1] Remaster reads as developer tooling, and tells the agent it damaged the book

**Observed [B][D].** Two separate problems that land on the same trust question.

*Presentation.* `RemasterBar.tsx:69` renders
`{state.summary ?? 'An agent rewrote this chapter's markup.'}` — the attribution
is the **fallback**, so in the normal case where the agent supplies a summary the
words "an agent" never appear. What remains is one `var(--muted)` 0.85rem line
(`24-remaster-after-edit.png`), styled as a neutral toolbar, with the statement
of what happened at x≈14 and the `Undo`/`Reset` controls at x≈1340. `DESIGN.md`'s
Rounder Means Louder Rule reserves the 8px advisory-notice treatment for exactly
this case — "something happened that the person did not do" — and the
`advisory-notice` component token sits unused. `Undo` and `Reset` measure 53×15
and 55×15 at desktop **[B]**, the smallest controls in the product, on the most
consequential action in it. Toggling Original/Rewritten shows no change
indication at all, so the comparison is a memory test.

*Copy.* Every successful `edit_section` returns
`Applied 1 exact edit to section 18. Removed: 100 xmlns.` **[B]**. Those are
namespace declarations the XHTML round-trip adds and the sanitizer then strips —
benign normalization, counted and reported through `describeRefusals`
(`tools.ts:56-65`, `:994`) as though the agent's content had been refused. A
careful agent will report to the person that Bookhand removed 100 attributes
from their book.

**Impact.** This is the feature whose entire purpose is earning trust for an
agent editing someone's book, and both its human-facing and agent-facing copy
undercut that.

**Fix.** Restyle as the advisory notice it already has a token for:
`--accent-quiet` ground, 8px radius, attribution leading —
"An agent rewrote this chapter · Clarified the chapter heading" — with the
summary as detail rather than replacement. Group the controls with the statement
instead of pushing them to opposite edges. Give Undo and Reset the 44px minimum.
Mark changed regions when Rewritten is showing so the flip is a comparison.
Confirm Undo landed rather than silently removing the bar. Exclude `xmlns` and
`xmlns:*` from `describeRefusals`.
**Command:** `$impeccable polish`

### [P1] The agent surface returns shapes it will not accept back, and its errors are dead ends

**Observed [B].** Three failures hit in sequence while composing an ordinary
tutor call, each from following the product's own output:

1. `get_reading_context` returns `visible.range` with keys
   `startCfi, endCfi, cfi, sectionIndex, textFingerprint`. `focus_passage` is
   the one tool that **flattens** the range into top-level properties instead of
   nesting it under `range` as `RANGE_SCHEMA` does for `get_passage`,
   `save_annotation`, `upsert_study_item` and `create_study_lesson` — and it sets
   `additionalProperties: false` with no `cfi` property. Passing back the object
   Bookhand just produced fails: `Unknown input field: cfi`.
2. Omitting the flattening first yields `input.sectionIndex is required.` —
   which never says the range must be spread.
3. `save_annotation` over that same visible range fails with
   `That source passage has too many semantic segments (73; maximum 64).` The
   app's own grounding output exceeds its own annotation limit, and it does so
   **as a function of viewport width** — it succeeds at the e2e's desktop size
   and fails at 1440×900, the size a judge will use.

**Impact.** `PRODUCT.md` principle 4 is "composition beats chat", and the most
natural composition in the product is a three-error obstacle course. None of the
messages names the accepted shape or the recovery.

**Fix.** Make `focus_passage` take `range: RANGE_SCHEMA` like every sibling, or
accept and ignore `cfi`. Have rejection messages name the accepted fields, not
only the rejected one. Either raise the segment cap above what
`get_reading_context` can emit, or have the grounding tool return a range it
guarantees its own mutators will accept.
**Command:** `$impeccable clarify`

### [P2] The Search panel misses the accessibility standard the other three panels meet

**Observed [B][D], measured at 390px with `hasTouch`/`isMobile`:**

- `#book-search-limit` is **60×31**; the two index lifecycle text buttons
  (`Resume indexing`, `Pause indexing`) are **61×15 and 89×15**. Those two are
  the person's only control over background work they did not ask for, and
  `DESIGN.md` requires them visible the whole time it runs. At 15px they fail
  both the project's 44px commitment and WCAG 2.2 SC 2.5.8's 24px AA floor.
- Opening Search leaves focus on the chrome button
  (`focused after open: BUTTON "Search"`), while Contents correctly moves it to
  its heading (`H2 "Contents"`). `ContentsPanel.tsx:43-44,48`, `TextPanel.tsx:84`
  and `StudyBoardPanel.tsx:110` all implement the focus-on-open that
  `SearchPanel.tsx` omits. On mobile the panel *replaces* the reading surface,
  so a keyboard or screen-reader user is left with focus outside the only
  visible content.

This is one surface missing the project's standard rather than four defects: the
same file also holds **all 10** physical-property CSS declarations in a codebase
that is otherwise entirely logical-property (`reader.css:20-115`), all six
literal font sizes, and 200–500-character single-line JSX (`SearchPanel.tsx:35,43,51`).

**Fix.** Add the heading-ref focus effect; add `min-block-size: var(--tap)` to
the limit input and the lifecycle buttons; convert the block to logical
properties and design-system type steps.
**Command:** `$impeccable audit` then `$impeccable adapt`

---

## 5. Systemic patterns

1. **Runtime state is derived from the DOM at the moment it is least
   trustworthy.** The P0 theme bug is one instance of reading computed style
   during a React commit. It is worth checking whether any other
   `getComputedStyle` read sits on a state-change path.
2. **Reversal affordances are consistently the weakest controls in their
   surface.** Remaster `Undo`/`Reset` 53×15 and 55×15; tutor `Stop` 69×36 and
   styled as a text link beside a raised `Back`; index `Pause` 89×15. The pattern
   inverts the product's own stated priority on user control. **[B]**
2. **Reassurance is inversely proportional to stakes.** A throwaway note gets
   "✦ Added by an agent" plus Undo *and* Delete; a rewritten chapter of the
   person's book gets a muted sentence with no attribution. **[B]**
3. **Two surfaces were authored to a different standard.** The Search panel and
   the remaster bar diverge on CSS property style, type values, and JSX
   formatting simultaneously — and the one accessibility gap lands in the same
   file. Treat it as one surface to bring back in, not five defects. **[D]**
4. **Hard-coded colour escapes the token system only where a value must cross
   from CSS into JavaScript.** `FoliateReaderAdapter.ts:774` paints the tutor cue
   `#c76532` in all four themes, ignoring the sepia `#9b3b21` and night `#ff9a76`
   accents. Contrast is adequate (3.43–4.56:1), so this is drift, not a WCAG
   failure — and `:1509` already shows the mechanism to close it. **[D]**
5. **No global background token on the document.** `body` computes to
   `rgba(0,0,0,0)` in every theme and `html` to the light canvas **[B]**, so
   touch overscroll will show light canvas behind a dark book — the same seam the
   comment at `FoliateReaderAdapter.ts:654` describes having already fixed once.
6. **Container query and media query duplicate the same rule at two
   thresholds.** `study.css:353-363` (`@container (max-width: 420px)`) and
   `study.css:450-463` (`@media (max-width: 520px)`) both set
   `.study-lesson-head { flex-direction: column }` and
   `.study-lesson-tools { inline-size: 100% }`. The container query is why the
   lesson's controls get their own full-width row even on a 1440px desktop, since
   the docked panel is ~320px wide. **[D][B]**

### Detector results and false positives

`node .agents/skills/impeccable/scripts/detect.mjs --json src` → exit 2, **3
findings**, each verified in context:

| Finding | Verdict |
|---|---|
| `design-system-color` — `FoliateReaderAdapter.ts:774` (`#c76532`) | **Confirmed** — pattern 5 above |
| `design-system-font-size` — `reader.css:727` (`0.85rem`) | **Confirmed** — off-ramp, between the `label` and `body` steps |
| `design-system-font-size` — `library.css:168` (`0.5rem`) | **False positive** — decorative 40×58px spine plate inside `aria-hidden="true"` (`BookCover.tsx:44-46`), whose title is duplicated accessibly in the adjacent row; no ramp step fits |

Other candidates checked and rejected rather than reported:

- **`pdf-*.js` / `sqlite3-worker1-*.js` as shipped weight** — network capture
  shows neither is ever fetched; code splitting works. Build-output duplication
  only.
- **`.reader-identity` / `.reader-footer-chapter` "overflow"** in
  `measurements.json` — intentional single-line ellipsis truncation
  (`reader.css:214-216`, `:512-517`); page overflow is `false` at every width.
- **`FALLBACK_THEMES` hex values** (`FoliateReaderAdapter.ts:1503-1508`) — not
  drift; documented and used only when the shell's tokens cannot be read.
- **The 1×1 `visually-hidden` file input** flagged as a sub-44px target — correct
  practice; proxied by a real 44px button.
- **Mobile Study "header bleed"** — investigated and dismissed. `.panel-head` is
  not sticky (`reader.css:266-273`); the clipped line in `19-study-390.png` is
  ordinary scroll position, not a paint bug.
- **Missing text `Reset`** — present at `TextPanel.tsx:245`, below the fold in the
  capture.
- **Search excerpts set in the product font** — they are serif
  (`reader.css:118`); the Borrowed Voice Rule holds.

### One correction to the code audit

Assessment B reported that agent tool history "lives in a separate
`src/webmcp/AgentActivity.tsx` surface". **It does not.** That component is
rendered nowhere — `grep` for `AgentActivity` outside its own file returns no
matches **[D]**. The invariant is currently satisfied by *deletion*, not by
separation, and `DESIGN.md`'s "Observability must remain a separate diagnostics
surface" implies a surface that does not exist. Study is genuinely clean; there
is simply nowhere for an owner to see what the agent did.

---

## 6. Secondary observations

- **Study lessons open with their own title scrolled off** on mobile and in
  expanded view (`19-study-390.png`, `17-study-lesson-expanded.png`). The title
  and "Created with an agent" are the two elements that make it a lesson rather
  than a feed, and they are the first things lost.
- **Expanded Study gives the book a 196px column** (`measurements.expandedStage`:
  `stageCols: "1100px 340px"`, `bookW: 196`) in which justified serif produces
  rivers wide enough to read as broken.
- **Question blocks bleed 6px past their container below 520px** —
  `.study-lesson-block[data-kind='question'] { margin-inline: -6px }`
  (`study.css:465-468`) produces `scrollWidth 359` vs `clientWidth 353` at 390px
  and `289` vs `283` at 320px **[B]**. The one block with a visible border is the
  one clipped asymmetrically. Page overflow stays `false`.
- **Lesson DOM ids are addressable but undiscoverable.**
  `lessonBlockDomId` (`StudyBoardPanel.tsx:80-85`) length-frames both segments —
  `study-experience-21-lesson-audit-lesson-1-block-4-idea` — while
  `list_study_lessons` returns only the raw ids. An agent cannot derive the
  addressable id from any documented output. Latent today (nothing consumes them
  yet), live the moment W9's reveal lands. Caller ids are also still unsanitized,
  so a block id containing a space yields an id no `#` selector can reach.
- **The cold library shows one row in 600px of white with no primary action**
  (`01-library-1440.png`). The Continue state is much stronger — cover, progress,
  "Last read … just now", primary Continue (`30-library-continue.png`) — but with
  one book the same title then appears twice, in "Continue reading" and again in
  "All books".
- **Study's empty state never mentions the agent.** "Select a passage in the book
  and keep it here, or begin with a note below" is the one screen where the
  product could state its thesis, and it does not.
- **Search's first screen for "derivative" returns mostly figure alt-text with
  raw LaTeX in it** — `\(\dfrac{d y}{d x}\)` appears in an excerpt **[B]**, and
  four consecutive hits repeat the same wrapping uppercase section label.
- **`Stop` renders with a hollow-square glyph** that reads as an unchecked
  checkbox rather than an action.
- **Blanket `0.01ms !important` reduced-motion override** (`index.css:63-70`)
  overrides duration but not delay — which the team already had to patch
  specifically at `reader.css:540-546`. With zero `@keyframes` and four
  transitions in the project, the per-component rules do the work.
- **Library rows expose a ~40-word accessible name**, including both "Not
  started" and "Not opened yet" for the same fact.
- **Disabled controls drop to 0.5 opacity** (`library.css:334-337`) — permitted
  by WCAG, but an opacity multiplier is the one treatment a token system cannot
  theme.

---

## 7. Deadline-aware sequence

At the time of writing, **13.5 hours remain** before submissions close
(2026-09-03T20:00:00Z).

### Must fix before submitting — roughly 3–4 hours

1. **P0 theme propagation** (~60–90 min). Highest value in the audit. Resolve the
   palette by theme rather than by computed DOM read, verify all four worlds and
   both switch directions, and confirm `img[data-tex]` inversion agrees with the
   canvas. Without this, one click ruins the demo.
2. **P0 tutor cue scope** (~60–90 min). A merged outline plus a size threshold is
   enough; the subtractive redesign is post-hackathon. This is the shot the whole
   WebMCP claim rests on.
3. **P1 remaster copy, two small edits** (~20 min). Lead with attribution rather
   than falling back to it, and drop `xmlns` from `describeRefusals`. Both are
   one-line changes to the surface most likely to be read as untrustworthy.
4. **Re-run the demo runbook end to end after each fix.** The theme change
   touches the same file as the tutor cue.

### Fix if time remains — roughly 2 hours

5. Remaster `Undo`/`Reset` to 44px, and the Search panel's three sub-44px targets.
6. Search panel focus-on-open — four lines, mirroring `ContentsPanel.tsx:43-48`.
7. Anchor Study to the top of the lesson when the panel opens or changes layout.
8. The 6px question-block bleed — delete the negative margin at that width.

### Explicitly post-hackathon

- `focus_passage` schema alignment with `RANGE_SCHEMA` (a breaking change to a
  shipped tool; not on deadline day).
- The segment-cap/grounding mismatch, which needs a real decision about what
  `get_reading_context` should return.
- Reuniting the Search panel with the project's CSS and formatting standard.
- Expanded-Study proportions, the cold-library first impression, onboarding, and
  search ranking of figure descriptions.
- A real diagnostics surface, or the removal of `AgentActivity.tsx` and the
  `DESIGN.md` sentence that implies one.
- Lesson undo, lesson delete confirmation, and per-block source affordances.

---

## 8. Explicit verdicts

**Study lesson — succeeds.** It reads as a lesson, not records. The title
carries the hierarchy, the blocks carry a genuine progression, provenance
appears once at lesson level, and a source-linked lesson gets a working
"Chapter X" return button and a Remove button, both at 44px
(`32-study-sourced-lesson.png`). The remaining gaps are behavioural, not
compositional: it opens scrolled past its own title, and blocks have no
individual route back to the book. This is the strongest new work in the build.

**Tutor layer — fails as shipped, and is one fix away from succeeding.** The
indicator is excellent: "Tutor · Showing where the ratio is defined" with Back
and Stop, calm and unambiguous. The cue negates it by boxing the whole page at
the scope an agent will naturally use. The narrow-range capture proves the
machinery is right, so this is a scope-and-presentation problem, not an
architectural one.

**Remaster — trustworthy underneath, untrustworthy on the surface.** The
guarantees are real and verified: publisher bytes preserved, one exact edit
applied, Undo restored the chapter. But it presents as a neutral diff toolbar,
hides its own attribution behind the summary, puts its recovery controls 1300px
from its statement at 15px tall, and tells the agent it removed 100 attributes.
The engineering has earned trust the interface does not claim.

**Theme worlds — fail.** Four complete, well-designed semantic token sets that do
not survive their own switch. Dark, on a mathematics book, deletes the
mathematics. This is the single most damaging defect in the product.

**Mobile reading — succeeds.** Zero page-level horizontal overflow at 390 and
320; the reader collapses to icon-only chrome with a truncated title; Study and
the panels become full surfaces rather than compressed columns; the close control
adapts to "← Book". The blemishes are a 6px bleed and Search-panel target sizes.

**Overall prize-demo wow — conditional, and the condition is the two P0s.** The
reader is genuinely beautiful, search readiness is a small masterpiece, and the
composed lesson is a real artifact rather than a chat transcript. But the two
moments a judge is most likely to reach unprompted — clicking Dark, and watching
the tutor point — are the two that look broken. Both are fixable today. With
them fixed this demos strongly; without them a judge's lasting impression is a
white page missing its equations.

---

## 9. Open questions — only where a real fork remains

Everything else in this document has a clear direction. These do not:

1. **Should the tutor cue be additive or subtractive?** Outlining focus content
   fails worse as the agent's range widens; dimming everything else fails toward
   "nothing happens". The second is the safer failure mode and a different visual
   language. Worth deciding deliberately rather than by patch.
2. **Should `focus_passage` refuse a range that is too broad to point at?** A tool
   that says "narrow this or use `navigate_book`" teaches the model to teach
   better, which is the actual product claim — but it makes the demo path
   fail-able in front of a judge. Product call, not an engineering one.
3. **Is the remaster comparison a toggle or a diff?** The North Star says
   "exposes comparison"; a flip is the weakest reading of that word. A
   change-marked view is materially more work and materially more convincing.
4. **Should a lesson be undoable, or only deletable?** A two-word note can be
   undone; a five-block lesson cannot. `VAL-STUDY-LESSON-CORE` scopes persisted
   undo out deliberately, so this is a scope question, not a bug — but the
   asymmetry is visible to a user.
5. **Does an owner-facing diagnostics surface belong in the product at all?**
   `AgentActivity.tsx` is written and unrendered. Either it returns somewhere
   outside Study, or it and the `DESIGN.md` sentence promising it should go.
