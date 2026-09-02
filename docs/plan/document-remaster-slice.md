# Document remaster: a coding harness inside the reader

Branch: `feat/document-remaster` — isolated worktree, based on `4780220`.

## What this is

An agent reads a section's real source — the packaged XHTML and its
stylesheets — decides what the document should be, and writes it back. Bookhand
does not model the repair, restrict it to a vocabulary of structural verbs, or
limit it to mathematics. The model is free to rewrite document structure,
headings, MathML, figures, captions, accessibility, and CSS **together**,
because those are not separable problems: an equation image is also a missing
heading level is also a figure that lost its caption.

This is not a styling feature. The section Foliate renders and the section
Bookhand extracts and indexes are both the rewritten document.

The reason this is the right shape is not a preference. It is what these models
already are. An agent with a read tool and an edit tool refactors applications
and rewrites legacy code every day; a section of Gutenberg XHTML is a smaller
version of that task. Building a compiler to do it instead would be building a
worse agent, and it would break on the first book whose pathology nobody
anticipated.

## The book this has to repair

*Calculus Made Easy* (Project Gutenberg 33283, bundled at
`public/books/calculus-made-easy.epub`) carries **3,687 `img[data-tex]`
elements, 2,267 of them distinct**. Every variable and every equation is an
image with a speech-shaped `alt` and the real LaTeX parked in a data attribute:

```html
<img alt="x plus d x" data-tex="\({x+d x}\)"
     src="6053415010867724369_25.svg"
     style="vertical-align: -0.188ex; width: 6.53ex; height: 1.758ex;"/>
```

A mathematics textbook whose mathematics is not text. It cannot be selected,
cannot be searched as mathematics, does not reflow, inverts wrongly in a dark
theme, and reaches a screen reader as `30 Superscript ring`.

## The tools

| Tool | What it is for |
| --- | --- |
| `get_section_source` | The section's packaged XHTML and its named stylesheets. |
| `diagnose_section` | Counts and structure — facts, with nothing classified. |
| `rewrite_section` | The agent's markup, and optionally CSS, for the whole section. |
| `compile_section_math` | An optional shortcut, described below. |
| `set_section_view` | `original`, `rewritten`, `undo`, `reset`. |

`diagnose_section` deliberately classifies nothing. It reports how many blocks,
headings and images a section has and what each image carries; deciding that an
image is an equation rather than an illustration, or that a bold paragraph is
really a heading, is the judgement the agent is there to make. A heuristic that
guessed would be wrong on the next book and would quietly cap the ceiling of
every agent that trusted it.

### Source is packaged, not rendered

`get_section_source` returns the document from `section.createDocument()`, with
`src`, `href` and `url()` still **package-relative**, and the section's
stylesheets by packaged name rather than concatenated into one anonymous blob.

This matters more than it looks. The rendered DOM carries `blob:` URLs that
exist only for this page load. A rewrite built from those would be meaningless
after a reload and could never be exported as an EPUB, so the agent is given
the book's own vocabulary and writes back in the same terms.

## The seams

Foliate reaches a section two ways, and both are wired from one place.

1. **Rendering — `book.transformTarget`.** `Loader.createURL`
   (`node_modules/foliate-js/epub.js:719-726`) dispatches a `data` event and
   awaits `detail.data` before creating the blob URL the iframe loads. The
   rewrite is served there, so Foliate parses, measures and paginates the
   agent's document as if the publisher had shipped it.
2. **Extraction — `section.createDocument()`.** This calls `Book.loadDocument`
   (`epub.js:1038-1041`) directly and never touches the loader, so the `data`
   event never fires for it. `FoliateReaderAdapter.#createSectionDocument`
   applies the same version itself. Without this the reader's visible text and
   its search index would be different books.

### Resource replacement happens first

`loadReplaced` (`epub.js:818-876`) rewrites the publisher's relative references
to blob URLs **before** `createURL` fires the `data` event. Markup injected at
that seam has therefore already missed resource replacement: an agent's
`src="images/fig4.svg"` would render a broken figure.

So `src/remaster/resources.ts` builds a raw-to-loaded map by pairing the raw
section document against the one the loader just produced — replacement only
changed attribute values, so document order gives an exact correspondence — and
translates the agent's references through it. `tests/e2e/remaster-agent.spec.ts`
proves a non-equation figure written with a package-relative path still loads,
and that the source handed to the agent contains no `blob:` URL.

### Showing a rewrite means rebuilding the view

A rendered section cannot be repaired from the outside. Foliate paginates what
it parses and keeps ranges into the nodes it measured; replacing the body of a
rendered section leaves the reader an empty column and a location that has
drifted into another chapter, and nothing recovers it, because the damage is to
state the paginator owns. Navigating to the section it is already on does not
help either: `Paginator.#goTo` skips the load entirely when the index has not
changed (`paginator.js:1004`), so the loader is never asked again.

So the view is replaced: `close()`, a fresh `foliate-view`, `open(book)`,
`init()`, and back to the section. Rebuilds are serialized, because two
overlapping navigations leave the renderer with no view at all.

The cost is that a rewrite lands at the top of its chapter rather than exactly
where the reader was standing. That is honest — it is not the chapter they were
partway through.

## Guardrails, not a boundary

Freedom this wide needs recovery, not restriction:

- **Version history.** Every rewrite appends. The publisher's markup is version
  zero, captured before the first edit, and never overwritten.
- **Undo** steps back one revision. **Reset** returns to the book as published.
- **Original / Rewritten** flips what is on screen without discarding anything.
- **Sanitization** is the one thing code keeps for itself. Agent-authored
  markup is untrusted input exactly as book-authored markup is: scripts, event
  handlers, off-origin and `javascript:` URLs, `@import` and remote `url()` are
  removed, and every removal is reported back to the agent so a partly refused
  proposal is visible rather than silently thinned. Package-relative paths are
  kept, because they are the whole point. This is a sanity check on the way in,
  not a vocabulary the agent must write within.

## Persistence: what this does not do yet

**Rewrites live in adapter memory for the session.** A rewritten section
survives navigating away and coming back — the transform serves it on every
load — but it does **not** survive a page reload, and it is not written to
SQLite or re-indexed through FTS5.

That is the next piece of work, and the source contract above is what makes it
possible: because a version stores package-relative markup rather than
ephemeral blob URLs, it can be persisted, re-applied in a later session, and
eventually exported as a repaired EPUB. Until then the honest claim is a
session-scoped repair with full in-session recovery, not "re-reading costs zero
tokens forever".

Re-anchoring existing highlights across a rewrite is unsolved for the same
reason, and is named below.

## What a rewrite costs, stated plainly

A whole-section rewrite changes the document's element structure, and EPUB CFI
addresses elements positionally. A highlight or study item anchored inside a
rewritten section can stop resolving.

- The publisher's markup is archived, so **Reset restores the exact structure**
  those anchors were made against. Nothing is lost permanently.
- The optional `compile_section_math` shortcut is one-for-one by construction —
  one element replaced by one element in the same position — so it does not
  disturb anchors at all. `replaceOneForOne` asserts this rather than assuming.
- A free-form rewrite is the agent's to make and the person's to keep or throw
  away, which is what Undo, Reset and the Original/Rewritten flip are for.

## The deterministic compiler, in its actual place

`compile_section_math` compiles `data-tex` to MathML locally, covering **99.9%
of the bundled book's 3,687 equation images** (measured) with no model call, no
network, and no tokens. It is a **shortcut the agent may choose**, for when the
mathematics is the only thing wrong and the alternative is transcribing several
hundred identical images by hand. Its output is an ordinary rewrite: the same
Undo puts the images back.

It is not the architecture, not a boundary on what an agent may do, and never
something that happens to a book on its own.

## Demo arc

1. **The crime.** Open the bundled book. The mathematics is images: it cannot
   be selected, it does not reflow with the text, it inverts wrongly in the
   night theme, and a screen reader receives `30 Superscript ring`.
2. **The diagnosis.** The agent calls `diagnose_section` and reports what is
   actually wrong, with counts, from the real document.
3. **The transformation.** The agent reads the source, writes the chapter it
   thinks it should be, and the reader shows it.
4. **The proof.** Selection runs across a formula. The accessibility tree
   carries structure instead of a sentence of speech text. The mathematics
   reflows and follows the theme.

**Do not claim the index was empty.** Bookhand already extracts `data-tex` into
passage text (`src/reader/text.ts:50-52`), so search was never returning
nothing — it was returning TeX source. The honest search claim, measured in
`tests/unit/remaster-book.test.ts` against chapter III, is that the indexed
text stops being control syntax and starts being mathematics: `\({\dfrac{d
y}{d x}}\)` becomes `dy/dx`. In that chapter `dy/dx` appears **twice** before
restoration — both times inside a human-written figure description, never in an
equation — and **thirteen** times after. A false baseline would be a worse demo
than the true one, which is already strong.

## Slice boundary

In:

- `src/remaster/sanitize.ts` — the allow-list sanitizer for markup and CSS,
  with every refusal counted and reported.
- `src/remaster/rewrite.ts` — reading a section as packaged source, preparing a
  version, applying one, and the history Undo and Reset walk.
- `src/remaster/resources.ts` — the raw-to-loaded reference map.
- `src/remaster/section-transform.ts` — serving a version at `transformTarget`.
- `src/remaster/diagnose.ts` — facts about a section, classifying nothing.
- `src/remaster/tex.ts`, `src/remaster/document.ts` — the optional shortcut.
- Adapter wiring on both Foliate paths, plus the view rebuild.
- A visible Original / Rewritten control with Undo and Reset.
- The five WebMCP tools above.

Out, named so it is deferred rather than forgotten: persisting rewrites into
SQLite and re-indexing them through FTS5; exporting a repaired EPUB;
re-anchoring existing annotations across a rewrite. All three sit on top of the
source contract this slice establishes.

## Security posture

Hackathon-grade, with the sharp edges closed rather than deferred.

Agent-authored markup is untrusted input in exactly the way book-authored
markup is, and it meets the same allow-list: only known-safe elements and
attributes survive, never an `on*` handler, and URLs may only be
package-relative, `blob:`, a `data:` image, or a fragment — so a rewritten
section cannot run code, cannot fetch, and cannot leak what a person is
reading. Sanitization happens in an inert document, before anything is
inserted. Every refusal is counted and returned to the agent.

The optional TeX path has its own bounds: a fixed command table, limits on
length, depth and node count, output built as DOM nodes rather than parsed from
a string, and unknown commands that fail one element rather than a section.

No backend, no network, no eval.
