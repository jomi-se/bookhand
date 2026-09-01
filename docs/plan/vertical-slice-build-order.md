# Vertical-slice build order

The shortest route is to make the hero interaction real in layers that remain
useful if later layers slip. Do not build all infrastructure first.

## Slice 1: the book is usable

- Add upstream Foliate.js behind `ReaderAdapter`.
- Bundle one legally redistributable technical EPUB fixture.
- Render it, navigate the TOC, restore position after reload, and expose a text
  selection with a stable CFI range.
- Add the minimum typography controls and a custom-CSS preview/reset.

Done means the app is already a small competent reader on desktop and Pixel 7.

## Slice 2: the board is useful without an agent

- Persist highlights and notes tied to CFI ranges.
- Add one study board per book, docked and expanded views, and native prose,
  quotation, equation, steps, question, and Mermaid blocks.
- Make every source-linked item navigate back into the book.

Done means a person can build and revisit study material manually.

## Slice 3: WebMCP can drive the same domain

- Introduce domain commands used by both UI actions and tool handlers.
- Register `get_reading_context`, `get_passage`, `navigate_book`,
  `save_annotation`, `set_reading_style`, `upsert_study_item`, and
  `set_study_board_view`.
- Exercise the tools through the event's supported agent surface.

Done means an agent can turn the selected passage into a source-linked native
lesson without semantic search.

This is the first credible submission checkpoint. Preserve it before continuing.

## Slice 4: local whole-book retrieval

- Extract CFI-anchored chunks and implement exact/lexical search.
- Add the local embedding worker, explicit model download, visible indexing,
  IndexedDB vector persistence, brute-force cosine, and hybrid fusion.
- Add `search_book` and `get_table_of_contents` to the WebMCP surface.
- Test queries that require an earlier definition and a related worked example.

Done means the agent can ground a lesson beyond the visible page without book
content leaving the browser.

## Slice 5: demonstrate open-ended teaching

- Add the bounded generated-lab block.
- Choose one passage where a small interactive visualization materially beats a
  prose answer.
- Let the agent retrieve context, create the lab, attach it to the passage, and
  update it after a follow-up request.
- Polish this exact path and record the demo.

Done means the WebMCP thesis is visible: semantics let the model compose a new
in-page learning experience rather than merely operate an ebook UI.

## Cut order if time collapses

Cut in this order:

1. semantic search, while retaining exact/lexical lookup;
2. custom generated labs, while retaining polished native blocks;
3. multiple boards and broad block editing;
4. nonessential reader settings.

Never cut stable source citations, return-to-book navigation, the real WebMCP
path, or persistence of the hero artifact. Those carry the product claim.
