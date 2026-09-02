# Mission

Build a compelling proof that WebMCP can turn a normal ebook reader into a
creative, agent-driven study environment. The complete product thesis lives in
`product-north-star.md`; this file defines the present delivery boundary.

The baseline product is a genuinely usable local-first EPUB reader with
formatting, highlights, notes, navigation, and search. Its WebMCP surface gives
an agent precise semantics for understanding the current reading context and
for producing useful study artifacts in the page: explanations, worked
examples, diagrams, animations, mind maps, quizzes, and reversible formatting
changes.

## Success for the first demo

A judge can open the application, load the bundled hero book (currently a
placeholder calculus text), connect a compatible WebMCP agent, ask for help
understanding a passage, and watch the agent use book context in a teaching
sequence: first transiently finding and pointing to the exact source with
learner-controlled Back and Stop, then—when asked—building one coherent,
persistent study lesson. The demo must make the difference between browser
automation and a semantic WebMCP interface visible without requiring Agent
Connect or private infrastructure.

## Non-goals for the first demo

- A complete replacement for mature ebook readers.
- Cloud accounts, synchronization, collaboration, or a hosted model backend.
- A general-purpose agent UI framework.
- Production-grade execution of arbitrary generated applications.
- Agent Connect as a prerequisite for judging.
