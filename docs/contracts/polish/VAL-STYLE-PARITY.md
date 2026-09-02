# VAL-STYLE-PARITY: Observable and reversible reading style

Surface: UI and genuine WebMCP browser runtime.
Needs: `VAL-READER-STYLE`, secure production preview, and `WebMCPTesting`.
Behavior: UI Preview remains temporary, Cancel restores prior computed presentation, Apply persists, Reset restores the publisher baseline, and a tool style change immediately updates controls and computed EPUB/shell styles, returns prior state, survives reload, exposes its origin plus a user-visible Undo and Reset, preserves the source anchor, and cannot be overwritten by a later unrelated control change. Undo restores the returned prior style after reload-safe persistence.
Evidence: Paired UI/tool traces; control and computed-style assertions; anchor/quote before and after reflow; Preview/Cancel/Apply/Reset/reload; tool change then Undo; tool-then-unrelated-control race; invalid custom CSS rejection.
