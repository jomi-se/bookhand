# Agent-facing design guidance plan

Last updated: 2026-09-02

## Problem

`DESIGN.md` is useful to repository agents, but Bookhand's real product agents
operate inside a browser and discover only the page's WebMCP tools. The current
tool surface explains mechanics—change text size, create a quotation, expand
Study—but does not expose the composition grammar that makes those operations
coherent. Calling the design document an embedded prompt is therefore not yet
a runtime-truthful claim.

The product needs to communicate enough design intelligence for an agent to
make good choices without turning taste into a permission system. Bookhand
should preserve semantic roles, accessibility, containment, source grounding,
and user control while allowing a person or agent to choose a radically
different palette, typography, shape language, or study composition.

## Selected shape

### 1. One compact read-only WebMCP tool

Add `get_design_context`, registered from the library onward. It accepts a
surface (`library`, `reader`, or `study`) and returns a bounded, versioned
runtime contract containing:

- dynamic state: active surface, viewport class, named/custom theme, current
  reading style, board view, and available mutation tools;
- supported semantic roles and native primitives, described by purpose rather
  than by the default terracotta values alone;
- the scope of each mutation, including the distinction between EPUB CSS,
  application-shell theming, and native Study rendering;
- four to six task-relevant invariants selected from the canonical design
  system, such as whole-world theming, reader-first space, source-first Study,
  contrast/focus, bounded generated work, and visible reversal;
- explicit freedom to replace the shipped aesthetic coherently; and
- the exact Preview, Apply, Cancel, Undo, Reset, Return to source, or Delete
  actions currently available.

The response stays below 6,000 UTF-16 code units, contains no book text or user
content, and never requires the agent to fetch a repository file or install a
skill. A small typed runtime manifest supplies stable guidance; live state is
composed into the response at call time. The version is
`sha256:<64-lowercase-hex>` over the exact UTF-8 bytes between the named
`bookhand:agent-design-context:start` and
`bookhand:agent-design-context:end` markers in `DESIGN.md`. Tests and validators
recompute that digest independently so matching hand-written constants cannot
hide guidance drift.

### 2. Short descriptions and version-aware expressive calls

Keep mutation-tool descriptions concise. `set_reading_style`,
`upsert_study_item`, and the planned `upsert_study_experience` tell the agent
when to call `get_design_context`, but do not repeat the entire design grammar.

Routine operations remain frictionless: selecting a shipped theme, increasing
type size, or adding one ordinary quotation does not require a handshake.
High-expression operations—custom EPUB CSS, a future custom semantic world, or
a multi-block study experience—include `designContextVersion`. A missing or
stale version produces a bounded refresh instruction before any mutation. The
version proves that current context was available; it does not certify taste or
constrain creative direction.

### 3. Observable design receipts

Design-bearing mutations return structured, human-readable receipts containing
the previous and applied state, where the change is visible, sanitizer or
validation warnings, provenance/action group, persistence state, and the exact
reversal action. Agent Activity records both design-context reads and mutations.
The ordinary UI exposes the matching Preview/Apply/Cancel and Undo/Reset/Delete
controls, so an agent never gains an invisible design path unavailable to the
person.

### 4. Native study surfaces consume semantic roles

Agents choose the learning structure and content through bounded study schemas;
Bookhand's native renderer supplies the active semantic theme, responsive
behavior, focus treatment, and reduced-motion behavior. The design context
explains the block vocabulary and source-first composition hierarchy, but does
not force every lesson into one visual template. Arbitrary caller CSS or
JavaScript cannot escape into the application shell.

## Implementation sequence

1. **Runtime context foundation:** add the typed, versioned guidance manifest,
   `get_design_context`, dynamic library/reader/study state, bounded output, and
   tool-description pointers. Make the call visible in Agent Activity.
2. **Presentation lifecycle:** extend the shared style path with truthful
   current/prior state, Preview/Apply/Cancel/Reset, sanitizer warnings,
   persistence, provenance, and Undo. Custom EPUB CSS carries the context
   version and remains EPUB-scoped.
3. **Study composition:** require the context version for the planned cohesive
   study-experience tool; render its declarative blocks through semantic roles
   and return source/provenance/reversal receipts.
4. **Whole-application worlds:** before implementation, record an ADR choosing
   the declarative semantic-token schema and its storage/security boundary.
   The supported path coordinates library, reader chrome, EPUB baseline,
   panels, Study, focus, selection, and errors with preview and reset. It does
   not accept raw parent-application CSS or JavaScript.
5. **Real-model proof:** the intent-only hero run must discover and call
   `get_design_context` before composing the experience; the user's prompt may
   not contain copied design instructions or tool payloads.

## Validation floor

- Inspect genuine `document.modelContext` names, descriptions, and serialized
  schemas at both library and open-reader states.
- Execute `get_design_context` through the genuine browser runtime; assert its
  version, size bound, required semantic content, dynamic state, and absence of
  book/user content.
- Reject stale context versions, unknown semantic roles, raw shell CSS/JS,
  URLs, prototype-shaped inputs, and invalid values atomically with no visible
  or persisted partial state.
- Exercise Preview, Apply, Cancel, Undo, Reset, reload, source-anchor
  preservation, and sanitizer warnings through both UI and WebMCP.
- Capture mobile and desktop screenshots across book, chrome, panels, Study,
  focus, error, and reduced-motion states; visual review checks harmony and
  hierarchy without treating the default palette as the only valid result.
- Preserve a real-model transcript showing design-context discovery, guided
  composition, visible result, reversal path, and reload.

## Boundaries

- No backend, account, harness-specific prompt installation, or Agent Connect
  dependency.
- Do not return all of `DESIGN.md` or `.impeccable/design.json` on every call.
- Do not create separate styling rules for each model vendor.
- Do not use design guidance to silently reject unconventional aesthetics.
- Do not claim full custom application worlds until their ADR, UI, persistence,
  and validation contract are implemented.
