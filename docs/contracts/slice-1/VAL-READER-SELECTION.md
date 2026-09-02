# VAL-READER-SELECTION: Stable exact text selection

Surface: browser.
Needs: VAL-READER-NAV and deterministic text fixture.
Behavior: Pointer and keyboard selection expose the exact normalized quote, range/start/end CFIs, section index, and text fingerprint. Resolving the saved range in a fresh section document returns the same quote; fingerprint mismatch fails visibly instead of anchoring to unrelated text. Physical Pixel 7 long-press/drag selection remains a best-effort open target under ADR 0003 rather than a completion gate.
Evidence: Desktop browser interaction trace, adapter CFI round-trip tests, mismatch test, and, when available, physical Pixel 7 recording or screenshots for long-press/drag selection. Touch emulation may validate layout and app gesture non-interference but must not be described as native Android long-press evidence.
