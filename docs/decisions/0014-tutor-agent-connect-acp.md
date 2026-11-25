# ADR 0014: Bookhand Tutor uses Agent Connect ACP

## Status

Accepted 2026-11-25. Replaces the former shared connection and direct API
decisions (0007 and 0011). The reader and external WebMCP integrations work
independently of Tutor.

## Decision

Tutor uses the published `@open-agent-connect/web` browser SDK. The reader
enters a gateway origin and approves the book’s fixed tool declarations on
the gateway. Bookhand uses a popup on desktop and a same-tab redirect on
touch devices. A redirect preserves the open book, draft and attached
selection. Returning from approval never sends the draft.

The SDK handles PKCE, session-scoped credentials, refresh and revocation.
Bookhand keeps the gateway address as a preference and sends no harness
credentials. Remote gateways use HTTPS and WSS. HTTP and WS are supported
for loopback development. Earlier connection settings and checkpoints are
not migrated.

An ACP session belongs to one book conversation. Each request sends the
current prompt and its explicit attachment. The harness owns conversation
continuation. The SDK executes approved tools through the same page-owned
handlers used by external WebMCP, within the life of the open book and turn.
Tool payloads stay out of the displayed transcript. Bookhand does not
automatically resend a cancelled or interrupted prompt or tool action.

The live transport retains the last bounded transcript and opaque session
identifier per book and approval in the tab. A returning reader can see the
transcript. An explicit follow-up resumes only if the gateway can reopen
the session and the tab can acquire its conversation lock. Otherwise the
reader can keep the draft and explicitly start a new conversation. This tab
record is separate from the durable conversation, memory and voice work in
[ADR 0012](0012-keep-conversations-memories-and-voice.md). The phone artifact
prototype and Notebook remain the starting point for that work.

## Consequences

Gateway approval is required before using the live Tutor. A changed tool
catalog requires fresh consent. The agent’s model, availability, permission
profile and ability to reopen sessions depend on the gateway. Disconnect
revokes approval when the gateway is reachable. If revocation cannot be
confirmed, Bookhand clears its local credentials and points the reader to the
gateway to revoke access there.
