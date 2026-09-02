# VAL-MOBILE-ACCESSIBILITY: Named, reachable, stateful mobile controls

Surface: Chromium touch emulation and keyboard at 412 by 915 and 320 pixels.
Needs: `VAL-READER-ACCESSIBILITY`, `VAL-READER-RESPONSIVE`, and production preview.
Behavior: Every control has a stable accessible name; pointer targets are at least 44 by 44 CSS pixels; Contents exposes the current entry with `aria-current`; expanded panel state is programmatic; focus is visible; arrow keys on panel controls do not page the hidden book; semantic order remains usable at 200 percent zoom.
Evidence: Accessibility snapshots; target rectangles; current-section navigation trace; keyboard/focus trace; hidden-book location assertion; automated half-width reflow proxy plus a separately labeled manual headed-browser observation at true 200-percent zoom.
