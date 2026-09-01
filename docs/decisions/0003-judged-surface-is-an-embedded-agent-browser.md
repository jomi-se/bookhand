# ADR 0003: The judged surface is an embedded agent browser

## Status

Accepted on 2026-09-01 for The WebMCP Challenge submission, which closes
2026-09-03T20:00Z.

## Context

Slice 1 was planned with physical Pixel 7 readiness as a completion gate:
`VAL-DEVICE-PIXEL7` requires the full device flow plus the preserved storage
drills, and `docs/plan/slice-1-reader.md` states that physical Pixel 7 evidence
is required before Slice 1 can be called complete. ADR 0002 likewise leaves
Pixel 7 lifecycle and memory behavior as an explicit open validation item
against the chosen `opfs-sahpool` storage path.

That gate was written before the judged surface was known. A judge will reach
Bookhand through the WebMCP-capable agent environment the event expects — in
practice the ChatGPT in-app browser or an equivalent embedded agent browser —
not through a standalone Chrome on a specific Android handset. The Pixel 7 was
a proxy for "constrained mobile browser," and the real surface is now known
well enough that the proxy costs more than it proves.

Time is the binding constraint. `docs/architecture/implementation-defaults.md`
already directs a test suite proportional to a hackathon POC, and
`docs/plan/vertical-slice-build-order.md` places the first credible submission
checkpoint at Slice 3, where WebMCP actually drives the domain. Spending the
remaining budget on device drills would buy confidence in a surface no judge
uses, at the cost of the surface every judge uses.

## Decision

The primary judged surface is an embedded agent browser on a mobile-sized
viewport. Desktop Chromium remains the development and validation surface.

Physical Pixel 7 adaptation becomes best effort. `VAL-DEVICE-PIXEL7` is no
longer a Slice 1 completion gate; it is an opportunistic check that may be run
if the device is at hand and time allows, and its absence is recorded as an
accepted open target rather than a failure.

This is a reduction in *device drill regime*, not in mobile quality. An
embedded agent browser is a small, touch-driven viewport, frequently with
reduced chrome and unpredictable visual viewport behavior. Responsive layout,
touch targets, text selection ergonomics, and safe-area handling remain
first-class Slice 1 concerns and keep their contracts. What is cut is the
Android-native drill set — memory ceilings, background/resume, app-switch
lifecycle, and second-tab behavior on the handset — none of which a judge will
exercise.

## Amendment, 2026-09-01: the embedded browser is desktop-only

Checking the event and vendor documentation after this record was accepted
resolves where the embedded browser actually exists. OpenAI added WebMCP to the
**ChatGPT desktop app's built-in browser** and to ChatGPT Sites. The Android
ChatGPT app has no announced WebMCP surface, and the challenge resources name
only two testing surfaces: ChatGPT's in-app browser, or Chrome 149+ with
`chrome://flags/#enable-webmcp-testing`.

So the judged surface is a desktop-hosted embedded browser, not a mobile one.
This strengthens the decision above rather than reversing it — the Pixel 7 is
now confirmed to be a proxy for nothing a judge touches — but it corrects the
viewport assumption: the reader should be verified at a desktop window size
first, with the mobile layout kept correct because it is good work, not because
it is the judged geometry.

It also fixes where verification can happen. This VM is Linux ARM64: Google
ships no Chrome build for it, the only local browsers are Playwright's bundled
Chromium (WebMCP compiled in but not reachable through `--enable-features`),
and no system Chromium is installed. Real-runtime verification therefore
happens on the owner's desktop against the deployed bookhand.dev, not on this
machine and not over the tailnet to the phone.

`src/webmcp/model-context.ts` probes `document.modelContext` first, which the
current imperative API and ChatGPT's browser both use, and falls back to
`navigator.modelContext`, the shape Chrome's 146 preview exposed.

## Consequences

Storage carries a new risk that the Pixel 7 drills would have surfaced late and
that the embedded browser may surface immediately: an in-app browser may not
grant OPFS synchronous access handles, and it may partition or evict storage
more aggressively than a standalone browser. If `opfs-sahpool` is unavailable
there, the existing session-only in-memory fallback becomes the judged path,
and the library must still read as truthful rather than broken. That fallback
is already implemented and its storage mode is already surfaced in
diagnostics. Verify the real mode in the actual embedded browser early rather
than assuming persistence, and treat a session-only judged path as a
presentation problem to solve honestly, not a defect to hide.

Nothing in the storage architecture changes. ADR 0002 stands: the measured
desktop comparison chose the default, and this record only removes the phone as
a completion gate.

## Revisit if

The event clarifies that judging happens in a standalone mobile browser or on a
specific device; the embedded browser proves unable to run the reader at all,
making a native-browser fallback the judged path; or Bookhand outlives the
hackathon, at which point real device validation returns as a genuine
requirement rather than a proxy.
