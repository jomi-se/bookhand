# 02 — Artifacts

Status: needs-triage
Blocked by: 01

## Goal

An agent or the reader can make an artifact of any shape, anchored to passages,
a chapter, or the whole book, and revise it later without losing earlier
versions.

## Scope

- Delete the Study lesson and item model, tools, storage, and panel (no
  migration).
- Artifact domain and storage: anchors, source, title, author (reader or which
  agent), versions, dismissed state, delete.
- The ADR 0013 artifact frame, its bridge, and the smart building-block
  library (book quotation, math, highlighted code, plot and motion helpers,
  theme tokens).
- Reader-typed notes as artifacts.
- WebMCP tools to create, read, list, revise, and dismiss artifacts, with
  narrow schemas and guidance in the design context that invites any shape and
  style. Update `get_design_context` so it stops describing the five native
  blocks as the vocabulary.
- The surface chosen in 01.

## Done when

On the owner's phone, an agent answers a question about a *Deep Learning with
Python* passage with an interactive artifact; it survives reload; a second
conversation revises it; the previous version can be restored; Dismiss hides it
and it stays findable; Delete removes it. The artifact cannot reach Bookhand's
storage or any network origin outside the trusted list.
