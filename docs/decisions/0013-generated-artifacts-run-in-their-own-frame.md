# ADR 0013: Generated artifacts run in their own frame

## Status

Accepted on 2026-09-29 by the owner. The exact frame transport is
evidence-gated by the first artifact ticket.

## Context

Artifacts may take any shape: an agent writes real HTML, CSS, and JavaScript
for an explanation, animation, or interactive experiment. The earlier plan
rendered only a bounded declarative schema through trusted native code and
deferred generated JavaScript. The owner rejected that ceiling.

Bookhand's application policy allows only its own scripts
(`script-src 'self'`). A `srcdoc` or `about:blank` frame inherits that policy,
so generated inline scripts would not run there, and loosening the
application's own policy would expose the reader, database worker, and
connection credentials to generated code. ADR 0005 also rejected `blob:`,
`data:`, and `srcdoc` navigation for the reader frame because an embedded
agent browser refused it.

Imported books are untrusted, and an agent reading one can be manipulated into
writing an artifact that carries the reader's book text or notes elsewhere.

## Decision

Generated artifacts render in a dedicated frame document served from
Bookhand's origin (for example `artifact-frame.html`) with its own
Content-Security-Policy. The frame is sandboxed with scripts allowed and
without same-origin access, so it runs in an opaque origin: it cannot read
Bookhand's storage, database, credentials, or DOM. It receives the artifact's
source and a small bridge by `postMessage`.

- The frame's policy allows inline scripts and styles, and loads scripts,
  styles, and fonts from Bookhand and a short list of trusted CDNs
  (initially cdnjs and jsDelivr). It permits no other network connections.
- The bridge offers theme tokens, reduced-motion and viewport state, the
  artifact's anchored passages, and requests to navigate the reader or open
  another artifact. Bookhand performs those requests; the frame never acts
  directly.
- Smart building blocks (book quotations, math, highlighted code, plot and
  motion helpers) ship as a Bookhand library inside the frame. Artifacts may
  use or ignore them.
- Containment is proportionate: its purpose is to keep artifacts from carrying
  data off the device or reaching into the application. It is not a
  hostile-code research project and must not restrict style or shape.

The application's own policy and the reader frame's containment stay as they
are.

## Consequences

- Each visible artifact costs a frame. Lists and the Notebook show static
  previews and start a live frame only for artifacts the reader opens.
- The trusted-CDN list is a deliberate network permission; adding an origin is
  a change to this decision.
- The first artifact ticket must prove that the sandboxed same-origin frame
  URL loads in the target mobile browser and in an embedded agent browser
  before other work depends on it.

Revisit if the opaque-origin frame cannot load in a required browser, or if
the trusted CDNs prove to be a practical exfiltration path.
