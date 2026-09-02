# Judge-demo readiness audit

Date: 2026-09-02

Reviewer: Claude (parallel session). Read-only audit. Nothing in code,
contracts, plans, or submission materials was changed.

Sources: `AGENTS.md`, `docs/product-north-star.md`, `docs/plan/current-work.md`,
`docs/plan/polish-and-showcase-mission.md`, `docs/scope-inventory.md`,
`docs/deployment.md`, `docs/agent-setup.md`, ADR 0003, and the W4–W11 contracts
under `docs/contracts/polish/`. Grounded against the tree at `16233d0`.

There is no submission or demo document in the repository. The submission facts
live in the "Submission state" section of `docs/plan/current-work.md`, and the
demo has no script anywhere. That absence is itself the first finding.

## 0. State of the build, stated exactly

- `main`, `origin/main`, and `HEAD` are all `16233d0` ("Complete W4 runtime
  truth and source lifecycle"). Cloudflare Workers Builds deploys pushes to
  `main`, so `16233d0` is the deployed commit unless its build failed.
- The deployed runtime registers **twelve** tools: `get_design_context`,
  `list_books`, `open_book` before a book is open, plus `get_reading_context`,
  `get_table_of_contents`, `get_passage`, `navigate_book`, `save_annotation`,
  `set_reading_style`, `upsert_study_item`, `list_study_items`, and
  `set_study_board_view` once one is.
- **`search_book` is not deployed.** It exists only in the uncommitted W5
  working tree, together with `SearchPanel`, `useBookIndex`, the chunker, and
  schema v4. Nothing in this audit's primary plan may depend on it.
- `VAL-DEPLOYED-RUNTIME-TRUTH` asserts an eighteen-tool set. Six of those
  (`search_book`, `upsert_study_experience`, `focus_passage`,
  `reveal_study_item`, `present_explanation`, `control_guidance`) do not exist.
  That contract describes W10's finish line, not today.

### Implemented and demonstrable today

Reading: local library with bundled-book bootstrap and import; Foliate EPUB
rendering; TOC, relative, and CFI navigation; selection with exact quote, CFI
range, and fingerprint; themes, typography, measure, spacing, and bounded custom
book CSS with Preview/Apply/Cancel/Reset; receding mobile chrome, thresholded
pagination gestures, and full-surface Contents/Text/Study panels; SQLite WASM
over OPFS with a truthful storage mode and restore after reload.

Agent surface: genuine `document.modelContext` registration; versioned
page-owned `get_design_context` whose version is a SHA-256 of the canonical
`DESIGN.md` block; custom-CSS style changes gated on that version; source-linked
mutations verified against the open book by bookId, CFI range, fingerprint, and
normalized quote, with rejections that change nothing; per-item Undo with
visible provenance attribution; board-view Undo; return-to-source navigation;
structured success and failure results on every tool.

### Not implemented — must not appear or be implied in the video

Local search and `search_book` (uncommitted). The entire tutor layer: no tutor
session, no transient passage cue, no Back, no Stop, no temporary explanation,
no `reveal_study_item`. Cohesive lesson experiences (`upsert_study_experience`)
— Study is still a flat record feed. Trusted math rendering — equations render
as raw-looking `<pre>`. Interactive plots. Diagnostics separation — raw Agent
Activity still occupies the Study viewport. Study initial-load failure
rendering. Safe (recoverable) removal — delete is permanent and one click.

## 1. The strongest story Bookhand can truthfully tell

**"The page gives the agent real capabilities, and checks its work."**

Every judge has seen an AI that talks beside a document. Two things here are
unusual and both are *shipped*: the page hands the agent a versioned design
contract it could not otherwise know, and the page **refuses** a source claim
the book cannot verify. The second is the strongest thirty seconds available,
because a refusal cannot be faked by a chatbot and needs no narration to land.

Three acts, in this order:

1. **Semantics, not clicks.** The agent reads reading context and the table of
   contents and moves the reader to an exact location. Nothing is scripted at
   the DOM.
2. **Page-owned design guidance.** The agent reads `get_design_context`,
   discovers the semantic roles and the containment boundary, and restyles the
   book for a stated reading need — including custom CSS, which the page accepts
   only with the guidance version. The learner presses Reset and the book comes
   straight back.
3. **Grounding, proved by rejection.** The agent saves a highlight and a study
   block anchored to the exact passage; the learner clicks the citation and
   lands back on the source. Then a claim about a quote the book does not
   contain is rejected, visibly, with nothing written.

Then reload, and the durable work is still there.

Deliberately excluded: any mention of tutoring, pointing, Back, Stop, or
lessons-as-units. Those are W6–W9. The North Star's hero scenario cannot be
filmed on 2026-09-02.

**Conditional upgrade.** If W5 is finished, committed, pushed, and confirmed
deployed *before* recording, replace act 1's TOC beat with search: the agent
searches the whole book, cites a hit, and the learner activates the citation to
navigate. That is a materially stronger opening because it shows whole-book
retrieval no chat-with-PDF flow can ground the same way. Do not hold the
recording for it; treat it as an optional swap with its own take.

## 2. Shot and voiceover sequence (target 2:40)

Timestamps are cumulative. Screen is the ChatGPT desktop in-app browser
throughout; no slides, no title card longer than three seconds.

| Time | Shot | Voiceover |
| --- | --- | --- |
| 0:00–0:08 | Bookhand library, one book, then the reader opens at Chapter X | "Bookhand is a local-first ebook reader. No account, no server — the book and everything you make with it stay in the browser." |
| 0:08–0:18 | Cursor selects a dense passage. Nothing else happens. | "It's also a WebMCP host, so the agent I'm already using can work *inside* the page instead of beside it." |
| 0:18–0:40 | Type an intent-only prompt: "I'm stuck on this passage — get your bearings and take me to where this idea is first introduced." Tool calls appear; the reader moves. | "It's not driving my mouse. The page publishes real operations — reading context, table of contents, exact navigation — and the model chooses among them." |
| 0:40–1:05 | Prompt: "Make this easier for me to read; I have low vision." Agent calls `get_design_context`, then `set_reading_style` with custom CSS. Book visibly changes. | "It doesn't guess at my design system. The page hands it a versioned design context — semantic roles, accessibility floors, what CSS is allowed to reach — and custom CSS is refused unless the agent quotes the version it read." |
| 1:05–1:15 | Learner clicks Reset. Book snaps back. | "And everything it changed is mine to take back." |
| 1:15–1:45 | Prompt: "Save what matters here so I can come back to it." Highlight appears in the book; a study block appears in the board, attributed to the agent. | "Now it writes into my knowledge, not into a chat log — anchored to an exact range in this book, with who made it visible." |
| 1:45–1:55 | Click the citation in the study block. Reader jumps to the exact source. | "The link back to the source is exact." |
| 1:55–2:22 | Prompt asking it to save a quotation that isn't in the book. Rejection is visible; storage and board unchanged. | "Here's the part I care about most. The page verifies every source claim against the open book — the range, the fingerprint, the exact text. When the claim doesn't hold, nothing is written. The book checks the model's work." |
| 2:22–2:35 | Reload the page. Highlight and study block are still there. | "It's all still here after a reload, on my device." |
| 2:35–2:40 | Repo URL and live URL on screen | "Open source, client-side, and running now." |

Under 2:45 with room; the hackathon cap is three minutes. Speak over live
capture rather than cutting to a talking head — the surface *is* the argument.

## 3. Required pre-seeded state

Before the first take:

1. A fresh browser profile on the deployed HTTPS origin. Do not reuse a profile
   that has stale OPFS state from an older schema.
2. The bundled book bootstrapped and **opened once**, then the durable-storage
   request granted, so the recording does not spend eight seconds on a
   permission prompt and the reported storage mode is `persistent`.
3. Reading position set to the Chapter X passage, and the target selection
   rehearsed so the drag lands the same way each take.
4. Study board **empty**, and expanded-vs-docked preference set to whichever
   composition films better at the recording window size (docked reads better,
   because the book stays visible and that is the point of the product).
5. Reading style at defaults, so Reset is visibly a return rather than a
   sideways move.
6. ChatGPT desktop signed in, the Bookhand tab already open and its tools
   registered, and a scratch file with the exact prompts to paste — typing on
   camera wastes eight to ten seconds per beat.
7. Notifications silenced, window size fixed for the whole recording, and the
   OS zoom left alone so nothing reflows between takes.
8. The rejection prompt written in advance with a quotation that is definitely
   absent from the book — verified before recording, not improvised.

## 4. Agent versus person

**Must go through ChatGPT Desktop** (these are the claim): reading context and
TOC discovery; the navigation to the earlier passage; `get_design_context`; the
style change including custom CSS; the annotation and study-item creation; the
rejected source claim. If any of these is performed by a person or by a script,
the video is no longer evidence of the thesis and `VAL-HERO-MODEL-RUN`'s
prohibition on relay and orchestration is the right instinct to honor even
though that contract is not satisfiable yet.

**Must be done by the person** (these prove control, and doing them by agent
would weaken the point): opening the app and the book; making the text
selection; pressing Reset; clicking the citation to return to source; pressing
reload. Undo, if shown, is also a person's click.

**Prompts must be intent-only.** No tool names, no schemas, no CSS, no
citations, no coordinates. The moment the prompt contains a tool name, the video
demonstrates a person who read the source code rather than an agent that
discovered the page.

## 5. Recovery and backup takes

- **Record each act as a separate take.** Three short takes cut together survive
  one bad model turn; a single continuous run means one stall costs everything.
- **The model doesn't call anything.** Reprompt naming the *capability*, never
  the tool: "you can read where I am in this book" rather than
  "`get_reading_context`". Keep one such reprompt on hand per act.
- **The model calls the wrong thing or loops.** Let it. A short recovery is more
  convincing than a suspiciously clean run — but keep it under six seconds in
  the cut.
- **Latency.** Cut on the visible result, not the spinner. Never speed-ramp the
  page itself; a sped-up reader looks fabricated.
- **Custom CSS is refused for a bad version.** This is correct behavior and a
  usable beat, but only if the voiceover is ready for it. Have that sentence
  written.
- **The rejection beat doesn't reject** (the model quietly declines to try). Ask
  it directly to save a quotation you supply verbatim that is not in the book.
  The refusal comes from the page either way.
- **Total agent failure in the in-app browser.** Fall back to deployed Chromium
  with `--enable-features=WebMCPTesting` and a real model, and say on screen
  which browser it is. Do **not** fall back to the deterministic Playwright
  WebMCP spec: it proves plumbing, not model behavior, and presenting it as the
  latter would be the one dishonest thing available here.
- **Record a clean silent screen capture of all three acts first.** Voiceover
  over a known-good capture is far easier than getting narration and model
  timing right simultaneously.

## 6. Blockers, ordered by judging impact

1. **No public repository.** Submission requires it; the audience cannot verify
   any claim without it. Owner action, minutes. `LICENSE` is already committed.
2. **No demo video exists.** Hard submission requirement. Everything else in
   this document is subordinate to getting a truthful one recorded.
3. **The ChatGPT Desktop path is unproven end to end.** No recorded evidence
   exists that tools register and storage initializes in that browser on the
   deployed origin — `VAL-DEPLOYMENT-HEADERS` names this as an owner-only
   prerequisite. If it fails, the entire story changes shape. **Verify this
   before writing another line of code**; it is the single highest-variance
   unknown in the submission.
4. **Raw Agent Activity occupies the Study viewport.** Judges will read the
   product's most-scrutinized surface as a debug console. W8 removes it; before
   then, prefer camera framing that keeps the book prominent, or accept it and
   let the voiceover call it a call log rather than study content.
5. **Equations render as raw-looking `<pre>`.** In a calculus book, in the one
   place the agent's work is displayed. Avoid prompts that produce equation
   blocks in the recorded take; prose and quotation blocks film well.
6. **Delete is permanent and one click.** Do not demonstrate removal, and be
   careful not to click it on camera.
7. **W5 is uncommitted and unpushed.** Whole-book search is the most persuasive
   available upgrade to act 1 and it is finished enough to be close. It is a
   blocker only for the stronger cut, not for a truthful one.
8. **`bookhand.dev` is not attached.** The Workers URL is fine for judging;
   attaching the domain is polish. Owner action.
9. **No submission document exists.** The Devpost narrative, the "what it does /
   how we built it" text, and the tool inventory have to be written from
   scratch, and every claim in them should be checked against section 0 of this
   audit rather than against the North Star, which describes the destination.

## 7. One recommendation

The temptation, with a day left, is to push W5 and W6 into the recording. The
demo does not need them. What it needs is proof that the deployed page and a
real model connect at all in the judged browser, and one narrative that is true.
Do item 3 first, today, with the build that is already live. If it works, record
the three acts above tonight; anything W5 adds afterwards is an upgrade to a
video that already exists rather than a dependency of one that does not.
