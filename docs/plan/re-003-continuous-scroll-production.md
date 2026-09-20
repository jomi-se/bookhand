# RE-003 production continuous scrolling

Status: completed on 2026-09-20; exact implementation candidate accepted for
local adoption.

## Mission

Ship continuous scrolling for reflowable EPUBs as a per-book reading
preference without weakening Bookhand's paginated reader, controlled-browser
security, or WebMCP grounding. The user chooses **Pages** or **Scroll** in Text
settings. Existing and newly imported books remain on Pages until changed.

The implementation uses the pinned MIT Foliate fork behind `ReaderAdapter`.
Bookhand owns a hard global window of at most eight mounted section frames in
Scroll mode. The window must load and retire sections in both directions while
keeping the visible words stationary. The former section-stream prototype is
not a product path.

## Scope inventory

| Capability | Required behavior | Proof surface |
| --- | --- | --- |
| Choice | Pages and Scroll are plain-language controls; Apply persists the choice per book | Text panel, reload |
| Compatibility | Missing stored flow data means Pages; Pages retains one same-origin frame and all existing navigation behavior | storage/unit and browser regressions |
| Continuous reading | Wheel/trackpad scrolling crosses reflowable EPUB spine boundaries without a blank, dead end, duplicate section, or visible jump | production browser artifact |
| Resource ownership | At most eight unique mounted section frames exist through long forward and backward runs; retired views release their section resources and listeners | browser instrumentation and transform scrutiny |
| Anchoring | Prepending or retiring content above the viewport compensates the scroll position so the same passage remains visible | browser range/text evidence |
| Reader truth | Location, visible context, passage resolution, annotations, links, TOC/search navigation, and remaster views use the document for the visible section | adapter and WebMCP browser flows |
| Security | Every section remains same-origin and publisher scripting, exfiltration, parent mutation, popup, and navigation attempts remain blocked | hostile EPUB production bundle |
| Host compatibility | The exact served asset works in the genuine Windows ChatGPT/Codex in-app browser with callable Site Tools | exact-asset Windows handoff |

## Non-goals

- Fixed-layout EPUB, PDF, TTS, media overlays, and publisher scripting.
- Automatic flow selection based on book contents.
- More than one configurable retention policy or adaptive memory tuning.
- Merging the disposable RE-003 query-parameter prototype.

## Implementation boundary

`ReaderStyle.readingFlow` is the durable product setting. `ReaderAdapter`
configures the renderer but does not expose frames to application or WebMCP
callers. The exact-source Vite transform keeps the accepted one-frame transport
for Pages and enables the fork's multi-view transport only for Scroll. One
renderer-owned window policy admits adjacent loads, evicts the opposite edge,
compensates removals above the viewport, and owns per-document listener
cleanup.

## Validation contracts

- [VAL-RE003-PREFERENCE](re-003-contract/VAL-RE003-PREFERENCE.md)
- [VAL-RE003-WINDOW](re-003-contract/VAL-RE003-WINDOW.md)
- [VAL-RE003-ANCHOR](re-003-contract/VAL-RE003-ANCHOR.md)
- [VAL-RE003-GROUNDING](re-003-contract/VAL-RE003-GROUNDING.md)
- [VAL-RE003-SECURITY](re-003-contract/VAL-RE003-SECURITY.md)
- [VAL-RE003-PAGINATION](re-003-contract/VAL-RE003-PAGINATION.md)
- [VAL-RE003-WINDOWS](re-003-contract/VAL-RE003-WINDOWS.md)

## Contract review

The first adversarial pass found three shortcut risks: counting fill-loop
iterations instead of resident frames, proving only forward eviction, and
checking location without checking the visible passage. The contracts require
an observed hard cap, forward and backward traversal, and exact visible
context-to-passage agreement.

The second pass found two compatibility gaps: old stored styles without a flow
field and a possible Scroll-only security exemption. The contracts make Pages
the default for absent data and require the existing hostile-EPUB oracle in
Scroll mode. This is a root-owned review because Bookhand's standing policy
keeps tightly coupled architectural judgement out of delegated workers.

## Merge gate

Do not merge until focused red-green coverage, full repository verification,
source/diff scrutiny, and genuine Windows exact-asset validation are green.
Merge locally to `main` only; do not push.

## Accepted evidence

Implementation commit `844a581` passed the full repository verification and
the focused RE-003, hostile-EPUB, RE-001 compatibility, and Pixel reader suites.
The genuine Windows in-app browser loaded JavaScript asset
`index-BDRWv4f6.js` and CSS asset `index-D7-rRr33.css` from that exact commit.

Native wheel traversal crossed many spine boundaries in both directions. The
mounted window rose to eight frames, remained at eight under paced and
aggressive input, and moved back to the book's opening sections without a blank
gap, visible jump, oscillation, dead end, focus loss, or scroll trap. Genuine
WebMCP reading context and passage resolution matched exactly, annotation
saving succeeded, original/rewritten view commands remained functional, and
returning to Pages restored one retained frame with working native navigation.
The Windows console had no warnings or errors.
