# VAL-READER-STYLE: Reversible reading presentation

Surface: browser.
Needs: VAL-READER-OPEN.
Behavior: Font size, measure, line height/spacing, and theme visibly reflow EPUB content without losing the source anchor or breaking images, equation alternatives, or selectable text. Custom CSS Preview does not persist, Cancel restores the prior computed presentation, Apply survives fresh reopen, invalid/disallowed CSS shows a bounded error, and Reset clears persisted custom CSS and restores the named publisher baseline in one action.
Evidence: Screenshots and computed reader-content styles before/after each control; anchor/quote observation across reflow; preview/cancel/apply/reopen/reset traces; real Chapter X image/alternative/selectability checks; invalid CSS error evidence.
