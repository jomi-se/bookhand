# Reading-quality baseline

Status: active product-quality guide; not a feature-parity checklist or a
universal regression suite.

## Purpose

Readest is both a quality baseline for ordinary ebook reading and a deep source
of hard-earned lessons. Bookhand should feel at least as mature when reading a
reflowable EPUB, while choosing its own product features and building an
AI-elevated reading experience beyond that baseline.

The source investigation and behavior specifications capture years of useful
implementation patterns, edge cases, and failure modes so Bookhand does not
need to rediscover them. They do not authorize copying Readest application
code, tests, fixtures, comments, UI, or close structural translations. The MIT
Foliate fork remains the reusable renderer source; the Readest application is
AGPL research evidence only.

## Two quality layers

### Core reading quality

A mature reflowable-EPUB reader must feel dependable through these journeys:

- import, open, close, reopen, and exact position restoration;
- paginated movement within and across spine sections without blank gaps;
- continuous or section-stream scrolling whose boundary behavior has been
  chosen through direct experience rather than assumed;
- switching flow, viewport, orientation, typography, and theme without losing
  the visible passage;
- exact TOC, link, fragment, page-list, search, annotation, and citation
  navigation;
- keyboard, pointer, wheel, touch, selection, and focus behavior that produces
  one intended action;
- readable publisher CSS, tables, media, covers, delayed resources, malformed
  but recoverable content, and clear partial failure;
- stable selection, annotations, footnotes, and accessible exposure;
- correct logical behavior for LTR, RTL, and supported vertical writing; and
- bounded resources and responsive behavior through long reading sessions.

### Bookhand integration quality

Bookhand's own promise adds these journeys:

- the exact controlled ChatGPT desktop in-app browser retains genuine WebMCP
  operation and the required content-security boundaries;
- rendering, extraction, search, citations, annotations, and the personal copy
  agree about which book content is current;
- Tutor guidance is visible, stoppable, transient, and yields to the reader;
- Book Health explains issues plainly while giving agents precise evidence;
- repair work does not block or navigate ordinary reading;
- proposals are checked, previewed, accepted atomically, and recoverable;
- Undo, Redo, Restore, and Reset preserve coherent derived state; and
- a repaired personal copy can eventually leave Bookhand as a standalone EPUB.

## How a mission uses the baseline

Before changing reader behavior:

1. Identify the relevant journeys above.
2. Read the corresponding topical specification and its known footguns.
3. Consult the source investigation for the applicable Readest battle scars.
4. Decide which behavior Bookhand inherits from the Foliate fork, owns as
   product policy, implements independently, or deliberately rejects.
5. Add the smallest serious set of independently authored fixtures,
   instrumentation, and real-surface checks needed for that mission's risks.
6. Compare the resulting experience with the quality baseline, not with source
   shape or raw feature count.

Do not build a gigantic speculative corpus before improving the reader. Add
fixtures when they reproduce a named risk, protect a chosen behavior, or
measure a resource bound. A green self-authored test does not replace feeling
the interaction on the devices and controlled-browser surfaces that matter.

## Evidence boundaries

- VM Playwright provides deterministic contract evidence; genuine Windows
  in-app-browser validation is required for claims about that surface.
- Emulation does not establish physical-device touch or assistive-technology
  behavior.
- Readest source behavior is a lead and a warning, not Bookhand acceptance
  evidence.
- Common ecosystem ugliness belongs in general compatibility handling when a
  safe reusable behavior exists. Book-specific semantic damage belongs in Book
  Health and agent-assisted repair rather than an endless deterministic fixer.
- Reflowable EPUB is the active format. Fixed-layout EPUB is detectable but
  outside the current experience commitment; PDF, comics, TTS, and media
  overlays remain separate product decisions.

## Source map

- [Investigation narrative and exact source landmarks](../research/2026-09-17-readest-navigation-pagination-scrolling.md)
- [Reader-engine behavior specifications](reader-engine/README.md)
- [Candidate backlog and selection workflow](../plan/reader-engine-candidate-backlog.md)
- [Book Health and repair](book-health-and-repair.md)
- [Pinned-fork adoption decision](../decisions/0008-adopt-owner-foliate-fork.md)
- [Staged-repair decision](../decisions/0009-stage-book-repairs-outside-the-personal-copy.md)
