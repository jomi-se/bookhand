# VAL-TUTOR-STUDY-REVEAL: Guidance can reveal durable study content

Surface: study renderer, tutor controller, genuine WebMCP, and browser.
Needs: `VAL-TUTOR-SESSION-LIFECYCLE` and `VAL-STUDY-COMPOSITION-HIERARCHY`.
Behavior: `reveal_study_item` accepts a current-book lesson or standalone-item ID, opens Study transiently without changing the stored docked/expanded preference, scrolls the exact target into view, and focuses its meaningful heading. Back restores the prior panel/location/focus when still valid; Stop clears guidance but leaves the revealed durable content unchanged. Missing, cross-book, or stale targets change nothing and return structured failure.
Evidence: Genuine calls for lesson and standalone item; geometry, scroll, heading focus, Back/Stop, stored-preference, missing/cross-book, mobile replacement, and reload traces.
