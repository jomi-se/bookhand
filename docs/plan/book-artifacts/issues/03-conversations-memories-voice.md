# 03 — Conversations, memories, and voice

Status: needs-triage
Blocked by: 02

## Goal

Conversations are rich and kept, anything in them can be kept as an artifact in
one tap, and future agents know the reader and speak in the voice they
developed together (ADR 0012).

## Scope

- Store conversations locally. Keep the opaque ACP session association
  separate from the displayed transcript, and retain the transcript when
  the gateway can no longer reopen the session.
- Render messages with the artifact renderer, including generated visuals.
  Tool activity appears as compact receipts. Keep raw payloads out of both
  live and restored conversation text.
- **Keep** on a message or a selected part of one creates an artifact
  immediately, locally, anchored to what the conversation concerned.
- A compact link in the conversation when an agent creates or revises an
  artifact.
- Memory domain and tools: agents write visibly and choose whether to ask
  first; the reader sees, edits, and deletes memories.
- Voice as a global memory with optional per-book notes, read by every agent
  before speaking (in-app Tutor system context and a WebMCP tool for external
  agents).
- Dismiss and Delete for conversations.

## Done when

The owner tells a tutor something personal about their understanding and their
opinion of the author, reloads, starts a new conversation with a different
model, and the new agent knows both and continues in a recognizably similar
voice. A kept message appears as an artifact without an agent round-trip. Gateway credentials remain outside the book database.
