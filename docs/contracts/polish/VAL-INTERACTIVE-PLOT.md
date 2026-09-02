# VAL-INTERACTIVE-PLOT: Accessible declarative plot interaction

Surface: desktop and mobile production browser.
Needs: `VAL-STUDY-SCHEMA-SECURITY`, `VAL-MOBILE-THEME`, and `VAL-DESKTOP-READER`.
Behavior: Validated model-supplied bounded data or whitelisted math AST plus parameters determine the curve, points, secant/tangent, labels, and readouts; pointer, touch, and keyboard controls update them consistently; a textual equivalent exposes current values; Reset restores the model-supplied initial state without undoing creation; themes and reduced motion apply; targets meet 44 pixels on mobile.
Evidence: Frozen `tests/fixtures/study-experience/slope.json` and `non-slope.json` supply exact initial/reset state, keyboard steps, sample inputs, expected readouts, and absolute/relative tolerances; assertions run across pointer/touch/keyboard with an accessible text snapshot, Reset trace, theme/mobile/desktop screenshots, reduced-motion behavior, and target measurements.
