# VAL-READER-NAV: Structural and relative navigation

Surface: browser.
Needs: VAL-READER-OPEN and nested-TOC fixture.
Behavior: Previous/next, nested table-of-contents, and direct CFI actions navigate to the expected source text; each relocation emits a serializable location with a navigable CFI, section index, chapter identity, progress, and diagnostic fingerprint. An invalid target names the failure and offers Retry and return-to-library; successful Retry reaches the requested source after the injected fault is removed.
Evidence: Browser interaction trace and screenshots for nested TOC, previous/next, direct CFI, injected invalid target, Retry, return, and expected source text; adapter contract output for serializability.
