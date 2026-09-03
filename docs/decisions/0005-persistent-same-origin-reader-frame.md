# ADR 0005: Keep one same-origin EPUB frame

## Status

Accepted on 2026-09-03 for the judged ChatGPT browser surface.

## Context

Foliate normally destroys its current section iframe and navigates a new one to
a generated `blob:` URL. ChatGPT Browser Use rejects that post-load subframe
navigation through its URL policy. The section never loads and Foliate has
already discarded the last visible frame. Ordinary Chromium does not enforce
that host policy, so normal Playwright coverage did not reproduce the defect.

Assigning the source through `srcdoc` was rejected: it changed Foliate's parsing
and navigation path globally and left the production reader blank.

## Decision

Bookhand applies a pinned, exact-match build transform to Foliate's paginator.
It loads `reader-frame.html` from Bookhand's own HTTPS origin once, fetches each
local section blob in the parent, parses it using its declared HTML or XHTML
MIME type, and replaces the existing frame's document element. Chapter changes
reuse the same iframe and Window; neither `blob:`, `data:`, nor `srcdoc`
navigation occurs.

The CSP permits Bookhand to frame only its own origin with
`frame-ancestors 'self'`. Packaged scripts remain blocked, and imported content
remains governed by the existing CSP and sanitizer boundaries.

## Consequences

- Foliate's paginator transport is a small compatibility fork tied to the
  pinned dependency source.
- Resource URLs remain Foliate-generated blobs and therefore continue to work
  offline.
- An upstream paginator change fails the build instead of silently restoring
  the blocked navigation.
- Updating Foliate requires revalidating persistent frame identity, XHTML,
  MathML, links, annotations, remasters, and hostile EPUB containment.

## Evidence

Focused production-bundle checks cover ordinary keyboard paging, offline
chapter navigation, hostile EPUB containment, remaster reload/reset, and a
forced Chapter X to XI to X tutor flow. The tutor test marks the iframe Window
before navigation and proves the same browsing context remains afterward.
