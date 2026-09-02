# Tutor navigation: product and contract review

Date: 2026-09-02

Reviewer: Claude (parallel session), at the request of the concurrent Codex
session. Scope: a skeptical review of the transient tutor-navigation design —
origin-aware navigation, Back, Stop, manual takeover, source focus, and
return-to-where-I-was.

Sources read: `AGENTS.md`, `docs/product-north-star.md`,
`docs/plan/study-surface-and-tutor-layer-proposal.md`,
`docs/plan/polish-and-showcase-build-tasks.md` (W6 and W9), the four
`VAL-TUTOR-*` contracts, and their named dependencies (`VAL-RANGE-OWNERSHIP`,
`VAL-BOARD-VIEW-PARITY`, `VAL-MOBILE-PANELS`, `VAL-MOBILE-CHROME`,
`VAL-MOBILE-GESTURES`, `VAL-AGENT-ACTIVITY-PRESENTATION`, `VAL-SEARCH-BOOK`).

Grounded against the code at `92ab862` plus the in-flight W5 working tree. No
code or contracts were changed by this review.

## 1. Contradictions and missing states

### A. Reading-position persistence defeats "no storage writes" and "reload absence"

`useReader.onLocationChange` calls `schedulePersist()` on every relocate, and
Foliate's relocate fires identically whether the move came from a tap or from
`adapter.navigate`. So a `focus_passage` durably moves the learner's bookmark.
`VAL-TUTOR-PASSAGE-FOCUS`'s storage-spy evidence fails as literally written, and
"reload absence" is true only of the cue: reload lands the learner wherever the
agent left them, with no cue, no indicator, and no Back.

This is the largest hole in the design, and it is invisible in any trace that
only inspects annotations. Decide explicitly: either suppress the position write
while an agent-origin navigation owns the location (committing it on takeover),
or amend the contract to admit the position write as the one durable effect.
The first is truer to the North Star's "tutor cues are temporary … never
silently persisted."

### B. "Manual takeover" is undefined against the actual input paths

The real deliberate-navigation surface is seven paths: tap zones
(`onBookTap`), arrow keys, Foliate's internal swipe, TOC activation,
search-result activation, `goToSource` from Study, and anchor clicks inside the
EPUB document. Two are ambiguous by construction — activating a search result
the agent just cited, or a citation inside a lesson the agent just revealed, is
the learner *following* guidance, not overriding it.

The contract also never says what takeover does to the Back target. Losing
"return to where I was" to one accidental page turn is a bad outcome; so is an
indicator that lingers claiming to guide. Recommended rule, stated once:
user navigation clears the cue and marks the session **yielded**; the indicator
collapses to a single "Back to where you were" affordance that survives until
Back, Stop, book close, or new guidance.

### C. Origin is unobservable at the moment it matters

`navigate()` is async and the relocate arrives later. A page turn can interleave
between an agent navigation being issued and its relocate landing; "last caller
wins" attribution will mislabel it. The controller needs a correlation token,
not a mode flag. `VAL-TUTOR-SESSION-LIFECYCLE` says stale asynchronous work
"cannot resurrect" state but defines no result for *your navigation was
overtaken by the learner* — that needs a structured `superseded` outcome,
distinct from both success and rejection.

### D. Back's contract is thinner than the states it must cover

1. The prior CFI may no longer resolve — a style change re-paginated, or the
   section failed to load. That is neither "restored" nor `no_back_target` and
   needs its own truthful result.
2. "Prior location/panel" is not enough. `SurfaceState.panel` does not carry the
   board view, and `VAL-TUTOR-STUDY-REVEAL` requires restoring *visible*
   docked/expanded state while leaving the *stored preference* untouched. The
   contract calls two different things one thing.
3. `VAL-TUTOR-STUDY-REVEAL` restores focus "when still valid";
   `VAL-TUTOR-SESSION-LIFECYCLE` never mentions focus. They should agree, and
   focus belongs in the recorded prior state.

### E. The ten-entry stack and "one reliable Back target" are in tension

The tool schema is exactly `{action}` with no count, so the stack is reachable
only by repeated Back calls — and the indicator's Back button then pops hops the
learner has no visual model of. Ten entries buys little at W6 and costs a state
machine. Keep the cap in the store (nearly free), but make the visible Back
restore the **session origin**: where the learner was when guidance began. Then
`no_back_target` means exactly "guidance never moved you," which is a sentence a
person can understand.

### F. The indicator collides with receding chrome and with panel replacement

`useReaderChrome` hides `.reader-chrome` after 2.5s on touch and compact
surfaces. Back and Stop rendered there vanish 2.5 seconds after the agent moves
the reader — the precise opposite of "always offers Back and Stop." Separately,
on compact a panel *replaces* the book (`VAL-MOBILE-PANELS`), so an indicator
owned inside the reading surface disappears the moment `reveal_study_item` opens
Study. The indicator must be owned above the panel switch and exempt from
recession (or recession suspended while guidance is active). Neither is stated
anywhere.

### G. Transient-vs-durable overlay coexistence is a W6 blocker, not a detail

`ReaderScreen`'s annotation effect deletes and re-adds *every* mark whenever the
section or the mark set changes. If the transient cue shares that overlay path,
a mark re-render silently drops the cue, or the cue's add/remove drops a durable
highlight. This is the only part of the tutor layer that can damage user data,
and both `VAL-TUTOR-PASSAGE-FOCUS` ("restores every durable highlight at the
same CFI") and `VAL-RANGE-OWNERSHIP` rest on it. The spike must land in W6 as a
decided, tested seam — a separate cue layer with its own key namespace that
never touches the annotations layer — even though the cue itself ships in W9.

### H. Guidance arriving during book open is unhandled

`attach` restores the saved position asynchronously. A guidance navigation
arriving in that window races the restore — exactly the bug class W2 already
fixed for style, where `hydrate` yields to anything already committed. The same
rule needs stating here, or an agent's first move is silently undone by a
restore that finishes late.

### I. No agent-readable guidance state

Nothing reports whether guidance is active or what the Back target is;
`get_reading_context` omits it. An agent whose session the learner just stopped
discovers this only by having `present_explanation` rejected. Adding a small
`guidance` block to reading context is cheap, and is the main defense against
the agent itself being confused about whether it is still driving.

### J. `control_guidance`'s result shape conflates two verbs

"Structured prior/applied-state result" is ambiguous for Stop, which restores
nothing. Make them different: Back returns what it restored; Stop returns
`{cleared, wasActive}`. And write down explicitly that **Stop never navigates** —
implementations will otherwise differ, and a control named Stop that moves the
reader is the worst available outcome.

### K. Structural: `VAL-TUTOR-SESSION-LIFECYCLE` is not validatable inside W6 as scoped

Its evidence requires genuine WebMCP `control_guidance` calls with
active/no-target/idempotent results, but every action that can *start* a session
(`focus_passage`, `reveal_study_item`) is assigned to W9. W6 as written can only
ever demonstrate `no_back_target` and idempotent Stop. Either W6 borrows the
navigation half of `focus_passage`, or the lifecycle target is co-validated in
W9. The former is recommended below. This is a genuine inversion in the frozen
W4–W11 topology and belongs to whoever owns the manifest.

## 2. Smallest coherent W6 implementation boundary

In scope:

1. **One `NavigationController`** in `src/app/` that every deliberate move
   routes through — `ReaderScreen` taps and keys, TOC, search activation,
   `goToSource`, `ReaderCommands.navigateBook`, `reader-bridge` — carrying
   `origin: 'user' | 'agent'` plus a correlation token, with relocate events
   attributed through the token rather than a mode flag.
2. **Position-persistence gating.** Agent-origin navigation does not commit the
   saved reading position; takeover, Back, and Stop each define exactly when it
   does.
3. **`TutorSessionStore`** (non-persistent, `src/app/`): book id, book
   revision/epoch, session-origin location plus panel, board view and focus, hop
   stack capped at ten, active target, supersession counter. No cue, no
   explanation.
4. **The guidance indicator**, owned above the panel switch, exempt from chrome
   recession, present in both reader and panel compositions, attributed, with
   Back and Stop wired to commands.
5. **`control_guidance` and the navigation half of `focus_passage`** — move,
   record prior state, show the indicator — through commands *and* genuine
   WebMCP, which is what makes the lifecycle target testable. No cue, no
   highlight, no explanation.
6. **Lifecycle.** Manual navigation yields; book close, adapter detach, book
   change, and reload clear. Assert annotations, lessons, styles, and
   preferences unchanged throughout.
7. **The overlay spike, decided** — a cue layer proven independent of
   `renderAnnotations`, with a test that re-renders marks and shows the cue layer
   untouched, even though nothing draws into it yet.

Out of scope for W6: the cue itself, `present_explanation`,
`reveal_study_item`, reduced-motion pulse behaviour, temporary math.

## 3. Acceptance scenarios

1. **Agent moves, learner reloads.** Guidance navigates to a later section.
   Reload. The learner is at their *original* location, indicator absent,
   stored position unchanged. (Fails today — see A.)
2. **Interleaved page turn.** Guidance navigation is issued; the learner taps
   the next-page zone before it lands. The tool returns `superseded`, the
   session is yielded, the indicator shows only "Back to where you were," and
   the page is where the learner put it.
3. **Back after re-pagination.** Guidance moves the learner; the learner changes
   font size, then presses Back. Either the prior location resolves, or a
   truthful "couldn't return exactly" — never a silent success on the wrong page.
4. **Stop is inert.** Stop while guidance is active clears cue and indicator and
   moves the reader by zero pixels. Stop again with nothing active returns the
   same successful result and still does not move.
5. **Chrome recession.** At 412x915 with touch, guidance navigates; wait five
   seconds with no input. Back and Stop remain visible and keyboard-reachable.
6. **Panel replacement.** With guidance active, open Contents on compact. The
   indicator remains present and operable; closing Contents returns to the book
   with guidance intact.
7. **Highlight survival.** A durable highlight exists at CFI X. Guidance focuses
   X, then Stop. The highlight is still rendered, still stored, and a subsequent
   section change re-renders it correctly.
8. **Open race.** Issue guidance while the book is still opening. Either it is
   refused with a truthful reason, or it wins and the position restore does not
   overwrite it.
9. **Book close.** Guidance active, learner returns to the library. No writes;
   reopening shows no indicator and the learner's own saved position.
10. **Zero-effect audit.** A full guidance session under a storage spy: zero
    annotation, lesson, style, and preference writes, and — per A's resolution —
    zero position writes until the learner takes over.

## 4. Should wait for W9

The transient cue and its geometry; `present_explanation` and its hostile-input
corpus; `reveal_study_item` (it needs W7/W8 stable lesson IDs and headings, and
revealing into today's Study would validate against a composition that is about
to be replaced); reduced-motion pulse-versus-static behaviour; temporary math;
and multi-hop Back beyond the session origin. All are cheap once the controller
and session store are honest, and all are rework if built first.

The one item to move *earlier* — out of W9 and into W6 — is the navigation half
of `focus_passage`. Without it, `VAL-TUTOR-SESSION-LIFECYCLE` has nothing to
observe.
