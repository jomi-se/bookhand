# ADR 0011: Optional direct Open Responses connection

Accepted: 2026-09-20.

Bookhand offers two ways to connect the optional Tutor. Agent Connect remains
the recommended path: a compatible provider can authenticate the reader,
authorize Bookhand's exact tool set, manage credentials, and expose bounded
provider-owned conversation history. Bookhand also offers an advanced direct
path for people who have an API bearer token and an HTTPS provider that
implements the Open Responses protocol subset Bookhand uses.

The direct path asks for the exact Open Responses POST endpoint, model ID, and
bearer token. It is provider-neutral; “OpenAI-compatible” Chat Completions alone
is not enough. The provider must support streaming Responses, function calls and
function outputs, accepting completed response items as later input, response
IDs, and browser CORS for the Bookhand origin. The provider's API billing,
quotas, retention, and other terms apply.

Agent Connect uses its provider-owned response checkpoint for continuation.
Direct mode instead keeps completed Open Responses messages in page memory and
resends that history with each request. This stateless replay works with
providers that implement the protocol but do not retain responses or accept
`previous_response_id`. It also makes the cost explicit: input usage grows with
the Tutor conversation. Bookhand never silently drops part of a tool exchange;
the person can choose **New conversation** when they want a fresh context.

Bookhand may persist the selected connection method, endpoint, and model as
non-secret preferences. The direct bearer token stays only in the current page's
memory: it is never written to local storage, session storage, SQLite, logs, or
the URL. Reloading requires the token again and begins a fresh Tutor
conversation. Bookhand sends the token only to the configured endpoint, refuses
redirects, and requires HTTPS. Changing or disconnecting the direct connection
invalidates its token getter and conversation generation. Direct conversation
messages are likewise page-memory only and are cleared by reload, disconnect,
or **New conversation**.

Both paths bind execution to the exact Bookhand tool declarations present when
the person connects. A declaration change blocks later execution and requires a
new connection. Imported EPUB content remains in the separately contained
reader frame and never receives the application connection or network
permission.

Direct mode does not attempt OAuth, token refresh, provider discovery,
provider-owned history restoration, `previous_response_id`, or a speculative
“test request.” The first real Tutor turn is the first end-to-end proof that a
provider supports the required protocol and browser behavior. Errors must
explain that endpoint, CORS, authentication, model availability, or protocol
support may be the cause.

This decision adds no Bookhand backend, account, synchronization service, or
vendor-specific model integration. It extends ADR 0007's shared connection seam
without weakening its Agent Connect credential and continuation rules.
