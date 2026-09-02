# Document remaster: implementation plan and contract

Branch: `feat/document-remaster` — isolated worktree, based on `4780220`.
Status: contract for a vertical slice. Written before implementation.

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

## The 1:1 invariant

**The transform replaces each pathological element with exactly one element in
the same position. It never adds, removes, or reorders siblings, and never
touches a text node.**

This is not tidiness. EPUB CFI addresses element children by position, so a
node-for-node swap leaves every existing CFI — every stored highlight, every
study item's source range, every search hit — resolving to the same place in
the remastered document as in the original. Violating the invariant silently
invalidates persisted user data. Every transform is asserted against it.

## Deterministic first, agent second

`data-tex` restoration is a **deterministic** compilation, not a model call. A
bounded TeX subset compiles to MathML locally, with no network, no tokens, and
identical output on every run. The corpus vocabulary is small and measured:
`\frac`/`\dfrac`/`\tfrac` (2,382), `\left`/`\right` (954), `\sqrt` (357),
`\int` (205), the named operators (`\log`, `\sin`, `\cos`, `\tan`, ...), the
Greek letters, `\text`, `\cdot`, `\times`, `\pm`, spacing commands.

What the compiler cannot parse is **left alone**, counted, and reported. It is
never guessed at and never silently dropped. Those residues are what a
connected agent is for: it inspects the report, proposes corrected **TeX** for
a named element, and Bookhand compiles that TeX through the same validated
compiler. The agent never supplies markup, and no book- or agent-authored
string is ever evaluated, `innerHTML`-ed, or executed. MathML is constructed
node by node through `createElementNS`.

## Reversibility

- The imported EPUB bytes in SQLite are never rewritten. The transform is
  in-memory, per section load.
- Every restored element carries its own original: `data-bookhand-remaster`,
  `data-bookhand-original-src`, `data-bookhand-original-alt`, and the source
  TeX. A single element can therefore be reverted in place, with no reload.
- Presentation mode is a user-visible **Original / Restored** control. Because
  the transform is 1:1 and self-describing, switching modes walks the live
  rendered documents and swaps them in place — instant, and reversible in both
  directions.
- Foliate's loader caches one blob URL per section href, so the cached copy is
  **always** the restored one; `original` mode is applied as a live revert on
  each rendered document. This keeps the two modes from depending on load order.

## Extraction follows the restored document, always

Search, chunking, and passage extraction use the restored document regardless
of presentation mode. Restored text is strictly more truthful than the
original: `src/reader/text.ts:50-52` currently emits the raw `\({x+d x}\)`
source as the passage text for a `data-tex` element. After restoration the same
passage carries a readable linear form (`x + dx`) via `alttext`, with the TeX
preserved in `<annotation encoding="application/x-tex">`. Making the index
follow a presentation toggle would mean re-indexing the book on every flip, for
a strictly worse index. Recorded here so it is a decision and not an accident.

## Human sovereignty, approval, and persistence

The deterministic `data-tex` pass and the agent's structural proposals are not
the same kind of change, and they must not be governed the same way.

- **Deterministic math restoration is free and repeatable.** It costs no
  tokens, produces identical output every run, and is derived entirely from
  ground truth the publisher already shipped in the file. It runs on load, and
  caching it would buy nothing.
- **Agent-proposed structural repair is neither.** It costs tokens, it is a
  judgement about a document, and it must not touch the reader until a person
  approves it. So it follows: **propose -> in-place Before/After -> Approve or
  Discard**. Only on approval is the repaired section written to SQLite and
  re-indexed through FTS5, after which re-reading that chapter costs nothing
  forever. The original section text stays archived beside it, so
  **Revert to original** remains available permanently.

Agent structural repair is a bounded vocabulary of validated operations over
named elements — promote this element to a heading, wrap this equation and its
number in a `figure`, mark this block as a footnote — not a blob of HTML the
agent authored. The allow-list is the security boundary: an operation Bookhand
does not model is rejected with a structured error, never applied hopefully.

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

- `src/remaster/tex.ts` — bounded TeX → MathML AST → DOM, plus a linear text
  form. Pure, deterministic, DOM-constructing, never string-injecting.
- `src/remaster/document.ts` — `remasterDocument(doc)` / `revertDocument(doc)`
  with a `RemasterReport`, enforcing the 1:1 invariant.
- Render wiring on `transformTarget`, extraction wiring in
  `#createSectionDocument`, live mode swap over `renderer.getContents()`.
- A visible Original / Restored control stating what was restored.
- WebMCP: `get_document_restoration` (inspect), `set_document_restoration`
  (trigger), `restore_math_element` (bounded propose-and-compile).
- Deterministic unit tests over the compiler, the invariant, the report, and a
  real-fixture test proving one bundled-book section is restored and then
  consumed by extraction.

Out (named so it is deferred, not forgotten): span-soup de-crufting, figure and
caption reunification, footnote roles, persistence of the mode across reloads,
and remaster caching in SQLite. The seam and the report generalize to all of
them; none is needed to prove the capability.

## Security posture

Hackathon-grade, but with the sharp edges closed rather than deferred:
book-authored TeX and agent-proposed TeX are both untrusted input to a parser
with a fixed command table and a depth and length bound; output is built as DOM
nodes; unknown commands fail the element rather than the section; a failed
element keeps its original image. No backend, no network, no eval.
