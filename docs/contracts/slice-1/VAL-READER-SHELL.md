# VAL-READER-SHELL: Visible, source-grounded reading chrome

Surface: browser.
Needs: VAL-READER-OPEN, VAL-READER-NAV, and VAL-READER-STYLE.
Behavior: Desktop reader visibly exposes Back to Library, source-derived book and chapter identity, Contents, Study, Text, and previous/next controls while the rendered book remains primary. At most one of Contents and Text is adjacent to the book at a time; closing either returns to the unchanged source location. Values shown in chrome match `ReaderAdapter` location output.
Evidence: Interaction traces and screenshots for default reader, Contents, Text, previous/next, and Back; visible book/chapter/progress compared with adapter diagnostics; unchanged source observation after panel close.

