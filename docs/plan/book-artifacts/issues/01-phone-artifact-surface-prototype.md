# 01 — Phone artifact surface prototype

Status: ready-for-agent
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
