# Book artifacts: the daily study loop

Status: **accepted** on 2026-09-29 by the owner after a grilling session.

Authorities: [North Star](../../product-north-star.md) (“The daily study
loop”), [CONTEXT.md](../../../CONTEXT.md) for vocabulary,
[ADR 0012](../../decisions/0012-keep-conversations-memories-and-voice.md) for
persistence, and
[ADR 0013](../../decisions/0013-generated-artifacts-run-in-their-own-frame.md)
for generated code.

## Problem

The reader has become a good ebook reader. The study and tutor side has not:
lessons are rigid lists of five block types, nothing visual or interactive
exists, the Tutor renders plain text, conversations vanish, and nothing
carries what the reader learned into the next conversation. The owner still
reads technical books by fighting publisher CSS until code is legible on a
phone, then copying pages into Gemini or NotebookLM to ask about them. Bookhand
should replace that routine and be far better at it.

## Users and bar

The owner is the primary user, reading technical books (currently *Deep
Learning with Python*) mostly on a phone. Judge every ticket by sustained daily
use, not by a demo moment. The owner's current CSS is “passable at best”; the
readability bar is to be much better than it.

## Settled direction

### Organizing structure

- The book is the container. Everything is anchored to passages, a chapter, or
  the whole book.
- The **Notebook** replaces the Study panel as the place to browse everything
  about one book: artifacts, highlights, memories, and conversations. Default
  grouping is by chapter, with type filters and a recent view.
- Named containers, session types, and cross-book work are deferred. A
  cross-book canvas is a plausible later surface.

### Artifacts

- An artifact may be anything an agent can build as a web page, rendered per
  ADR 0013. Smart building blocks make common work easy: live book
  quotations that jump to the source, typeset math, highlighted code, plot and
  motion helpers, theme tokens. They never constrain style or shape.
- Notes the reader types are artifacts. Highlights are marks on the book, and
  artifacts may anchor to them.
- Artifacts leave **markings** on the book (a highlight, a margin stroke, a pin,
  or something better) that lead back to them. Explore marking designs
  creatively; the owner has not constrained them.
- Any agent in any later conversation may revise an artifact. Every earlier
  version is kept, with a quiet restore.
- **Dismiss** hides; **Delete** destroys. Nothing agent-made is transient.

### Conversations, memories, and voice

- Chat stays chat, but renders with the same rich renderer as artifacts,
  including generated visuals.
- **Keep** turns any message, or a selected part of one, into an artifact
  instantly and locally, anchored to what the conversation concerned. No agent
  round-trip.
- A conversation shows a compact link when the agent makes an artifact; the
  artifact itself appears at its anchor and in the Notebook.
- Memories record what the reader understood, struggled with, and thinks of
  the material. Agents write them visibly and decide whether to ask first. The
  reader can edit and delete every memory.
- The tutor's **voice** is a memory: one global, with optional notes per book.
  Every agent reads it before speaking. Try it and adjust by feel.
- External WebMCP agents read memories and voice and write memories and
  artifacts through the same tools.

### Seeing more of the book and the world

- Agents can read at chapter scale: a whole chapter as clean text with code
  listings intact.
- Bookhand asks the connection to allow web search. For direct Open
  Responses, that is a provider-hosted web search tool. For Agent Connect,
  capability depends on the gateway and agent; that work belongs in the
  `agent-connect` repository and private cross-repository planning. Agents may
  link external material directly; do not build a separate references feature.

### Readability

The owner's reference CSS is in
[reference/owner-readest-dlwp-mobile.css](reference/owner-readest-dlwp-mobile.css).
It fixes five problems:

1. code listings wrap or overflow on a narrow screen;
2. dark mode breaks publisher colors (invisible captions, blinding white
   callouts, dark text on dark);
3. headings are oversized;
4. the publisher fakes headings with class names;
5. syntax highlighting clashed with dark mode, so the owner removed it.

Problems 1–3 become built-in compatibility handling for every book. Problems 4
and 5 become the tutor's first-run offer for a book: detect this book's fake
headings from its real markup, and re-highlight code in theme-aware colors
rather than deleting color.

### Clean slate

Delete the Study lesson and item model, its tools
(`create_study_lesson`, `list_study_lessons`, `upsert_study_item`,
`list_study_items`, `set_study_board_view`), and its storage, with no
migration. Highlights and notes are rebuilt on the new model if that is
simpler.

## Out of scope

Reader-management features (library organization, reading statistics,
dictionary, OPDS, sync), spoken audio, cross-book topics, and semantic search
until tool-based retrieval visibly fails.

## Tickets

Build in this order. The prototype decides the surface everything else lands
on.

1. [Phone artifact surface prototype](issues/01-phone-artifact-surface-prototype.md)
2. [Artifacts](issues/02-artifacts.md)
3. [Conversations, memories, and voice](issues/03-conversations-memories-voice.md)
4. [Notebook and markings](issues/04-notebook-and-markings.md)
5. [Technical-book readability](issues/05-technical-book-readability.md)
6. [Chapter-scale reading and web search](issues/06-chapter-reading-and-web-search.md)
