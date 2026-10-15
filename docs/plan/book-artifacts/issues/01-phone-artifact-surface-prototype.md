# 01 — Phone artifact surface prototype

Status: ready-for-human
Type: prototype

## Question

Where should an artifact appear while reading on a phone so that asking about a
passage feels delightful rather than like leaving the book?

- **Inline fold-out**: the artifact opens inside the reading column directly
  under the passage it concerns and folds away again. Most magical, hardest:
  the book lives in a contained reader frame and the artifact is generated
  code in its own frame (ADR 0013).
- **Bottom sheet**: the artifact rises over the book with the anchored passage
  still visible above it.

Also sketch two or three **marking** ideas (how a passage shows that an
artifact is attached, and how tapping it opens the artifact).

## Scope

Throwaway. Use one real generated interactive artifact about a real passage of
*Deep Learning with Python* (owner-supplied local copy; never commit the book).
Prove the ADR 0013 frame on the owner's phone browser in the same pass:
sandboxed opaque-origin frame, inline script, one trusted-CDN library, theme
tokens and reduced motion over `postMessage`.

## Done when

The owner has used both surfaces on their phone in Pages and Scroll mode,
picked one (or a hybrid), and picked a marking direction. Record the choice and
screenshots under an ignored artifact directory, and the decision in
[the spec](../spec.md).

## Prototype built (2026-09-29)

Status moves to **ready-for-human**: the owner reviews it on the phone.

What exists (throwaway, behind a flag):

- `public/artifact-frame.html` and `public/artifact-kit/` run generated
  artifacts in a sandboxed, opaque-origin frame with its own policy, served by
  `scripts/vite-artifact-frame-plugin.mjs` in dev and preview. KaTeX, d3,
  Rough.js, canvas-confetti, GSAP and highlight.js load from jsDelivr and
  cdnjs. Building blocks: `bh-quote`, `bh-math`, `bh-code`, `bh-scrub`,
  `bh-reveal`, `bh-steps`, `bh-choice`, `bh-callout`, `bh-margin`, plus
  `bh.tokens()`, `bh.spring()`, `bh.celebrate()`, `bh.remember()`.
- `src/prototype/` seeds *Calculus Made Easy* (no local copy of *Deep Learning
  with Python* was available) with ten artifacts, six memories, the tutor's
  voice, a rich conversation, a scripted "Ask about the ladder" flow that
  builds an artifact live, Keep (whole reply or a selected part), typed notes,
  and the Notebook.
- Surface: a bottom sheet that fits itself under the anchored passage, slides
  the page up when the passage is low, and spotlights it through the scrim.
  This is a hybrid of the two options in the question above.
- Markings: `wash`, `margin` and `pin` (`src/reader/markings.ts`), switchable
  in the Notebook's prototype settings; passages with several artifacts show a
  count and open a chooser. A tap on a marking wins over page-turn zones.

Run it: `npm run dev` (flag is on in development), or
`VITE_ARTIFACT_PROTOTYPE=1 npm run build && npx vite preview`. `?proto=off`
turns it off. Prototype state lives in this browser's `localStorage`, and the
Notebook's settings can reset it.

Evidence so far: Pixel 7 emulation in Chromium, Pages and Scroll, light and
dark; screenshots under `artifacts/proto/`. Still unproven: the owner's real
phone browser and an embedded agent browser.
