# VAL-BOARD-VIEW-PARITY: Observable study view state

Surface: UI and genuine WebMCP browser runtime.
Needs: persistent Slice 2 board views, secure production preview, and `WebMCPTesting`.
Behavior: UI and tool changes support `docked`, `expanded`, `focus`, and `close` as promised by the architecture. Docked/expanded are persistent layout preferences; focus opens the board and moves focus to its primary heading without changing the preference; close returns to the book without deleting content or changing the preference. Every mode immediately updates the mounted interface, returns prior persistent/visible state, offers user-visible Undo for a tool-originated persistent layout change, preserves reader location, and cannot be overwritten by stale interface state. Undo restores the prior persistent/visible state.
Evidence: Paired UI/tool geometry, focus, visible-state, and preference traces for all four modes; tool results; docked/expanded reload restoration and Undo; reader location before/after; close-without-delete; tool-then-UI race regression.
