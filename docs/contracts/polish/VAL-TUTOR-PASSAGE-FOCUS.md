# VAL-TUTOR-PASSAGE-FOCUS: An agent can point at an exact passage

Surface: command API, reader adapter, genuine WebMCP, and browser.
Needs: `VAL-TUTOR-SESSION-LIFECYCLE`, `VAL-RANGE-OWNERSHIP`, and `VAL-SEARCH-BOOK`.
Behavior: `focus_passage` accepts the current `bookId`, an exact verified range, optional plain text of at most 1,000 UTF-16 code units, and `underline|highlight|outline`. It atomically saves the prior state, navigates, reveals the exact target, and installs one transient cue without annotation or storage writes. The cue briefly pulses then settles, or uses stable emphasis under reduced motion. It coexists with and restores every durable highlight at the same CFI. Rejection changes nothing and returns structured candidates/errors.
Evidence: Genuine search-to-focus tool trace; exact cue geometry and message; wrong-book/stale-range rejection; storage spy; same-CFI durable-highlight coexistence; supersession; reduced motion; Back/Stop; reload absence.
