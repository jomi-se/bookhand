# ADR 0010: Adopt bounded multi-view continuous scrolling

## Status

Accepted on 2026-09-20 for reflowable EPUBs, subject to exact-asset Windows
validation before the implementation merges.

## Context

ADR 0005 kept one same-origin EPUB iframe because the judged ChatGPT browser
rejects Foliate's normal post-load `blob:` frame navigation. That remains the
right answer for paginated reading. It does not provide natural scrolling
across EPUB spine sections: a one-frame section stream stops at every boundary
and its document handoff visibly interrupts reading.

RE-003 compared Pages, one-frame section streaming, and the pinned MIT Foliate
fork's multi-view continuous strip. Exact-asset Windows in-app-browser testing
ranked continuous first. Native wheel input crossed spine boundaries without a
blank, jump, focus loss, WebMCP loss, or passage drift. Section streaming felt
worse than Pages. The spike also found a production blocker: the fork's
eight-section fill-loop limit was not a global resident-frame limit, and a
ninth iframe appeared after a few boundaries.

## Decision

Offer **Pages** and **Scroll** as a per-book reading preference. Pages remains
the default for new books and stored records without the preference.

- Pages retains ADR 0005's one same-origin iframe and Window across sections.
- Scroll may mount several same-origin `reader-frame.html` iframes so adjacent
  reflowable EPUB sections form one continuous strip.
- Bookhand owns one renderer-local bidirectional window with a hard maximum of
  eight mounted section frames. Admission evicts the opposite edge before a
  new frame is created, compensates actual post-removal scroll geometry, and
  does not let backward and forward preloaders refill each other's retired
  edge.
- The viewport centre identifies the primary section. Location, extraction,
  annotations, remasters, and WebMCP use the document for the visible section,
  never an assumed first mounted document.
- Each mounted document owns its input, link, and overlay listeners. Eviction
  aborts those listeners and releases the section resource.
- Every frame still loads Bookhand's same-origin shell. Publisher scripts,
  remote requests, nested browsing, storage access, and parent navigation
  remain blocked by the existing transform, sanitizer, and CSP policy.

Fixed-layout EPUB remains outside this decision. Choosing Scroll for such a
book falls back to its renderer's ordinary layout rather than forcing reflow.

## Consequences

- Frame identity is mode-specific: Pages promises one retained browsing
  context; Scroll promises a bounded set of same-origin contexts and truthful
  visible-section semantics.
- `ReaderAdapter` remains the application seam. UI and WebMCP callers learn one
  presentation field and no frame handles or renderer lifecycle methods.
- Updating the Foliate pin must re-derive the exact-source transform and prove
  the global frame cap, bidirectional anchoring, listener cleanup, containment,
  Pages compatibility, and genuine Windows Site Tool continuity.
- Continuous scrolling is production behavior only after the exact served
  candidate passes the merge gate in the RE-003 production plan.
