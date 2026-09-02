# Proposed W6 contract amendment

Date: 2026-09-02

Author: Claude (clean review pass). **This is a proposal, not an amendment.**
No canonical contract, plan, code, or existing review was modified, and no W6
implementation was begun. Adopting any of this requires an edit to
`docs/contracts/polish/` by whoever owns the frozen topology.

Inputs: `docs/contracts/polish/VAL-TUTOR-PASSAGE-FOCUS.md`,
`docs/contracts/polish/VAL-TUTOR-SESSION-LIFECYCLE.md`,
`docs/reviews/2026-09-02-tutor-navigation-contract-review.md`, and
`docs/product-north-star.md`. Grounded against `useReader.ts`,
`ReaderScreen.tsx`, `useReaderChrome.ts`, `src/app/surface.ts`, and
`src/app/commands.ts` at `16233d0`.

## Why an amendment is needed at all

Two problems, one structural and one factual.

**Structural.** `VAL-TUTOR-SESSION-LIFECYCLE` is assigned to W6, but every
action that can *start* a session (`focus_passage`, `reveal_study_item`) is
assigned to W9. As scoped, W6 can only ever demonstrate `no_back_target` and an
idempotent Stop. The lifecycle target is not validatable inside its own wave.

**Factual.** Both contracts promise that guidance leaves no durable trace, and
the reader already contradicts that. `useReader.onLocationChange` schedules a
persist on every relocate, and Foliate's relocate fires identically for a tap
and for `adapter.navigate`. Guidance therefore moves the learner's saved reading
position, and a reload during guidance leaves them where the agent put them with
no cue, no indicator, and no way back. The North Star's rule — "tutor cues are
temporary, clearly attributed, easy to stop, and never silently persisted" — is
currently false for the one piece of state that matters most to a reader.

The proposal below splits `VAL-TUTOR-PASSAGE-FOCUS` at the seam that already
exists in it: *moving and recording* is navigation (W6), *drawing on the book*
is presentation (W9).

---

## Part A — Resolutions

### A1. Navigation origin

Origin is not a mode flag. `navigate()` is async and the relocate arrives later,
so a page turn can interleave between an agent navigation being issued and its
relocate landing; any "last caller wins" attribution mislabels that case.

**Proposed rule.** One `NavigationController` owns every deliberate move. Each
call is issued with a monotonically increasing token and an origin. A relocate
is attributed to the newest *unsettled* token, and a navigation settles when its
`adapter.navigate` promise resolves or rejects. If a `user`-origin navigation is
issued while an `agent`-origin navigation is unsettled, the agent navigation is
**superseded**: its token is retired, its relocate is discarded, and the session
yields.

The seven deliberate-navigation paths that must route through the controller,
enumerated so none is missed: `onBookTap`, the arrow-key handler, Foliate's
internal swipe (via its relocate, attributed as `user` when no token is
outstanding), TOC activation, search-result activation, `goToSource` from Study,
and `ReaderCommands.navigateBook`.

Anchor-clicks *inside* the EPUB document are explicitly out of scope for W6 —
they are the book navigating itself, not the person or the agent — and are
treated as `user` origin by the fallback rule above.

### A2. Back and Stop

The two verbs return different shapes, and only one of them moves the reader.

- **Back** restores the session origin: the location, panel, board view, and
  focus recorded when guidance began. It is not a per-hop pop. Results:
  `restored` (with the restored state), `no_back_target` (guidance never moved
  the learner — a *success*, not an error), or `unresolvable` (the recorded
  location no longer resolves; see A7). Back ends the session.
- **Stop** clears the session — indicator, cue, explanation, stack — and
  **never navigates**. It is idempotent: calling it with nothing active returns
  the same successful result. Returns `{cleared, wasActive}`.

Rationale for session-origin rather than the ten-entry stack: the tool schema is
exactly `{action}` with no count, so a stack is reachable only by repeated calls,
and the indicator's Back button would then pop hops the learner has no visual
model of. Keep the cap of ten entries in the store — it is nearly free and W9 may
want it — but W6 ships one visible Back whose meaning a person can predict.

### A3. Superseded actions

There is currently no structured result for *the learner overtook you*. Proposed
outcomes for any guidance action:

| Outcome | Meaning |
| --- | --- |
| `applied` | The action completed and guidance is active. |
| `superseded` | A newer guidance action or a user navigation overtook this one. Nothing is claimed. |
| `yielded` | The learner navigated; guidance released control and the Back affordance remains. |
| `rejected` | Input failed verification. Nothing changed; structured candidates or errors returned. |
| `unavailable` | No book open, adapter detached, or the book is still opening. |

Supersession is decided by the session's revision counter, not by wall time.
Stale asynchronous work compares its revision before touching state and returns
`superseded` when it loses.

### A4. Transient versus persistent indicators

Three distinct visible states, which the current contract collapses into one:

1. **Guiding** — an agent moved the reader and holds it. Attributed text, Back,
   Stop.
2. **Yielded** — the learner navigated during guidance. The attribution
   collapses to a single "Back to where you were" affordance, which survives
   until Back, Stop, book close, or new guidance. This state is what preserves
   reversibility after an accidental page turn, and it does not exist in the
   contract today.
3. **Absent** — no session.

**Ownership rules.** The indicator is owned above the panel switch, not inside
the reading surface, so it survives a panel replacing the book on compact
(`VAL-MOBILE-PANELS`). It is exempt from `useReaderChrome`'s 2.5-second
recession, or recession is suspended while a session is live — otherwise Back
and Stop disappear 2.5 seconds after the agent moves the reader, which is the
exact opposite of "always offers Back and Stop." It is not Study content, which
keeps `VAL-AGENT-ACTIVITY-PRESENTATION`'s absence assertion trivially true.

### A5. Persistence readiness

This is the substantive change, and it needs care because of how the writer is
built. `persistNow` writes one `ReadingState` record containing **both** location
and style, so suppressing the write during guidance would also suppress style
persistence.

**Proposed rule: anchor rather than suppress.** While a session is active, the
value used for persistence stays pinned to the session-origin location, while
the mounted reader shows the real one. Concretely, guidance updates the
displayed location and leaves the persisted anchor alone; style writes continue
normally; the unmount flush writes the anchor, so closing the tab mid-guidance
saves where the *learner* was.

The anchor is released — and the current location becomes the persisted one — at
exactly three moments: the learner navigates (takeover), Stop, or Back completes.
Reload during guidance therefore returns the learner to their own place, which
is what both contracts already claim and neither currently delivers.

**Proposed contract sentence:** *"A guidance navigation does not change the
persisted reading position. The persisted position remains the learner's until
they take control, Stop, or Back; at that moment the current position becomes
theirs and is written."*

### A6. Agent-readable focus state

Nothing today tells an agent whether guidance is active. An agent whose session
the learner just stopped discovers it only by having a later call rejected.

**Proposed rule.** `get_reading_context` gains a bounded `guidance` block:
`{ state: 'absent' | 'guiding' | 'yielded', canBack: boolean, revision: number }`.
No prior location, no CFI, no learner history — the agent needs to know whether
it is driving, not where the learner has been. `control_guidance` returns the
same block after acting, so an agent can act on one round trip.

### A7. Failure recovery

Four failure states the contracts do not name:

1. **Back's target no longer resolves** (re-pagination after a style change, or
   a section that fails to load). Return `unresolvable`, keep the reader where
   it is, tell the learner plainly, and end the session. Never a silent success
   on the wrong page.
2. **Guidance arrives while the book is still opening.** `attach` restores the
   saved position asynchronously; a guidance navigation in that window races the
   restore — the same bug class W2 already fixed for style. Return `unavailable`
   until the restore settles, or let guidance win and have the restore yield to
   it. Recommend the former for W6: it is one check, and it cannot lose.
3. **The adapter detaches or the book closes mid-action.** Session cleared,
   in-flight action returns `unavailable`, nothing written.
4. **A guidance navigation rejects** (bad CFI). Session unchanged, `rejected`
   returned with structured detail, no indicator shown — a failed move must not
   leave a "guiding" indicator claiming an agent is somewhere it never got to.

---

## Part B — Proposed contract text

Offered as replacement text for the manifest owner to accept, edit, or decline.

### B1. `VAL-TUTOR-SESSION-LIFECYCLE` (revised, W6)

> **Surface:** application navigation controller, command API, genuine WebMCP,
> reader and study UI, and browser.
> **Needs:** shared observable reader navigation and board state.
> **Behavior:** Every deliberate reader movement is issued through one
> controller carrying an origin and a settlement token; a relocate is attributed
> to the newest unsettled token, and a user navigation issued against an
> unsettled agent navigation supersedes it. One runtime-owned tutor session
> records current book, revision, one active target, the session-origin
> location, panel, board view and focus, and at most ten navigation entries. It
> is never persisted. **A guidance navigation does not change the persisted
> reading position; the persisted position remains the learner's until takeover,
> Stop, or Back, at which moment the current position becomes theirs and is
> written.** New guidance supersedes old state by revision; stale asynchronous
> work returns `superseded` and cannot resurrect it. A compact attributed
> indicator, owned above the panel switch and exempt from chrome recession,
> shows `guiding` with Back and Stop, or `yielded` with a single Back
> affordance. `control_guidance` accepts exactly `{ action: "back" | "stop" }`.
> Back restores the session-origin location, panel, board view, and focus and
> returns `restored`, `no_back_target`, or `unresolvable`; Stop never navigates,
> is idempotent, and clears cue, explanation, and stack. `get_reading_context`
> reports a bounded guidance state. Manual navigation, book close, adapter
> detach, and reload yield or clear control without changing annotations,
> lessons, styles, or preferences.
> **Evidence:** Serialized command/tool schema and genuine calls; structured
> `applied`/`superseded`/`yielded`/`rejected`/`unavailable` results; unit races
> for supersession, revision, interleaved user navigation, and the ten-entry
> cap; **persisted-position assertions across guidance, takeover, Stop, Back,
> and reload**; Back/Stop/manual-takeover/close/detach browser traces; storage
> write spy; preference and content snapshots; reload absence; indicator
> survival under chrome recession and panel replacement; mobile and
> reduced-motion behavior.

### B2. `VAL-TUTOR-PASSAGE-FOCUS` split

The current single contract mixes a navigation obligation with a rendering
obligation. Proposed split at that seam:

**`VAL-TUTOR-PASSAGE-FOCUS` (W6) — moving to an exact passage.**

> `focus_passage` accepts the current `bookId`, an exact verified range, and
> optional plain text of at most 1,000 UTF-16 code units. It atomically records
> the session-origin state, navigates, and reveals the exact target **without
> any annotation, storage, or persisted-position write**, and installs the
> attributed indicator. Rejection changes nothing and returns structured
> candidates or errors; a failed navigation leaves no indicator. Supersession,
> Back, Stop, takeover, and reload behave as in
> `VAL-TUTOR-SESSION-LIFECYCLE`.

**`VAL-TUTOR-PASSAGE-CUE` (W9) — drawing on the book.**

> The `underline | highlight | outline` cue, its geometry, the pulse-then-settle
> behavior, reduced-motion stable emphasis, and coexistence with every durable
> highlight at the same CFI. Needs `VAL-TUTOR-PASSAGE-FOCUS` and the overlay
> seam decided in W6.

**W6 still owns the overlay spike**, as a decided and tested seam: a cue layer
proven independent of `renderAnnotations`, with a test that re-renders marks and
shows the cue layer untouched, even though nothing draws into it yet. This is the
only part of the tutor layer that can damage user data, and deciding it late is
what makes it dangerous.

---

## Part C — Acceptance tests

Each is written to fail today.

1. **Reload during guidance.** Guidance navigates to a later section; reload.
   The learner is at their original location; no indicator; the stored position
   never changed. *(Fails today: `schedulePersist` writes the agent's position.)*
2. **Close the tab during guidance.** Same, via the unmount flush: the anchor is
   written, not the agent's position.
3. **Style persists during guidance.** Guidance is active; a style change is
   committed; reload. The style survives and the position is still the
   learner's. *(Guards against fixing test 1 by suppressing the whole write.)*
4. **Interleaved page turn.** Guidance navigation is issued; the learner taps
   next-page before it lands. The tool returns `superseded`, the session is
   `yielded`, the reader is where the learner put it, and the indicator shows
   only "Back to where you were."
5. **Takeover then Back.** Guidance moves the learner; the learner turns two
   pages; Back restores the session origin, not the previous hop.
6. **Back with no movement.** Start a session that never navigates; Back returns
   `no_back_target` as a success and the reader does not move.
7. **Back after re-pagination.** Guidance moves the learner; font size changes;
   Back returns either `restored` or `unresolvable` with a visible message —
   never a silent success on the wrong page.
8. **Stop is inert.** Stop while guiding clears the indicator and moves the
   reader zero pixels. Stop again with nothing active: same successful result,
   still no movement.
9. **Chrome recession.** At 412×915 with touch, guidance navigates; wait five
   seconds with no input. Back and Stop are still visible and keyboard-reachable.
10. **Panel replacement.** With guidance active, open Contents on compact. The
    indicator remains present and operable; closing returns to the book with
    guidance intact.
11. **Open race.** Issue guidance while the book is still opening: `unavailable`
    is returned, or guidance wins and the position restore does not overwrite it.
    One of the two, asserted.
12. **Failed navigation leaves no indicator.** `focus_passage` with an
    unresolvable CFI: `rejected`, no session, no indicator, nothing written.
13. **Agent can read its own state.** After the learner presses Stop,
    `get_reading_context` reports `state: 'absent'` and `canBack: false` before
    the agent's next call.
14. **Overlay seam.** With the cue layer present but empty, adding and removing a
    durable highlight re-renders every mark and leaves the cue layer untouched.
15. **Zero-effect audit.** A full session under a storage spy: zero annotation,
    lesson, style, preference, and position writes until the learner takes over.

---

## Part D — Questions that need José's decision

These are genuine forks, not implementation details. Each changes what gets
built.

1. **Does `focus_passage` move into W6?** `VAL-TUTOR-SESSION-LIFECYCLE` cannot
   be validated without an action that starts a session. Either its navigation
   half moves to W6 (my recommendation, and the basis of Part B), or the
   lifecycle target is co-validated in W9 and W6 delivers infrastructure with no
   contract of its own. Both are defensible; the topology is frozen, so this is
   yours.

2. **Anchor or admit?** Section A5 proposes that guidance never moves the
   persisted position. The alternative is to accept the write and amend both
   contracts to say the position is the one durable effect of guidance. Anchoring
   is truer to the North Star and costs one pinned value; admitting is zero work
   and makes "no trace on reload" a claim you cannot make. I recommend
   anchoring, but it is a product promise, not a technical call.

3. **Does a page turn end guidance or park it?** I propose `yielded` — the
   attribution collapses and a Back affordance survives. The stricter reading of
   "manual navigation yields control" is that the session ends outright and the
   indicator disappears. Stricter is simpler and more predictable; `yielded`
   preserves reversibility after an accidental tap. This is a taste call about
   what a learner expects.

4. **Is the ten-entry stack worth keeping at all?** The visible Back restores the
   session origin under this proposal, so the stack is dead weight until W9 —
   possibly forever, since the cut line already says "retain one reliable Back
   target." Keeping it costs a little; removing it means amending the contract's
   explicit cap.

5. **Where does the indicator physically live on compact?** Above the panel
   switch is settled by the reasoning; whether it is a top bar, a bottom bar, or
   a floating pill is a design decision that affects safe-area handling and the
   44-pixel target rules, and it should be made before the component is written
   rather than after.

6. **Given roughly one day to submission, is W6 the right next wave at all?**
   The judge-demo audit found that the highest-variance unknown is whether tools
   register at all in the ChatGPT Desktop browser on the deployed origin, and
   that the strongest truthful story available today needs neither W5 nor W6.
   This proposal is ready whenever W6 starts; it does not argue that W6 should
   start now.
