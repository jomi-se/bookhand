# Study surface code review

Date: 2026-09-02

Code snapshot: `db6aa67` plus concurrent, uncommitted work in `src/App.tsx`,
`src/app/presentation.ts`, `src/app/surface.ts`, `src/reader/ReaderScreen.tsx`, and
`tests/unit/presentation.test.ts`

Live evidence: owner review from the deployed ChatGPT Desktop experience

Scope: review only; no product code or pre-existing plan was changed

## Evidence notation

- **[LIVE-USER]** Direct observation supplied by the owner from the deployed app.
- **[CODE]** Behavior established by the code at the snapshot above.
- **[CONTRACT]** Behavior already required or proposed by a repository contract.
- **[INFERENCE]** Product judgment derived from two or more cited facts.
- **[PROPOSAL]** A recommendation, not an accepted implementation decision.

## Executive judgment

The review is correct: the study board's data model is materially stronger than
its presentation, but the main defect is not CSS. Independent study rows are
being presented as independent cards, even when an agent intended them to form
one lesson. Storage hierarchy has become visual hierarchy. **[LIVE-USER]
[CODE: `src/study/StudyBoardPanel.tsx:204-220`,
`src/domain/study.ts:54-71`]**

The redesign should preserve the existing restraint, source verification,
provenance, questions, Undo, and Delete. It should add one first-class authored
unit: a titled, ordered, source-grounded study experience. The runtime design
prompt cannot make a flat schema render a coherent lesson; the capability has
to exist in the model, command, tool, and renderer. **[INFERENCE]
[CODE: `src/webmcp/design-context.ts:201-233`]
[CONTRACT: `docs/contracts/polish/VAL-STUDY-EXPERIENCE-LIFECYCLE.md`]**

This pass used Impeccable's hierarchy, responsive-composition, theming, and
interaction heuristics. It is not a formal scored Impeccable critique: the
target was changing concurrently, so a stable two-pass visual score would
pretend to be more reproducible than it is.

## Findings

### P0 — a lesson is not a product object

The panel maps a flat `StudyItem[]` directly to cards. A study item has an
optional `actionGroupId`, but no lesson identity, title, shared citation, group
metadata, or child relationship. SQLite likewise stores independent rows.
**[CODE: `src/study/StudyBoardPanel.tsx:204-220`,
`src/domain/study.ts:54-71`, `src/storage/schema.ts:50-65`]**

The WebMCP description currently says a shared `actionGroupId` lets a person
undo lesson blocks together, but the visible Undo path names one item and one
revision. The command and repository also undo one item. This is a contract bug,
not only a composition weakness. **[CODE: `src/webmcp/tools.ts:437-440`,
`src/reader/ReaderScreen.tsx:325-329`, `src/app/commands.ts:439-442`,
`src/storage/library-repository.ts:509-560`]**

**[PROPOSAL]** Add `StudyExperience`: title, ordered bounded native blocks,
shared source references, provenance, one atomic action boundary, and an
explicit relationship to annotations. Keep `StudyItem` for truly standalone
notes. Do not use `actionGroupId` as a substitute for presentation hierarchy.

### P0 — observability is embedded in the wrong product surface

Agent Activity is inserted before authoring controls and content. It always
shows connection state and, when present, every raw tool name and summary. The
store retains up to twenty calls and CSS permits a 180-pixel log before its
other controls. Existing E2E coverage makes this noisy form the expected
behavior. **[LIVE-USER] [CODE: `src/study/StudyBoardPanel.tsx:94-105`,
`src/webmcp/AgentActivity.tsx:27-60`,
`src/webmcp/useWebMcpTools.ts:25-39`, `src/study/study.css:280-339`,
`tests/e2e/webmcp-agent.spec.ts:164-172`]**

**[PROPOSAL]** Remove tool logs and general agent observability from Study.
Place identifiers, timestamps, calls, and diagnostics in a separate activity or
developer surface. Study may show only a compact, semantic tutoring-status
indicator while guidance is active, with Back and Stop. Learning transparency
should explain and control the live teaching state, not expose protocol plumbing.

### P1 — equations are rendered as code by design

The domain accepts only an opaque expression string. The renderer places it in
`<pre>`, and CSS gives it monospace code styling. No format contract distinguishes
TeX from plain text, and tests stop at payload conversion. Raw TeX is therefore
the specified result of the current implementation. **[LIVE-USER]
[CODE: `src/domain/study.ts:37-42`, `src/study/StudyItemCard.tsx:23-29`,
`src/study/study.css:177-190`, `src/webmcp/tools.ts:443-446`,
`tests/unit/webmcp-tools.test.ts:223-246`]**

**[PROPOSAL]** Make the format explicit, initially `tex` with a bounded `plain`
fallback. Render with strict, trust-disabled math output, centered display
geometry, secondary captions, accessible source text, and a visible parse-error
fallback. Never accept arbitrary HTML, URLs, or TeX features that can introduce
them.

### P1 — source grounding is strong but source presentation is repetitive

Each block independently owns a source range and arbitrary label, so every
card repeats a Return-to-source control among Undo and Delete. The visible
label is truncated to 22 characters, although its full value survives in the
title attribute. This is visual noise, not current data loss. **[LIVE-USER]
[CODE: `src/domain/study.ts:65-69`, `src/study/StudyItemCard.tsx:71-110`,
`src/study/study.css:142-149`, `src/webmcp/tools.ts:459`]**

**[PROPOSAL]** Put a compact, structured source chip on the experience header;
show block-level sources only when they differ. Derive chapter/figure labels
from resolved context rather than treating agent-written display strings as
source metadata.

### P1 — quotation and highlight are distinct records without a relationship

A quotation is a complete study item, while a highlight is an annotation with
another complete quote. The board renders the whole study stream and then the
whole highlight stream; both use serif/accent-rule treatments. Duplication is a
structural consequence. **[LIVE-USER] [CODE: `src/domain/study.ts:8-19,37-40`,
`src/study/StudyBoardPanel.tsx:204-251`, `src/study/study.css:157-175,222-246`]**

**[PROPOSAL]** Keep their purposes distinct: a highlight is an annotation and
source index; a quotation is authored teaching content. Add a reference
relationship so a lesson can cite an existing highlight without copying it.
Make Highlights a compact index/filter outside the lesson stream.

### P2 — storage labels outrank teaching hierarchy

Every block visibly begins with `prose`, `quotation`, `equation`, `steps`, or
`question`, while no lesson title exists above the sequence. The interface
therefore explains its database before it explains the idea. **[LIVE-USER]
[CODE: `src/study/StudyItemCard.tsx:59-69`, `src/study/study.css:76-89`,
`src/storage/library-repository.ts:260-275`]**

**[PROPOSAL]** Hide obvious type names in ordinary reading mode while retaining
semantic markup and optional authoring metadata. Let lesson title, section
headings, sequence, and the question/reveal interaction carry hierarchy.

### P2 — expanded changes allocation, not composition

Expanded mode enlarges the same single panel DOM and narrows the book. At the
mobile breakpoint it still becomes the same one-surface layout. The E2E test
asserts the mode attribute, not a meaningfully different workspace.
**[LIVE-USER] [CODE: `src/study/StudyBoardPanel.tsx:74-254`,
`src/study/study.css:10-20,274-278`,
`tests/e2e/webmcp-agent.spec.ts:362-369`]**

**[PROPOSAL]** Docked mode should be a concise companion. Expanded mode should
be a study workspace with centered lesson measure and, when useful, a lesson
contents rail, compact annotations rail, and source preview. On a
phone, “expanded” should mean focused study, not a squeezed desktop grid.

## Source-fidelity correction and remaining risks

The supplied extraction diagnosis was correct for the earlier implementation,
but it is partly stale against current code. Commit `9ecae14` replaced
`Range.toString()` passage extraction with semantic serialization. The current
path prefers `data-tex`, MathML `alttext` or TeX annotation, image alternatives,
and SVG title/description, and it is used for selected/exact passages.
**[CODE: `src/reader/text.ts:22-83,149-180`,
`src/reader/FoliateReaderAdapter.ts:154-224,495-513`]**

That fixes new extraction, not every downstream problem:

- Existing damaged annotations and study payloads are not migrated; they have
  no extraction version or canonical excerpt record. A changed fingerprint can
  also make a later note edit reject an old annotation as stale. **[CODE:
  `src/domain/study.ts:8-19,54-72`, `src/storage/schema.ts:28-64`,
  `src/reader/ReaderScreen.tsx:337-345`]**
- A source-linked quotation verifies the independent `sourceQuote` but stores
  the separately supplied quotation payload unchanged. A correct source claim
  can therefore accompany a damaged or invented quotation. **[CODE:
  `src/app/commands.ts:359-403`, `src/webmcp/tools.ts:417-484`]**
- Figure-only ranges can serialize image meaning before their CFIs are narrowed
  to caption text; a genuine Foliate round trip needs to prove the same excerpt
  re-resolves. **[CODE: `src/reader/text.ts:125-180`,
  `src/reader/FoliateReaderAdapter.ts:180-199`]**
- Visible-context gating still checks raw `Range.toString()` first, so an
  image-only viewport may be treated as empty and expanded to the whole
  section. **[CODE: `src/reader/FoliateReaderAdapter.ts:154-167`]**
- MathML fallback does not consult `aria-label`, although one EPUB fixture uses
  it. **[CODE: `src/reader/text.ts:50-55`,
  `scripts/generate-epub-fixtures.mjs:103-105`]**

**[PROPOSAL]** Converge on a versioned, typed `SourceExcerpt`: immutable book
identity, exact range, extraction version, canonical accessible plain text, and
bounded text/math/figure segments. Source-derived quotations should derive from
that canonical excerpt; paraphrases should be prose. Do not persist renderable
raw XHTML merely to preserve fidelity—it creates a much larger sanitization,
resource, and execution boundary.

## Visual grammar to preserve and extend

- Prose: quiet body text; no loud storage-type label.
- Quotation: serif text, restrained accent rule, attribution/source beneath.
- Equation: strict typeset math, centered on a subtly raised surface; secondary
  caption and accessible plain-text fallback.
- Steps: aligned markers and larger inter-step rhythm.
- Question: contained prompt with a clear native reveal control.
- Highlights: compact annotation index/filter, not a duplicate document stream.
- Agent activity: absent from Study; a separate diagnostics surface owns it.

Existing prose restraint, quotation treatment, ordered steps, native
`<details>` answer reveal, verified source claims, visible provenance, and
per-item Undo/Delete are strong foundations and should survive the redesign.
**[CODE: `src/study/StudyItemCard.tsx:11-53`,
`src/app/commands.ts:293-310,359-428`]**

## Validation additions

Before calling this fixed, prove:

1. a lesson is atomic, ordered, titled, source-grounded, and undoable as one
   user-visible action;
2. the first mobile and desktop study viewport begins with learning content,
   while failures remain immediately discoverable;
3. TeX renders accessibly and malformed/hostile input falls back safely;
4. Chapter XIX Fig. 52 preserves `AB`, `x`, `P`, `Q`, `OM=x_1`, `PM=y_1`, the figure
   description, and caption through selection, tool read, persistence, reload,
   and search;
5. an exact `sourceQuote` plus an invented quotation payload is rejected or
   canonicalized;
6. figure-only CFI ranges round-trip through real Foliate;
7. old damaged records receive either deterministic repair or a visible
   stale-source state without changing user-authored prose;
8. docked and expanded modes have measurably different information
   architecture at desktop sizes and correct replacement behavior on mobile.
