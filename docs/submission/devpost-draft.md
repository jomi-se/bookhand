# Devpost submission draft

Date: 2026-09-02

**Status: draft for José to rewrite.** This is scaffolding with the facts
checked, not authored prose. Deployed claims below refer to commit `74b880b`;
local claims refer to the combined main branch after the tutor, Study, and
document-remaster work. Promote `[LOCAL]` to `[DEPLOYED]` only after pushing and
verifying the live origin through ChatGPT Desktop.

Three tiers are marked throughout and must stay separated when this is edited:

- **[DEPLOYED]** — live at the submission URL right now (W0–W5).
- **[LOCAL]** — implemented and production-browser tested, but not yet verified
  on the deployed origin.
- **[FUTURE]** — not built. Appears only under "What's next," never as a claim.

---

## Tagline

*Pick one after promoting the corresponding local capability to deployed.*

1. An ebook reader that gives your agent real capabilities — and checks its
   work against the book.
2. A local-first EPUB reader that publishes itself to agents through WebMCP.
3. Your agent can read, navigate, restyle, and annotate this book. It cannot
   make up a quotation.
4. An ebook reader where your agent can repair the book itself — not merely
   restyle it.

## Short summary (Devpost "elevator pitch", ~180 characters)

Bookhand is a local-first EPUB reader whose WebMCP tools let an agent teach from
the book—and repair the book itself. Claims are source-verified; rewrites are
semantic, local, and reversible.

---

## Inspiration

An ebook reader with a chat box bolted on is ordinary. The interesting question
is what happens when the reader itself describes what it can do — semantically,
in the page — so an agent can compose with those capabilities instead of
guessing at the DOM.

An agent driving a page with Playwright can already click things. What it cannot
do is know that this application has an exact CFI range, a fingerprint for the
text at that range, a versioned design contract, and a rule about what a
highlight is allowed to be. WebMCP turns that from visual inference into an
application contract. The agent spends its intelligence on teaching instead of
on reverse-engineering a viewer.

The other half of the inspiration is less fun and more important. If I am going
to let a model write into my book, I want the book to be the authority on what
it says. That turned out to be the most interesting thing I built.

## What it does

**A real reader first. [DEPLOYED]**

- Opens EPUBs locally. No account, no server, no upload. The book, your
  highlights, your notes, and your study board live in SQLite compiled to WASM,
  persisted to OPFS in your browser.
- Table-of-contents and exact-location navigation, selection with precise CFI
  ranges, themes, typography, measure, spacing, and bounded custom book CSS.
- Works completely without an agent. WebMCP is what makes the tutor behavior
  possible; it is not what makes the reader work.

**Thirteen capabilities published to the page's agent. [DEPLOYED]**

Registered through genuine `document.modelContext`:
`get_design_context`, `list_books`, `open_book`, `get_reading_context`,
`get_table_of_contents`, `get_passage`, `navigate_book`, `save_annotation`,
`search_book`, `set_reading_style`, `upsert_study_item`, `list_study_items`,
`set_study_board_view`.

**Twenty capabilities on current main. [LOCAL]**

The shipped set above plus `focus_passage`, `control_guidance`,
`get_section_source`, `diagnose_section`, `rewrite_section`,
`compile_section_math`, and `set_section_view`.

**The page tells the agent how to compose. [DEPLOYED]**

`get_design_context` hands the agent a compact, versioned design contract:
semantic roles, accessibility floors, what CSS is allowed to reach, and how the
person reverses anything it does. The version is a SHA-256 of the canonical
block in the design document, computed at build time — and a custom-CSS change
is refused unless the agent quotes the version it actually read. A repository
agent could read a `DESIGN.md`. The agents this is for cannot; they see a page.

**The book checks the model's work. [DEPLOYED]**

Every source-linked change — a highlight, a quotation, a study block — must
carry the open book's ID, the exact CFI range, a fingerprint, and the quote. The
application resolves that range against the book it currently has open and
compares the text under one exact normalization. A wrong book, a stale range, a
partial quote, or an invented one is rejected, and nothing is written. This is
the part I would most like a judge to try to break.

**Your changes stay yours. [DEPLOYED]**

Agent work is visibly attributed. Every study block offers per-item Undo. Style
changes offer Reset. A board layout an agent changed offers Undo. An agent may
revise the blocks it created, using an unguessable token it was handed at
creation; it cannot edit what you wrote, and it has no delete.

**Whole-book search, grounded. [DEPLOYED]**

`search_book` searches a local FTS5 index built from CFI-anchored chunks of the
book, so a result carries a citation that resolves back to exact text. Indexing
is transactional and resumable, and search reports honestly whether the index is
unavailable, partial, or ready rather than pretending an empty result means the
words are not in the book. It never scans live EPUB content, moves the reader,
or changes the selection.

**The agent can point, then give control back. [LOCAL]**

`focus_passage` verifies an exact source range, moves the visible reader, and
points at the exact words with a transient highlight, underline, or outline.
It also shows an attributed guidance state with Back and Stop. The learner's
original position stays anchored rather than being silently replaced by agent
movement; manual navigation yields guidance; reload returns to the learner's
place. The cue is transient and never becomes an annotation or Study record.

**The agent can repair the document itself. [LOCAL]**

Many public-domain technical EPUBs encode every variable and equation as an
image. That is not a theme problem: it breaks selection, reflow, accessibility,
and semantic text. Bookhand gives the agent the current section's real,
package-relative XHTML and stylesheets, then accepts a complete semantic HTML5,
MathML, figure, caption, accessibility, and CSS rewrite. Foliate renders that
rewrite through its ordinary loader; Bookhand's extraction path reads the same
accepted document.

This is deliberately a coding harness, not a menu of repair operations. The
model decides what the document should become. Bookhand keeps the non-negotiable
parts: scripts and exfiltrating resources are removed and reported, publisher
bytes stay immutable, every accepted version is local, and the person has
Original/Rewritten, Undo, and Reset. Schema v5 saves the sanitized,
package-relative history before showing it and hydrates it before Foliate's
first render, so the repaired chapter and its CSS survive reload without a
flash of the broken version.

`compile_section_math` is an optional accelerator when a publisher already
left trustworthy LaTeX in `data-tex`; it converts the bundled calculus book's
equation images to native MathML locally. It is not the architecture and does
not limit the agent's free-form rewrite.

**Study now reads like material, not telemetry. [LOCAL]**

Blocks created together compose into one restrained lesson group, shared source
context is not repeated, and equations render as bounded native MathML with a
visible fallback. Existing learning content precedes a single progressively
disclosed manual authoring path. Raw tool calls and agent logs do not appear in
Study; storage failure stays visible and does not unregister unrelated reader
tools.

## How I built it

React 19 and Vite, TypeScript, no backend of any kind.

- **Reading** is upstream Foliate.js pinned to a commit, behind a narrow
  `ReaderAdapter` so the viewer's DOM never leaks into the domain.
- **Storage** is the official SQLite WASM build, owned by one dedicated worker
  and persisted with `opfs-sahpool`. One worker owns the database; everything
  else talks to it through a typed protocol with validation at the boundary.
  FTS5 provides lexical retrieval; schema v5 also stores bounded section
  rewrite history. There is no vector store.
- **The agent surface** is genuine `document.modelContext`. Because the current
  Chromium runtime treats input schemas as hints rather than enforcing them,
  every handler independently validates its input and returns structured
  success and failure content, not just prose.
- **Book content is untrusted input.** Anything derived from an EPUB that goes
  back to an agent is wrapped in an explicit data boundary, because a book can
  contain instructions aimed at whoever is reading it.
- **Deployment** is Cloudflare Workers Builds pulling from GitHub, so no
  deployment credential exists anywhere in the repository.

## Challenges I ran into

- **WebMCP in a test browser.** Getting a real `document.modelContext` under
  Playwright needed the right feature flag on a secure origin; several plausible
  switches do nothing, and a stub gets the API shape wrong in two ways that
  matter. The recipe is written down in the repo so the next person loses an
  afternoon instead of a day.
- **Verification is the whole product, and it is fiddly.** Deciding exactly
  which normalization to apply to a quote — NFC, line endings, whitespace runs,
  trim, and nothing else — is the difference between rejecting real quotations
  and accepting invented ones. Case, punctuation, zero-width characters, and
  math symbols all stay significant.
- **Mathematics survives or the demo is a lie.** A calculus book indexed or
  quoted through `textContent` is a book in which `dy/dx` does not appear.
  Passage extraction is typed — text, math, figure — and there is a real
  regression against a figure in Chapter XIX that asserts the exact symbols
  survive.
- **A phone found a bug no emulator could.** Chrome on Android autosizes text
  inside a blob iframe that has no viewport of its own, by a factor derived from
  frame width, while the paginator computes columns from the container. It is
  invisible in devtools emulation and in Playwright, because desktop Chrome does
  not autosize at all.
## Accomplishments I'm proud of

- The refusal. A model can be confidently wrong about what a book says; this
  page settles it against the book, visibly, and writes nothing when the claim
  does not hold.
- A versioned design contract the page owns, so an agent can compose coherently
  without repository access and without a harness-specific skill.
- Genuinely local-first: SQLite WASM over OPFS, no account, no upload, and the
  reader stays complete when no agent is present.
- Agent authority that is narrow by construction — create with a token, revise
  only your own, no delete — rather than by good behavior.
- A broken EPUB chapter can become semantic HTML and MathML through the model's
  judgement, then survive reload while the untouched publisher version remains
  one click away.

## What I learned

- Publishing *capabilities* is a different design problem from publishing an
  API. The schema is the easy half; the hard half is describing effects,
  reversibility, and boundaries well enough that a model composes something
  coherent on the first try.
- Input schemas are currently hints. Anything that matters has to be enforced by
  the handler, and the schema the model sees and the rules the handler applies
  must come from one place or they drift.
- "Undo" and "delete" are different promises, and a UI that blurs them will
  eventually lose someone's work.
- Contracts written before implementation caught more real defects than the
  implementation review did. Two independent review passes over the contracts
  found a canonical contradiction that no amount of code reading would have
  surfaced.

## What's next

Each item below names the remaining [FUTURE] layer without erasing the local
foundation already built beneath it.

- **Embodied tutor presentation.** Exact transient source cues exist; the next
  layer is a small anchored plain-text explanation plus direct reveal of a
  Study item.
- **First-class lessons.** One titled, ordered, atomic study experience with a
  declarative interactive plot and recoverable removal. Grouped native blocks
  and typeset math exist today, but `actionGroupId` is not yet a durable lesson
  entity.
- **A lesson-first workspace** with different compositions docked, expanded, and
  on mobile — and agent call logs moved out of the study surface entirely, where
  they belong.
- **Local embeddings**, after lexical retrieval earns them. Vectors as ordinary
  packed BLOBs with an exact scan; no ANN infrastructure for a book.
- **Agent Connect** as an optional transport, never a dependency.

## Built with

`react` · `typescript` · `vite` · `webmcp` · `document.modelContext` ·
`foliate-js` · `epub` · `sqlite-wasm` · `opfs` · `fts5` · `web-workers` ·
`cloudflare-workers` · `playwright` · `vitest` · `local-first`

## Testing notes

*Not a Devpost field. Keep for the README or the judge's notes.*

- Unit and component tests in Vitest; browser tests in Playwright against the
  **production build**, because the development CSP intentionally makes
  `npm run dev` unrepresentative of what ships.
- WebMCP tests use Playwright's bundled Chromium launched with
  `--enable-features=WebMCPTesting`, driving genuine `document.modelContext`
  rather than a stub.
- Test-only fault seams (index pause, index failure) are excluded from
  production builds and that exclusion is asserted by its own test.
- The deterministic WebMCP specs prove plumbing, not model behavior. They are
  never presented as evidence that a model composed anything.
- Search is validated against a manually frozen two-book oracle bound
  to the SHA-256s of both EPUBs, including a check that the expected results are
  not embedded anywhere in the shipped bundle.

## Links

- **Live demo:** <https://bookhand.jomi-se.workers.dev/> — deployed commit
  `74b880b` was verified through genuine WebMCP and ordinary Search before
  recording.
- **Repository:** `<GITHUB URL — repository must be made public before
  submitting>`
- **Demo video:** `<YOUTUBE URL — public, under three minutes, with audio>`
- **Custom domain:** `<bookhand.dev — optional; attach in the Cloudflare
  dashboard or omit>`

## Screenshot checklist

Six images, in this order. Capture at a consistent window size in the ChatGPT
desktop in-app browser where the caption says "agent"; a clean desktop Chromium
window is fine for the rest.

1. **The library.** *Caption:* "Local-first. Your books live in your browser —
   no account, no server, nothing uploaded."
2. **The reader, mid-chapter, chrome visible.** *Caption:* "A real reader
   first: exact locations, themes, typography, and custom book CSS. It works
   with no agent present."
3. **The reader moved by verified tutor guidance, Back and Stop visible.**
   *Caption:* "The agent points through exact book semantics; the reader always
   shows who moved it and how to take control back."
4. **Before/after of an agent style change, with Reset visible.** *Caption:*
   "The page hands the agent a versioned design contract — and refuses custom
   CSS unless the agent quotes the version it read. Reset is always yours."
5. **A rejected invented quotation, storage unchanged.** *Caption:* "Every
   source claim is verified against the open book. When the quote doesn't hold,
   nothing is written." — *This is the strongest image in the set. Make it the
   Devpost thumbnail.*
6. **A before/after remaster split: equation images versus native MathML, with
   Original, Rewritten, Undo, and Reset visible.** *Caption:* "The agent did not
   repaint the EPUB. It rewrote the chapter into semantic document markup, and
   the repaired version survives reload."
7. **A saved highlight and grouped Study lesson with native math, after a
   reload.** *Caption:* "Agent work is labeled, reversible, and still here after
   a reload — on your device."

Insert a search screenshot between 3 and 4: *"Whole-book search over a local
FTS5 index. Every result carries a citation that resolves back to exact text."*

## Do not claim

A checklist for the rewrite. None of these are true on current main:

- continuous or ambient tutoring, or any implication the agent watches you read;
- `upsert_study_experience`, atomic titled lessons, or interactive plots;
- an anchored tutor explanation, direct Study reveal, or continuous presence;
- embeddings, semantic or hybrid search;
- recoverable deletion — delete is currently permanent and one click;
- a user-facing diagnostics surface (diagnostics have been removed from Study,
  not relocated into a finished Activity UI);
- remaster-aware FTS reindexing, annotation re-anchoring, or EPUB export;
- any tool beyond the twenty listed after the current branch is deployed;
- physical Android validation.
