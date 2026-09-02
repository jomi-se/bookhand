# Polish and showcase mission

Last updated: 2026-09-01

## Objective

Elevate the working Slice 3 checkpoint into a trustworthy, excellent reader
and one compelling proof of model-composed study. Preserve the local-first,
useful-without-an-agent product boundary.

## Product boundary

- The library remains a calm, light, local catalog.
- The reader becomes a theme-coherent, immersive surface on mobile and a
  disciplined reading workspace on desktop.
- UI actions and WebMCP actions must produce the same visible, persisted domain
  state.
- Source-linked mutations must be verified against the current EPUB rather
  than trusted from caller input.
- The first rich learning artifact is rendered by trusted native code from a
  bounded declarative schema. Arbitrary generated JavaScript remains deferred.
- Lexical FTS retrieval precedes embeddings; it is sufficient for the first
  grounded whole-book showcase.

## Validation setup and owner prerequisite

Local automated evidence uses the production build on localhost, which is a
secure context:

```sh
npm install
npx playwright install chromium
npm run build
npm run test:e2e:built
```

Playwright resolves its pinned executable through
`chromium.executablePath()`; every evidence run records that path and browser
version. Genuine WebMCP tests launch it with
`--enable-features=WebMCPTesting`, as declared in
`tests/e2e/webmcp-agent.spec.ts`. Manual production-preview investigation uses
`npm run preview -- --host 127.0.0.1 --port 4173` and a fresh isolated browser
profile. Tests reset state with a new isolated context/profile, then allow the
application to seed the checksum-verified bundled book; imported/two-book
cases explicitly import their deterministic fixtures. No prior origin storage
may be reused as evidence.

Safe-area evidence uses a Chromium CDP session and
`Emulation.setSafeAreaInsetsOverride` with 24-pixel top and 20-pixel bottom
insets; this mechanism was smoke-tested against Playwright Chromium 151 on this
VM. Headless Chromium does not apply browser zoom through Ctrl-plus or the
profile zoom preference. Automated reflow evidence therefore halves the CSS
viewport width with `Emulation.setDeviceMetricsOverride` and is labeled a
reflow proxy. Completion additionally requires a manual headed Chrome or
Chromium observation at true 200-percent browser zoom; pinch/page-scale CDP
commands cannot satisfy it. If headed access is unavailable, that evidence is
a named blocked target, not silently replaced.

Evidence is preserved under the ignored
`artifacts/validation/polish/<commit>/` directory, with the commit hash,
`chromium.executablePath()`, browser version, commands, exit codes, screenshots,
traces, and full logs. Deployed evidence additionally records the URL, response
headers, deployed Git commit where available, and hashes of referenced built
assets so a later deployment cannot be mistaken for the reviewed build.

`VAL-HERO-MODEL-RUN` and the judged-surface portion of
`VAL-DEPLOYMENT-HEADERS` require the owner to provide access to a compatible
agent model inside the ChatGPT desktop browser. This is a known owner-only
prerequisite, not an automated substitute opportunity. If that access is
unavailable, those targets are blocked and the project may not claim final
judged-surface or real-model validation.

## Milestones

### P1: trust and evidence reset

Targets: the trust and evidence entries in the active target manifest below.

- Validate annotation and study sources by resolving their range, fingerprint,
  and normalized quote before mutation.
- Route reader style and board view through one observable state/persistence
  path shared by controls and tools.
- Reject cross-book study-item ID collisions and prevent implicit overwrite of
  user-created content.
- Call the durable-storage request from the real user-initiated import flow.
- Preserve inline math and useful figure alternatives in exact passages.
- Render mutation/storage errors rather than dropping rejected promises.
- Remove the unnecessary COOP header or record a replacement decision.
- Refresh stale source-of-truth documents and stabilize repeated full gates.

### P2: mobile reading reset

Targets: the mobile and desktop reader entries in the active target manifest.

- Propagate light, sepia, and dark theme tokens across the complete reader
  shell with accessible accent/focus colors.
- Replace space-reserving side rails and permanent mobile footer with
  reachable, receding navigation controls.
- Make the pagination gesture intentional: axis lock, threshold, selection
  protection, eased snap, reduced-motion behavior, and a reliable tap path.
- Treat Contents, Text, and Study as complete mobile surfaces with one header,
  correct focus lifecycle, and no hidden-book keyboard navigation.
- Expose current TOC state, stable accessible names, and 44-pixel targets.
- Add a mobile Playwright matrix for themes, geometry, names, focus, gestures,
  selection, and reduced motion.

### P3: grounded study showcase

Targets: the retrieval, study experience, and actual-model entries in the active
target manifest.

- Populate CFI-anchored chunks and FTS5 for bounded non-mutating `search_book`.
- Add a cohesive native study-experience schema and atomic command/tool.
- Add trusted math rendering and a declarative interactive-plot primitive.
- Persist source links, provenance, action grouping, and Undo.
- Build and polish the Chapter X slope-microscope flow, including a follow-up
  update to the same experience.
- Run one actual compatible model through the deployed tool surface and record
  the prompts, calls, visible result, failure handling, and reload result.

## Cut line

Do not cut exact source validation, shared observable mutations, mobile theme
coherence, source navigation, persistence, or Undo. If time tightens, cut in
this order:

1. embeddings and semantic fusion;
2. general plot vocabulary beyond the slope showcase;
3. broad manual editing for the new experience;
4. gesture flourish beyond a reliable thresholded snap.

Embeddings, semantic fusion, arbitrary generated applications, broad plot
vocabulary, and physical Pixel validation are explicit non-gates. Physical
Pixel evidence remains welcome but is an accepted open target under ADR 0003;
the required mobile evidence uses Chromium touch emulation and does not claim
to prove native Android long-press behavior.

## Active target manifest

Trust and persistence:

- `VAL-RANGE-OWNERSHIP`
- `VAL-MATH-PASSAGE`
- `VAL-STYLE-PARITY`
- `VAL-BOARD-VIEW-PARITY`
- `VAL-DURABLE-STORAGE-REQUEST`
- `VAL-STUDY-ID-OWNERSHIP`
- `VAL-ACTION-PROVENANCE-UNDO`
- `VAL-MUTATION-ERRORS`
- `VAL-DEPLOYMENT-HEADERS`

Reader quality:

- `VAL-MOBILE-THEME`
- `VAL-MOBILE-CHROME`
- `VAL-MOBILE-GESTURES`
- `VAL-MOBILE-PANELS`
- `VAL-MOBILE-ACCESSIBILITY`
- `VAL-DESKTOP-READER`
- Reactivated legacy assertions: `VAL-READER-STYLE`,
  `VAL-READER-RESPONSIVE`, `VAL-READER-ACCESSIBILITY`, and
  `VAL-READER-SELECTION`. The new contracts narrow implementation targets but
  do not weaken Preview/Cancel/Apply/Reset, 320-pixel, 200-percent zoom,
  selection, or source-anchor requirements.

Retrieval and showcase:

- `VAL-INDEX-LIFECYCLE`
- `VAL-SEARCH-BOOK`
- `VAL-STUDY-SCHEMA-SECURITY`
- `VAL-INTERACTIVE-PLOT`
- `VAL-STUDY-EXPERIENCE-LIFECYCLE`
- `VAL-HERO-MODEL-RUN`

Evidence:

- `VAL-GATE-STABILITY`
- `VAL-DEPLOYED-RUNTIME-TRUTH`
- `VAL-DOCUMENTATION-TRUTH`
- Reactivated `VAL-TEST-CONTROL-INTEGRITY` for every new fault seam.

## Completion

This mission is complete only when every target in the active manifest has
fresh independent evidence or a user-approved exception recorded in an ADR or
mission amendment that names the affected targets and evidence risk, the full
gate is stable, and the deployed Chapter X flow makes the WebMCP advantage
visible without relying on narration to explain it.
