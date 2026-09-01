# VAL-READER-SELECTION: Stable exact text selection

Surface: browser.
Needs: VAL-READER-NAV and deterministic text fixture.
Behavior: Pointer, keyboard, and Pixel 7 touch selection expose the exact normalized quote, range/start/end CFIs, section index, and text fingerprint. Resolving the saved range in a fresh section document returns the same quote; fingerprint mismatch fails visibly instead of anchoring to unrelated text.
Evidence: Desktop browser interaction trace, adapter CFI round-trip tests, mismatch test, and physical Pixel 7 recording or screenshots for long-press/drag selection.
Fail: Pixel viewport emulation cannot satisfy the touch-selection portion.

