# Embodied tutor layer review

Date: 2026-09-02

Code snapshot: `db6aa67` plus concurrent reader work

Status: product and architecture proposal; not implemented

## Judgment

The idea is not a flourish. It identifies the missing half of Bookhand's
agentic experience:

- **Study is durable knowledge the learner chooses to keep.**
- **Tutor guidance is temporary direction of attention during a live exchange.**

Bookhand already exposes enough grounded reading operations to make this
credible, but it does not have a transient attention/session layer. Using
permanent highlights as a pointing gesture would pollute the learner's library
and violate the product's reversibility principle.

Evidence tags in this document use **[CODE]**, **[CONTRACT]**, **[INFERENCE]**,
and **[PROPOSAL]** with the meanings defined in the accompanying study-surface
review.

## Existing foundation

- Reading context, selection, TOC, exact passages, CFI navigation, annotations,
  and study operations already cross the shared command boundary. **[CODE:
  `src/domain/reader.ts:105-132`, `src/app/commands.ts:193-220`]**
- `navigate_book` visibly moves the reader, and `get_passage` re-resolves a
  prior exact range. **[CODE: `src/webmcp/tools.ts:245-308`]**
- Source mutations verify book ownership, CFI resolution, fingerprint, and
  exact quote before writing. **[CODE: `src/app/commands.ts:293-310`]**
- Foliate can draw highlight, underline, and outline overlays, though Bookhand
  currently uses that path only for stored annotations. **[CODE:
  `src/reader/FoliateReaderAdapter.ts:264-354`,
  `src/reader/foliate-types.ts:65-76`]**
- Board `focus` and `close` are already transient and separate from stored
  `docked`/`expanded` preference. **[CODE: `src/app/surface.ts:17-85`,
  `src/app/commands.ts:454-506`]**
- The planned durable study experience already requires Return to source and a
  visible Back target. A tutor layer should share that navigation controller.
  **[CONTRACT: `docs/contracts/polish/VAL-STUDY-EXPERIENCE-LIFECYCLE.md`]**

## Missing product capability

There is no runtime tutor-session state, temporary passage cue, visible “Agent
is showing you…” state, Bookhand-owned navigation stack, item-specific reveal,
or Stop-guiding action. Board focus lands on the panel heading, not a requested
item. **[CODE: `src/app/reader-bridge.ts:8-32`,
`src/domain/reader.ts:105-132`, `src/study/StudyBoardPanel.tsx:69-72`]**

Navigation is also split: tool navigation calls the adapter through
`BookhandCommands`, while visible UI navigation calls `useReader.navigate`
directly. A reliable Back stack cannot be bolted onto only one path. **[CODE:
`src/app/commands.ts:217-220`, `src/reader/useReader.ts:215-223`]**

## Minimal page-owned vocabulary

These tools remain harness-neutral and keep Bookhand semantics in the page.

### `search_book`

Already contracted. It returns bounded exact ranges without moving the reader.
It finds the destination; it does not point. **[CONTRACT:
`docs/contracts/polish/VAL-SEARCH-BOOK.md`]**

### `focus_passage`

Inputs: current `bookId`, exact range, optional bounded plain-text message, and
one emphasis from `underline | highlight | outline`.

It should atomically verify the range, save current location/panel, navigate,
install one transient cue, and expose Back and Stop. A new call supersedes the
old cue. It creates no annotation and performs no storage write.

### `reveal_study_item`

Inputs: current-book item or experience ID. It opens Study transiently, scrolls
the target into view, gives its meaningful heading focus, and leaves the stored
docked/expanded preference alone. The cohesive experience ID should become the
primary target once that model exists.

### `present_explanation`

A small temporary source-anchored callout, limited initially to plain text and
strict validated display math. It composes with `focus_passage`. Rich diagrams
and interactivity belong in the durable study-experience model, not in transient
arbitrary HTML, CSS, JavaScript, URLs, or iframes.

### `control_guidance`

Input: `{ action: "back" | "stop" }`. Back restores the last Bookhand-saved
reader location and panel. Stop clears the cue, explanation, and guidance stack
without changing annotations, study content, or preferences.

**[PROPOSAL]** `focus_passage` and `present_explanation` could later converge as
`present_guidance`, but neither should overload `navigate_book`: ordinary
navigation and tutor-directed attention have different visibility,
reversibility, and lifecycle guarantees.

## Runtime shape

**[PROPOSAL]** Add a runtime-owned `TutorSessionStore`, analogous to
`SurfaceStore`, rather than React-local or SQLite state. Bound it to:

- current book and session revision;
- one active verified cue and optional sanitized message;
- target kind (`passage | study-item | study-experience`);
- prior location and prior panel;
- a bounded navigation stack, initially ten entries;
- a monotonic nonce that prevents stale asynchronous work from resurrecting an
  old cue.

Install it at the application composition root so UI and WebMCP commands share
the same truth. Clear it on book close, adapter detach, reload, Stop, or defined
user takeover. Route deliberate navigation through one controller with an
origin such as `user | agent | return-to-source | tutor-back`.

## Overlay coexistence risk

Foliate keys ordinary overlays by CFI. Drawing a temporary mark at the same CFI
can replace a durable annotation. **[CODE: `node_modules/foliate-js/view.js:368-389`]**

Before implementation, spike and choose one of:

1. a document-scoped CSS Highlight for transient ranges, with a stable
   non-animated fallback;
2. an adapter-owned uniquely keyed overlay mechanism;
3. controlled temporary replacement that proves restoration of every durable
   mark.

Do not depend on Foliate's private search prefix. It is an upstream detail and
would also blur tutor focus with actual search results.

## Interaction contract

- Show a calm, compact “Agent is showing you…” indicator with always-visible
  Back and Stop.
- Verify the exact range before navigation or display.
- A new guidance action supersedes the prior cue; stale calls cannot revive it.
- Manual navigation means the learner resumed control. Clear the cue and stack;
  do not fight the learner by moving them back later.
- Pulse briefly, then settle to a stable underline/outline. Skip the pulse under
  reduced motion.
- Do not guess reading time with an auto-dismiss timeout. Stop and subsequent
  guidance are reliable; reading speed is not.
- Treat the message as untrusted text. Render text/math nodes only.
- Reload proves that tutor state was never persisted.
- Log “Agent showed a passage” as a semantic event; raw tool names belong in
  diagnostics.

## Turn-based temporality

Turn-taking is not a blocker. One model turn can search, verify, navigate,
focus, reveal or present, then explain what the learner is seeing. What the
product cannot honestly claim is continuous awareness of gaze or reading
progress. Each new turn should read current state before choreographing the
next action. **[INFERENCE]**

The result is meaningfully closer to a person tutoring beside the reader: the
model can direct attention in the source, but Bookhand owns the visible state,
its limits, and the learner's way back.

## Required evidence

- Unit: range rejection changes nothing; no storage writes; bounded stack;
  supersession; idempotent Stop; stale-revision rejection; close/detach cleanup;
  permanent-highlight coexistence.
- Browser: exact cue geometry; visible Back/Stop; Back restores CFI and panel;
  manual-navigation takeover; reduced motion; mobile panel behavior; item
  reveal focus; reload clears all tutor UI; malicious messages remain inert.
- WebMCP: genuine `document.modelContext` registration and ordered multi-tool
  choreography with semantic tutor status and separate diagnostic records.
- Product: one real ChatGPT Desktop run that finds a passage, points to it,
  explains it, returns, and optionally saves a separate durable study artifact.
