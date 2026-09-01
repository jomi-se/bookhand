# VAL-READER-RESTORE: Restore book, position, and style

Surface: browser and data.
Needs: VAL-STORAGE-ROUNDTRIP, VAL-READER-NAV, and VAL-READER-STYLE.
Behavior: After meaningful navigation and style changes, reload and tab reopen restore the same book and source passage. Restored typography is applied before location initialization, and restoration is verified by section/quote rather than requiring an incidental visible-range CFI to equal the target CFI.
Evidence: Before/reload/after screenshots, database reading-state record, and browser trace across reload and tab reopen for default and changed typography.
