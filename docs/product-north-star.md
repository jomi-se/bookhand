# Product North Star: the book becomes an agent-readable study environment

Last consolidated: 2026-09-01

This document preserves the product idea behind the project, including the
important tensions raised while discussing it. It is the North Star for scope,
design, and demo choices. Plans may change; this thesis should change only
deliberately.

## The core realization

An ebook reader with an AI chat box is ordinary. The exciting possibility is a
reader whose real capabilities are described semantically through WebMCP, so an
agent can understand and reshape the learning experience rather than merely
talk beside it.

Without WebMCP, this is an ebook reader. With WebMCP, a capable model can become
a creative tutor inside the page: it can find the exact passage under study,
connect it to the surrounding chapter, create a worked example, draw a diagram,
build an animation or small interactive experiment, assemble a mind map, quiz
the reader, annotate the book, and adjust how the material is presented.

The pitch is not that browser automation becomes impossible without WebMCP.
Playwright-like agents can always inspect and manipulate a page. The difference
is that WebMCP turns brittle visual inference into an intentional application
contract: named operations, schemas, application semantics, and controlled
effects. The agent spends its intelligence teaching and composing useful
experiences instead of reverse-engineering the DOM. The application can expose
powerful actions that would be awkward or unreliable to reproduce through
clicks, while keeping those actions within the app's own rules.

That is the hackathon claim to demonstrate, not merely state.

## The baseline reader must be real

The application begins as a pleasant, useful client-side ebook reader. It should
not feel like a thin stage prop wrapped around an AI demo. The initial format is
EPUB, using the smallest useful Foliate.js boundary rather than forking a whole
mature reader unless evidence forces that choice.

The reader should support:

- opening a book locally and returning to the last reading position;
- table-of-contents navigation and precise locations;
- selection, highlighting, notes, and revisiting annotations;
- readable typography, themes, spacing, width, and book-level CSS overrides;
- focused reading on desktop and mobile;
- local persistence without an account or server.

A calculus textbook is the current hero-book placeholder because mathematical
material creates obvious opportunities for worked examples, visual reasoning,
and interactive teaching. It is not sacred; another technical book may replace
it if it yields a clearer, more delightful demonstration.

## The tutor is a capability composition, not a fixed chatbot

The application should expose enough precise book and workspace semantics that
the model's creativity, not a hard-coded tutor flow, determines the upper bound
of the lesson. Useful capability families include:

### Understand the reading context

- identify the open book, chapter, visible range, current location, and selected
  passage;
- retrieve exact nearby text with stable citations back into the book;
- inspect the table of contents and move through structural neighbors;
- search exact text and headings;
- search conceptually across the book when semantic search earns its complexity;
- inspect relevant highlights, notes, prior study artifacts, and progress.

Semantic search is desirable, but it should not become infrastructure theater.
For the proof of concept, structural and lexical retrieval may be enough. Add
embeddings only if the hero interaction clearly needs them.

### Change the reading presentation

- adjust font, size, measure, spacing, theme, and other stable preferences;
- apply constrained CSS customizations for transformations the normal settings
  do not express;
- preview, explain, persist, and reset agent-authored presentation changes.

Agents are particularly good at CSS. Letting one adapt a dense mathematical
book for a particular reader is a meaningful WebMCP use, provided changes are
visible and reversible.

### Work with the reader's knowledge

- create and update highlights and notes;
- attach explanations or study artifacts to a passage or concept;
- assemble summaries, flashcards, questions, worked solutions, concept maps,
  and progress cues;
- bring the user back from an artifact to the precise source material.

## The study board is both a companion and a place

The study board should support two spatial modes:

1. A docked companion beside or over the reading surface for quick explanations,
   annotations, and small examples while context remains visible.
2. A larger focused workspace for diagrams, multi-step derivations, mind maps,
   comparisons, animations, and interactive lessons.

These are two views of the same persistent material, not separate products. A
reader should be able to zoom into a question, work with it, and zoom back out
to the book without losing their place or the relationship between source and
artifact.

Common study content should use polished native blocks: prose, quotations with
book citations, equations, steps, callouts, questions, answers, diagrams, and
simple plots. A fixed catalog alone, however, would undermine the premise that
the tutor can be as creative as the connected model.

Therefore the board also needs an escape hatch for generated experiences: a
bounded “lab” or mini-surface where the agent can create custom visual or
interactive material when predefined blocks are genuinely insufficient. This
is not an invitation to let arbitrary code invisibly own the application. The
lab should be explicit, disposable, and confined to its board region, with a
small bridge to approved data and actions.

For this client-only proof of concept, do not turn that boundary into a grand
production sandboxing project. Basic containment and clear user control are
enough. The purpose is to enable the demonstration, not to solve hostile-code
execution for the web at large.

## What WebMCP should make visible

The best demo should contrast semantics with generic browser driving without
needing a lecture. The agent should perform operations that are precise,
compound, and naturally grounded in the application's data model:

- quote the exact current theorem and jump back to it;
- retrieve definitions from earlier chapters without scrolling the UI;
- construct an interactive geometric explanation tied to a selected equation;
- save the explanation next to the passage and later update it;
- reformat the book for a specific learning need and offer an immediate reset.

The application remains usable when no agent is present. WebMCP is essential to
the *open-ended tutor behavior*, not to basic reading.

## Agent Connect's place

Agent Connect makes this idea much stronger in personal use because it can let
the web application communicate bidirectionally with a powerful user-owned
agent paid through an existing subscription. It also introduces setup that a
hackathon judge is unlikely to complete in a few minutes.

So Agent Connect is an optional future or power-user transport, not a dependency
of the initial submission. The first demo should work with the WebMCP-capable
agent environment the event expects. If Agent Connect is added later, the
reader's tool and domain APIs must remain neutral rather than becoming coupled
to its gateway or to Codex.

## Product principles

- **Reader first.** The book remains calm, legible, and primary.
- **Semantics over simulated clicks.** WebMCP tools express domain operations,
  not DOM coordinates.
- **Creativity with a bounded place to land.** Native blocks cover the common
  case; generated labs preserve the model's expressive ceiling.
- **Source connection is never lost.** Artifacts point back to exact book
  locations and the user can return easily.
- **Persistent effects are visible and reversible.** Notes, styles, and study
  material belong to the user.
- **Local-first and judgeable.** No account, private gateway, or model bill is
  required to understand the submission.
- **Prove one magical path before generalizing.** A polished passage-to-lesson
  interaction matters more than a sprawling tool catalog.

## The first decisive demonstration

The target experience is:

1. The reader opens the bundled technical book and selects a difficult passage.
2. They ask their compatible agent to help them truly understand it.
3. The agent obtains exact passage and chapter context through WebMCP.
4. It retrieves earlier definitions or examples from the book as needed.
5. It creates a tailored study artifact—ideally something visual or interactive
   that a static chat answer would not provide—inside the docked board.
6. The reader expands the board, interacts with the lesson, and asks a follow-up.
7. The artifact, citations, and relevant note persist, and the reader returns to
   the exact source location.

If this feels obviously more useful than “chat with this PDF,” the project has
proved its thesis.

