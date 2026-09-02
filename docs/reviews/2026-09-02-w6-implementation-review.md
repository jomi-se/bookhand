# W6 embodied-tutor implementation review

Date: 2026-09-02

Reviewed tree: working tree based on `4780220`

Scope: `VAL-TUTOR-SESSION-LIFECYCLE`, `VAL-TUTOR-PASSAGE-FOCUS`, and
`VAL-TUTOR-OVERLAY-ISOLATION`

## Verdict

W6 is complete in the local tree and ready to commit. It establishes the
transient, learner-controlled navigation layer beneath the eventual visual
passage cue. It does not claim the W9 cue, temporary explanation, or Study
reveal work.

The implementation passed independent source scrutiny and independent testing
through the real Foliate browser surface. The final source blocker concerned
stalled-navigation recovery publishing a false location; recovery now rebuilds
the view at the last accepted CFI, suppresses recovery relocations, and releases
queued learner navigation without letting a retired tutor action regain
authority.

## Behavior now present

- `focus_passage` verifies book ownership, exact range, fingerprint, and quote
  before it may move the reader.
- `control_guidance` exposes Back and Stop with exact structured outcomes.
- One visible Tutor strip identifies agent movement and keeps Back and Stop
  available at compact widths.
- A newer valid focus supersedes an older one. Failed verification cannot
  cancel or overtake the currently valid request.
- Ordinary learner navigation yields guidance immediately. In-book links use
  the same serialized path as application navigation.
- Guidance captures one predictable origin rather than growing a hidden stack.
  Back restores that origin; Stop accepts the present location; both preserve
  style persistence.
- The persisted reading position remains anchored while guidance is active, so
  a reload does not leave an unexplained tutor trace.
- A temporary overlay has its own adapter key and lifecycle. It cannot replace,
  mutate, or delete a durable highlight at the same range.
- Test-only overlay controls and sentinels are absent from the production
  bundle.
- A stalled Foliate navigation is bounded. The reader view recovers at the last
  accepted CFI and a queued learner action can proceed.

## Independent browser evidence

The browser validation lane exercised genuine WebMCP registration and the real
EPUB renderer in desktop, compact, and production builds:

- focus-to-focus advanced guidance revisions `5 -> 6`;
- a visible EPUB link moved Chapter X section 18 to section 12 and yielded the
  tutor session before physical relocation completed;
- Stop cleared an active session and remained idempotent when repeated;
- a later focus and Back restored the captured origin;
- compact Back and Stop targets measured 44px and remained operable;
- same-range tutor and durable overlays coexisted, survived remount and style
  reflow, and clearing Tutor left durable geometry intact;
- production exposed no test sentinel or test-control global;
- console errors, page errors, failed requests, and off-origin requests were
  empty.

Ignored evidence is retained under `test-results/w6-user-testing-current/`,
including the machine-readable results, traces, and compact/desktop captures.

## Review history

The Impeccable pass initially found seven interaction and presentation defects:
focus arbitration, yielded-session persistence, hidden focused passages,
unguarded focus restoration, invisible Back failure, insufficient contrast,
and unbounded mobile copy. Each was fixed before the final validation run.

The final production browser gate caught one additional layout defect: when
the Tutor strip was hidden, grid auto-placement skipped it and assigned the
book to an `auto` row, collapsing the mobile reading surface to zero height.
Named root grid areas now keep chrome, guidance, book, and footer in stable
tracks whether guidance exists or not. Both the ordinary mobile tap-turn test
and the compact guidance test pass against that correction.

Independent scrutiny then found progressively narrower navigation races:
incidental relocation provenance, fixed-layout relocation identity, a stalled
view starving the queue, and recovery publishing text-start instead of the
accepted CFI. The final re-audit cleared the source-level blocker. The recovery
regression was subsequently strengthened to begin from section 1, stall a move
to section 0, recover silently at section 1, and allow the queued learner link
to be the only published move to section 0.

## Honest boundary

The geometric tutor cue used by browser tests is a harness-only sentinel. W6
proves ownership, temporality, navigation, recovery, and isolation; W9 still
owns the production passage cue and anchored teaching presentation. Likewise,
the diagnostic note that `navigate_book` rejects an arbitrary content-link
href is consistent with its documented table-of-contents-href contract; real
in-book link navigation succeeds through the reader's own path.

## Mechanical verification

- Focused adapter, guidance, command, and WebMCP suites: pass.
- Typecheck, lint, production build, and production bundle exclusion: pass.
- Full unit run: 320/321 passed while another worktree was running its own full
  suite; the sole miss was the unchanged 15-second real-book performance guard.
  Re-running that fixture alone immediately passed without changing its limit.
- Production Playwright suite and setup verification: pass.
- `git diff --check`: pass.
