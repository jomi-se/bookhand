# ADR 0005: Use stable EPUB frame transport in embedded agent browsers

## Status

Accepted on 2026-09-03 for the judged ChatGPT/Codex browser surface.

## Context

Foliate's paginator loads each EPUB section by assigning a generated `blob:`
URL to a newly created iframe. Ordinary Chromium permits this. The embedded
browser-control layer used for the judged surface rejects post-load blob
subframe navigation with `Page.navigationBlocked`. The section never announces
readiness; Bookhand reaches its ten-second deadline; and the old recovery path
discarded the active reader before proving its replacement was usable.

This breaks both hero paths. Applying a remastered section leaves the book
blank, and cross-chapter `focus_passage` turns a successful search into “The
reader is not ready for guidance yet,” followed by “No book is open.” A fresh
tab works only because the initial timing escapes the policy. That is not an
acceptable user workflow.

The Foliate dependency is pinned to commit
`78914aef4466eb960965702401634c2cb348e9b1`. The implementation defaults allow a
targeted Foliate fork once upstream blocks the hero flow; this is that evidence.

## Decision

Bookhand applies a narrow build-time compatibility transform to Foliate's
`View.load` in `scripts/vite-foliate-stable-frame-plugin.mjs`.

For generated blob section documents, the parent fetches the local blob text
and assigns it through `iframe.srcdoc`. Foliate still receives a genuine iframe
load event and runs its ordinary styling, measurement, pagination, relocation,
link, and overlay paths, but the browser is never asked to navigate a subframe
to the blob URL. Non-blob sources retain upstream behavior.

Both the response header and HTML policy allow `blob:` only for `connect-src`
so the parent may read its own generated document. No remote connection is
added. Existing script, frame, form, object, and external-resource containment
remains in force.

The transform matches two exact statements in the pinned paginator and fails
the build if either changes. This makes dependency drift visible instead of
silently restoring the forbidden navigation.

Navigation recovery also becomes prepare-then-swap: the previous adapter
session remains active until a connected replacement has opened, initialized,
and produced a readable view. A failed recovery no longer converts one
navigation failure into “No book is open.”

## Consequences

- Initial reading, chapter changes, search-result navigation, tutor focus, and
  fresh-tab rewrite hydration all use `srcdoc` for EPUB section documents.
- Original/Rewritten switching remains an even cheaper in-place body refresh;
  it does not ask Foliate to load a section at all.
- EPUB content is parsed by the iframe's HTML `srcdoc` path rather than by a
  navigation whose response MIME type may be XHTML. The bundled calculus book,
  native MathML, CFI source verification, figures, and hostile containment
  corpus are regression-tested on the production bundle.
- This is intentionally a small compatibility fork, not a generalized Foliate
  vendor copy. Updating Foliate requires consciously revalidating the transform.

## Evidence

- A forced cross-chapter guidance flow moves Chapter X → Chapter XI → Chapter X,
  applies the verified transient cue, and preserves Back, Stop, and annotations.
- The production remaster and Search flows pass with the stable transport.
- The hostile EPUB cannot script, exfiltrate, navigate the top page, open a
  popup, or erase readable content; fully offline reading and navigation pass.

## Revisit if

Foliate exposes a supported document-input transport that does not navigate a
subframe to a blob URL; the embedded browser permits same-origin blob subframe
navigation; or `srcdoc` proves incompatible with a representative imported EPUB.
