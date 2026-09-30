# 05 — Technical-book readability

Status: needs-triage
Blocked by: none (may run in parallel with 02–04)

## Goal

Technical books read much better on a phone than the owner's hand-written
Readest CSS makes them, without the owner writing any CSS.

## Scope

- Compatibility handling for every book, in both themes: code listings keep
  their lines and scroll horizontally inside a legible monospace block;
  publisher colors adapt to dark mode (captions, callouts, sidebars, tinted
  backgrounds, dark text); a sane heading scale.
- The tutor's first-run offer for a book: detect fake headings from this
  book's actual markup and repair them, and re-highlight code in theme-aware
  colors. Uses the existing reading-style and section-remaster paths; every
  change stays visible and reversible.

## Reference

[Owner's CSS](../reference/owner-readest-dlwp-mobile.css), a floor, not a target.

## Done when

On *Deep Learning with Python* on the owner's phone, in light and dark themes,
code listings, captions, callouts, listing titles, and headings are clearly
better than the reference CSS, judged side by side by the owner. Add focused
fixtures for the general handling that do not include the copyrighted book.
