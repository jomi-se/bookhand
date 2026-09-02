# Document remaster: implementation plan and contract

Branch: `feat/document-remaster` — isolated worktree, based on `4780220`.
Status: contract for a vertical slice. Written before implementation.

> **Superseded in part on 2026-09-02.** The first draft of this document made
> a deterministic TeX compiler the architecture. It is not. It is an optional
> shortcut. The feature is a coding harness for the EPUB itself: the agent gets
> read access to the section's real XHTML and CSS and a whole-section write
> tool, and decides everything. See *The architecture* below.

## What this is

Actual EPUB **document restoration**, not styling. Broken section XHTML is
transformed into semantically correct markup before Foliate renders it and
before Bookhand extracts, chunks, and indexes it. CSS is supplementary and is
not the product.

The hero pathology is the one the demo book actually has. *Calculus Made Easy*
(Project Gutenberg 33283, bundled at `public/books/calculus-made-easy.epub`)
carries **3,687 `img[data-tex]` elements, 2,267 of them distinct**. Every
variable and every equation in the book is a rasterizable SVG image with a
speech-shaped `alt` and the real LaTeX parked in a data attribute:

```html
<img alt="x plus d x" data-tex="\({x+d x}\)"
     src="6053415010867724369_25.svg"
     style="vertical-align: -0.188ex; width: 6.53ex; height: 1.758ex;"/>
```

That is a mathematics textbook whose mathematics is not text. It cannot be
selected, cannot be searched as mathematics, does not reflow, inverts wrongly
in a dark theme, and reaches a screen reader as `30 Superscript ring`.

## The architecture: a coding harness inside a reader

An agent reads a section's real markup and writes it back. That is the whole
shape of it. Bookhand does not model the repair, restrict it to a vocabulary of
structural verbs, or limit it to mathematics.

The model is free to rewrite document structure, headings, MathML, figures,
captions, accessibility, and CSS **together**, in one pass, because those are
not separable problems: an equation image is also a missing heading level is
also a figure that lost its caption. Anything that constrained the agent to one
of those at a time would produce a worse chapter than a person would.

The reason this is the right shape is not a preference. It is what these models
already are. An agent with a read tool and an edit tool refactors applications,
migrates databases, and rewrites legacy code every day. A section of Gutenberg
XHTML is a smaller version of exactly that task. Building a compiler to do it
would be building a worse agent, and it would break on the first book whose
pathology nobody anticipated.

So the tools are:

| Tool | What it is for |
| --- | --- |
| `get_section_source` | The section's rendered XHTML and CSS, as source to edit. |
| `diagnose_section` | Counts and structure — facts, with nothing classified. |
| `rewrite_section` | The agent's markup for the whole section body. |
| `compile_section_math` | An optional shortcut, described below. |
| `set_section_view` | `original`, `rewritten`, `undo`, `reset`. |

`diagnose_section` deliberately classifies nothing. It reports how many blocks,
headings and images a section has and what each image carries; deciding that an
image is an equation rather than an illustration, or that a bold paragraph is
really a heading, is the judgement the agent is there to make. A heuristic that
guessed would be wrong on the next book and would quietly cap the ceiling of
every agent that trusted it.

### Guardrails, not a boundary

Freedom this wide needs recovery, not restriction:

- **Version history.** Every rewrite appends. The publisher's markup is version
  zero and is captured before the first edit, so it is never overwritten.
- **Undo** steps back one revision. **Reset** returns to the book as published.
- **Original / Rewritten** flips what is on screen without discarding anything.
- **Sanitization** is the one thing code keeps for itself. Agent-authored
  markup is untrusted input exactly as book-authored markup is: scripts, event
  handlers, off-origin URLs, and `@import` are removed, and every removal is
  reported back to the agent so a partly refused proposal is visible rather
  than silently thinned. This is a sanity check on the way in, not a
  vocabulary the agent must write within.

### The deterministic compiler, in its actual place

`compile_section_math` compiles `data-tex` to MathML locally, covering 99.9% of
the bundled book's 3,687 equation images with no model call. It is a **shortcut
the agent may choose**, for when the mathematics is the only thing wrong and
the alternative is transcribing several hundred identical images by hand. Its
output is an ordinary rewrite: the same Undo puts the images back.

It is not the architecture, not a boundary on what an agent may do, and never
something that happens to a book on its own.

## The seam

Two seams, because Foliate has two paths into a section and only one of them is
hookable.

1. **Render path — `book.transformTarget`.** `Loader.createURL`
   (`node_modules/foliate-js/epub.js:719-726`) dispatches a `data`
   `CustomEvent` carrying `{ data, type, name }` and then `await`s
   `event.detail.data` before creating the blob URL that the iframe loads. A
   listener may replace `detail.data` with transformed markup. Bookhand already
   uses the sibling `load` event on the same target to refuse packaged scripts
   (`src/reader/FoliateReaderAdapter.ts:783-789`).

2. **Extraction path — `section.createDocument()`.** This calls
   `Book.loadDocument` (`epub.js:1038-1041`), which reads the section text
   directly and **does not go through the loader**, so the `data` event never
   fires for it. Passage extraction, chunking, search indexing, and CFI
   resolution all run through `FoliateReaderAdapter.#createSectionDocument`
   (`src/reader/FoliateReaderAdapter.ts:678-691`), so the transform must be
   applied there a second time.

A transform installed in only one of these produces a reader whose visible text
and whose indexed text disagree. Both are wired, from one pure function.

## What a rewrite costs, stated plainly

A whole-section rewrite changes the document's element structure, and EPUB CFI
addresses elements positionally. So a highlight or a study item anchored inside
a rewritten section can stop resolving.

This is a real cost and it is not hidden:

- The publisher's markup is archived, so **Reset restores the exact structure**
  those anchors were made against. Nothing is lost permanently.
- The optional `compile_section_math` shortcut is one-for-one by construction —
  one element replaced by one element in the same position — so it does not
  disturb anchors at all. Its `replaceOneForOne` asserts this rather than
  assuming it.
- A free-form rewrite is the agent's to make and the person's to keep or throw
  away, which is what Undo, Reset and the Original/Rewritten flip are for.

Persisting rewrites and re-anchoring existing annotations across them is the
first piece of work after this slice, and it is named in *Slice boundary*.

## Demo arc this slice must serve

1. **The crime.** Open the bundled book. The mathematics is images: it cannot
   be selected, it does not reflow with the text, it inverts wrongly in the
   night theme, and a screen reader receives `30 Superscript ring`.
2. **The diagnosis.** The agent calls the inspection tool and reports what is
   actually wrong, with counts, from the real document.
3. **The transformation.** The section becomes semantic MathML live on screen,
   with a Before/After control the person drives.
4. **The proof.** Selection runs across a formula. The accessibility tree
   carries structure instead of a sentence of speech text. The mathematics
   reflows and follows the theme.

**Do not claim the index was empty.** Bookhand already extracts `data-tex`
into passage text (`src/reader/text.ts:50-52`), so search was never returning
nothing — it was returning TeX source. The honest search claim, measured in
`tests/unit/remaster-book.test.ts` against chapter III, is that the indexed
text stops being control syntax and starts being mathematics: `\({\dfrac{d
y}{d x}}\)` becomes `dy/dx`. In that chapter `dy/dx` appears **twice** before
restoration — both times inside a human-written figure description, never in an
equation — and **thirteen** times after. A false baseline would be a worse
demo than the true one, which is already strong.

## Slice boundary

In:

- `src/remaster/sanitize.ts` — the allow-list sanitizer, with every refusal
  counted and reported.
- `src/remaster/rewrite.ts` — reading a section as source, writing one back,
  and the version history Undo and Reset walk.
- `src/remaster/diagnose.ts` — facts about a section, classifying nothing.
- `src/remaster/tex.ts`, `src/remaster/document.ts` — the optional shortcut.
- Adapter wiring on both Foliate paths, so the rendered book and the indexed
  book stay the same book.
- A visible Original / Rewritten control with Undo and Reset.
- The five WebMCP tools above.

Out (named so it is deferred, not forgotten): persisting rewrites into SQLite
so a repaired chapter survives a reload and costs nothing to re-read, and
re-running FTS5 indexing over a rewritten section. Both are storage work on top
of a seam that already exists; neither is needed to prove the capability.

## Security posture

Hackathon-grade, with the sharp edges closed rather than deferred.

Agent-authored markup is untrusted input in exactly the way book-authored
markup is, and it meets the same allow-list: only known-safe elements and
attributes survive, never an `on*` handler, and URLs may only be `blob:`, a
`data:` image, or a fragment — so a rewritten section cannot run code, cannot
fetch, and cannot leak what a person is reading. Sanitization happens in an
inert document, before anything is inserted. Every refusal is counted and
returned to the agent.

The optional TeX path has its own bounds: a fixed command table, limits on
length, depth and node count, output built as DOM nodes rather than parsed from
a string, and unknown commands that fail one element rather than a section.

No backend, no network, no eval.
