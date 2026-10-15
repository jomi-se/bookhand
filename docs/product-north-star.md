# Product North Star: the book becomes an agent-readable study environment

Last consolidated: 2026-09-01. Revised 2026-09-29: the owner's daily study
loop replaced the hackathon demo as the target, tutoring stopped being
transient, and fixed study blocks gave way to artifacts of any shape.

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
- a per-book choice between polished pages and continuous scrolling across
  reflowable EPUB sections;
- focused reading on desktop and mobile, including technical books whose code
  listings, captions, callouts, and headings stay legible on a narrow phone in
  both light and dark themes;
- local persistence without an account or server.

A calculus textbook is the current hero-book placeholder because mathematical
material creates obvious opportunities for worked examples, visual reasoning,
and interactive teaching. It is not sacred; another technical book may replace
it if it yields a clearer, more delightful demonstration.

## The tutor is a capability composition, not a fixed chatbot

The application should expose enough precise book and workspace semantics that
the model's creativity, not a hard-coded tutor flow, determines the upper bound
of the teaching. Useful capability families include:

### Understand the reading context

- identify the open book, chapter, visible range, current location, and selected
  passage;
- retrieve exact nearby text with stable citations back into the book;
- inspect the table of contents and move through structural neighbors;
- search exact text and headings;
- search conceptually across the book when semantic search earns its complexity;
- inspect relevant highlights, notes, prior study artifacts, and progress.

Semantic search is desirable, but it should not become infrastructure theater.
For the proof of concept, structural and lexical retrieval must work first.
Local embeddings are a planned later slice because they strengthen whole-book
discovery without uploading the book, but they remain cuttable if the hero
interaction does not need them or phone performance is poor.

### Change the reading presentation

- adjust font, size, measure, spacing, theme, and other stable preferences;
- apply constrained CSS customizations for transformations the normal settings
  do not express;
- preview, explain, persist, and reset agent-authored presentation changes.

Agents are particularly good at CSS. Letting one adapt a dense mathematical
book for a particular reader is a meaningful WebMCP use, provided changes are
visible and reversible.

### Remaster the document itself

Some ebooks are not merely ugly. Their document is broken: equations are image
files, visual paragraphs impersonate headings, captions are detached from
figures, reading order is accidental, and the accessibility tree contains less
meaning than the printed page. CSS cannot repair those failures.

Bookhand should let an agent treat one EPUB section like source code. The page
exposes the section's real XHTML and CSS; the agent may rewrite the whole
document into semantic HTML, MathML, figures, captions, and accessible reading
order; Bookhand then renders that result through the ordinary reader. This is
an open coding harness, not a fixed catalogue of repair operations. The model's
judgement is the capability being demonstrated.

The freedom belongs beside strong recovery rather than behind a weaker edit
language. Publisher bytes remain immutable, while accepted repairs become the
reader's current **personal copy**. Bookhand keeps linear recovery history out
of the ordinary reading path but provides Undo, Redo, Restore, and Reset when
something goes wrong. It should feel like a reader with an escape hatch, not a
version-control interface or professional EPUB editor.

Agent-authored markup is still untrusted input, so Bookhand refuses executable
or exfiltrating content and reports actionable detail to the agent. Render,
extraction, citation, search, and Book Health must ultimately observe the same
personal copy; a repair that only paints the iframe is not complete.

A deterministic repair may exist as an optional accelerator when a publisher
already supplied machine-readable ground truth—for example compiling thousands
of `data-tex` images to MathML. It is not the architecture and must not cap what
the agent may improve.

### Make book problems understandable and repairable

Bookhand is not a deterministic universal book fixer. It should render common
EPUBs as well as it safely can, apply general compatibility handling where one
behavior benefits many books, and expose book-specific problems through
**Book Health**. The reader sees a short explanation of the likely effect on
reading, navigation, or accessibility. A connected agent receives the precise
source locations and diagnostic evidence needed to investigate and propose a
repair.

Book Health is a quiet helper, not an inbox, score, or maintenance workflow.
It may say that a book looks good, that issues were found, or that a check was
incomplete. Automatically detected issues and concerns deliberately raised by
the reader or their AI belong in the same overview. When the reader accepts a
repair, the addressed issue disappears from normal view; Bookhand does not keep
a celebratory list of resolved defects.

The normal repair decision is experiential: preview the repaired reading
experience, read a succinct explanation for subtle navigation, structure,
mathematics, or accessibility changes, and decide whether it is better. Raw
markup and technical evidence remain available without becoming the default
UI. The reader's acceptance—not a deterministic checker pretending to
understand meaning—is the final quality judgment.

Repairs should be durable enough that a person does not repeatedly spend time
or tokens fixing the same book. A standalone EPUB export of the personal copy
is the preferred first portability direction. Cross-device synchronization or
community repair sharing may come later, but neither should turn ordinary
reading into an account-dependent service.

### Work with the reader's knowledge

- create and update highlights, notes, and other artifacts;
- anchor artifacts to passages, chapters, or the whole book, and let them
  leave markings on the book that lead back to them;
- remember what the reader understood, struggled with, and thinks of the
  material;
- bring the reader back from an artifact to the precise source material.

## Artifacts can be anything, and the book holds them

An agent's best explanation of a passage may be a paragraph, a worked code
walkthrough, an animation, or a small interactive experiment. A fixed
catalogue of study blocks makes those explanations rigid and lifeless, so an
**artifact** may take any shape the agent can build as a web page: its own
HTML, CSS, and JavaScript, styled however suits the explanation. Bookhand
offers smart building blocks (live book quotations, typeset math, highlighted
code, plot and motion helpers, theme tokens) that make good work easy. They
are accelerators, never a ceiling on shape or style.

The book is the organizing structure. Every artifact is anchored to passages,
a chapter, or the whole book, and may leave **markings** on the page, such as
a highlight, a margin stroke, or a pin, that lead back to it. The book's
**Notebook** is the place to browse everything about it without searching the
text. Notes the reader types are artifacts too; a highlight is a mark on the
book that artifacts may be anchored to.

Artifacts are revisable by any later agent, and every earlier version is kept.
Generated code runs with basic containment and may load libraries from a short
list of trusted CDNs. For this client-only product, containment is proportionate
rather than a grand hostile-code project: it keeps a manipulated artifact from
carrying the reader's book or notes elsewhere, while everything else serves
creative freedom.

A cross-book canvas, where a reader steps out of one book to connect ideas
across several, is a plausible later surface. The first job is helping one
reader understand one book deeply.

## Conversations, artifacts, and memories are kept

Nothing an agent does with the reader is transient. The reader **dismisses**
what they are done looking at, and dismissed material stays findable; only an
explicit **delete** loses anything. Transient tutoring was a technical
limitation, not a principle.

Three kinds of material persist, and they serve different purposes:

- **Conversations** are the exchange with an agent. They render richly, like
  the artifacts they produce, and the reader can **keep** any message or part
  of one as an artifact instantly, without another round-trip to the agent.
  A conversation stays a conversation; it does not become a document.
- **Artifacts** are what the reader returns to.
- **Memories** are what a future agent should know: what the reader
  understood, where they struggled, what they think of the author, and how
  they like to be taught. Agents write memories visibly, deciding whether to
  ask first.

The tutor's **voice**—the tone, humour, and rapport that develop between a
reader and an agent—matters more than any transcript. Bookhand keeps it as a
memory so it survives a new conversation, a different model, or a different
provider. That portability is a direct consequence of keeping the reader's
relationship with the tutor in the page rather than in one vendor's history.

Tutor-directed navigation and pointing remain attributed and under the
reader's control: they show who moved the surface, offer Back and Stop, and
yield to manual navigation. What persists is the record of what the tutor
showed, so the reader can return to it.

## What WebMCP should make visible

The best demo should contrast semantics with generic browser driving without
needing a lecture. The agent should perform operations that are precise,
compound, and naturally grounded in the application's data model:

- quote the exact current theorem and jump back to it;
- retrieve definitions from earlier chapters without scrolling the UI;
- construct an interactive geometric explanation tied to a selected equation;
- save the explanation next to the passage and later update it;
- reformat the book for a specific learning need and offer an immediate reset.

The agent must not need repository access or a harness-specific skill to learn
how Bookhand's design surfaces compose. The page owns a compact, versioned
design context exposed through WebMCP. It describes the current surface,
semantic roles, available primitives, containment boundaries, accessibility
expectations, and reversal paths while explicitly leaving palette,
typography, composition, and expressive direction open to the user and agent.
This is runtime product context, not a hidden system prompt and not a copy of
the complete developer-facing design document.

The application remains usable when no agent is present. WebMCP is essential to
the *open-ended tutor behavior*, not to basic reading.

## Agent Connect's place

Agent Connect makes this idea much stronger in personal use because it can let
the web application communicate bidirectionally with a powerful user-owned
agent paid through an existing subscription. It also introduces setup that a
hackathon judge is unlikely to complete in a few minutes.

So Agent Connect was an optional transport, not a dependency of the initial
submission. Since the submission, the in-app Tutor (through Agent Connect or a
direct Open Responses connection) is the primary way the owner reaches an
agent; external WebMCP agents remain fully supported. Either way, the reader's
tool and domain APIs stay neutral rather than coupled to one gateway, harness,
or model vendor.

## Product principles

- **Reader first.** The book remains calm, legible, and primary.
- **Semantics over simulated clicks.** WebMCP tools express domain operations,
  not DOM coordinates.
- **Creativity without a ceiling.** Artifacts may take any shape; smart
  building blocks make common work easy without constraining it.
- **Source connection is never lost.** Artifacts point back to exact book
  locations and the user can return easily.
- **Persistent effects are visible and reversible.** Notes, styles, and study
  material belong to the user.
- **Book Health serves reading, not maintenance.** Explain known problems in
  plain language, keep technical evidence easy for agents to reach, and never
  turn a book into a queue of chores.
- **Document repair is source editing, not a skin.** Give the model the real
  section and a whole-document write path; preserve the publisher original,
  keep the personal copy recoverable, and let the reader judge proposals by
  the resulting experience.
- **Fix once.** A repair the reader keeps becomes durable, and Bookhand should
  move toward exporting that personal copy as a standalone EPUB.
- **Dismiss, never lose.** Conversations, cues, artifacts, and memories stay
  until the reader dismisses or deletes them; tutor cues are clearly
  attributed and easy to stop.
- **Guidance enables creative freedom.** Browser agents receive the semantic
  roles and safety context needed to compose coherently, without Bookhand
  prescribing one acceptable aesthetic.
- **Local-first.** No account or server is required to read, and everything
  the reader keeps lives on their device.
- **Prove one magical path before generalizing.** A delightful
  passage-to-artifact interaction matters more than a sprawling tool catalog.

## The daily study loop

The hackathon demonstration is complete. The target is now the owner's own
routine with technical books such as *Deep Learning with Python*, which today
means fighting publisher CSS until code is legible on a phone and copying pages
into a separate AI notebook to ask about them. Bookhand should make that
routine delightful:

1. The reader opens a technical book on their phone. Code, captions, callouts,
   and headings are legible in both themes, and the tutor offers to finish the
   job for this particular book's markup.
2. They ask about the passage in front of them, right there. The agent reads
   whole chapters when it needs them, searches the web when allowed, and
   remembers what this reader already understands and how they like to be
   taught.
3. The answer is as rich as the explanation deserves: prose, a runnable code
   walkthrough, an animation, an interactive diagram. The reader keeps what is
   worth keeping with one tap.
4. What they keep lives in the book: markings on the page, and the Notebook to
   browse it all. A later conversation, even with a different model, picks up
   the same understanding and the same voice.

If this beats copying pages into a chat window by a wide margin, Bookhand has
proved its thesis.
