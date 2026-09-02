# VAL-RANGE-OWNERSHIP: Exact current-book mutation sources

Surface: command API and genuine WebMCP browser runtime.
Needs: `VAL-READER-SELECTION`, `VAL-READER-ADAPTER-CONTRACT`, a secure production preview, and `WebMCPTesting`.
Behavior: Every source-linked mutation requires the open `bookId`, start/end CFI, fingerprint, and quote; resolves that range against the open book; and compares quote text after exactly this normalization: Unicode NFC, CRLF/CR to LF, every run of ASCII whitespace or Unicode category `Zs` to one U+0020 space, then trim. Case, punctuation, zero-width characters, math symbols, and all other code points remain significant. Wrong-book, stale CFI, stale fingerprint, partial quote, invented quote, and invented-math inputs are rejected without changing storage, overlays, or mounted UI.
Evidence: Unit normalization cases; genuine `document.modelContext` valid and invalid calls; before/after storage counts, overlay geometry, and UI state for every rejection class.
