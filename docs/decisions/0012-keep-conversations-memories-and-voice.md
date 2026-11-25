# ADR 0012: Keep conversations, memories, and the tutor's voice

## Status

Accepted on 2026-09-29 by the owner, after the study and tutor direction
review recorded in [the book artifacts spec](../plan/book-artifacts/spec.md).

## Context

Earlier tutoring was transient. Only a tab-local pointer could reopen the
last conversation.
Those choices protected a judged demo and limited credential risk; they also
meant every reload, provider change, or new conversation lost what the tutor
had learned about the reader.

The owner is now the primary user and wants the opposite: nothing an agent
does is transient, and future agents should know what the reader struggled
with, what they finally understood, what they think of the author, and the
tone the tutor developed with them. The last of these, the tutor's voice,
matters more than the transcript.

## Decision

Bookhand stores conversations, memories, and the tutor's voice in the local
book database, for every book.

- **Conversations** are stored as readable exchanges: the reader's messages,
  the agent's rich replies, and compact receipts for tool activity. Raw tool
  payloads are stored only as needed to render a receipt. A conversation is
  dismissed, never silently discarded; only an explicit delete removes it.
- **Continuation stays with the harness.** [ADR 0014](0014-tutor-agent-connect-acp.md)
  defines the ACP session boundary. When a gateway cannot reopen the session,
  readers can still see the local transcript.
- **Memories** are small records an agent writes about this reader and this
  book. Agents write them visibly and choose whether to ask first. The reader
  can see, edit, and delete every memory.
- **Voice** is a memory about the reader's relationship with the tutor. One
  global voice memory carries across books, with optional notes per book.
  Every agent reads it before speaking, through the same page-owned tools, so
  the voice survives a new conversation, model, or provider.

This replaces the earlier restriction against local transcripts. Gateway
credentials, cookies and authorization codes stay outside the book database,
memories and conversations. Bookhand never automatically replays an
interrupted tool turn.

External WebMCP agents, whose chat Bookhand never sees, read memories and voice
and write memories and artifacts through the same tools. Bookhand does not
pretend to hold their transcript.

## Consequences

- The open defect about restored conversations exposing raw JSON is replaced by
  the new conversation rendering rather than patched in the old projection.
- Existing Study lessons, items, and schema are deleted without migration; the
  owner is the only user.
- Stored conversations and memories contain book text and personal opinions.
  They stay on the device; any future export or sync needs its own decision.

Revisit if stored conversations grow large enough to hurt local performance,
or if memory quality proves too noisy for agents to use without curation.
