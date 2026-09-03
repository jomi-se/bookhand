# VAL-REMASTER-ATOMIC-EDIT: Surgical edits are small, exact, and atomic

Surface: document-remaster domain, genuine WebMCP, Foliate reader, persistence,
and person-facing remaster controls.

Needs: the deployed document-remaster read/rewrite/history surface.

Behavior: `get_section_source` returns the current editable section body, its
agent stylesheet, revision count, and a fingerprint covering both. The
`edit_section` tool accepts exactly the current `sourceFingerprint` and required
non-negative `sectionIndex` returned by that read, one to fifty ordered
`{ oldText, newText }` replacements, an optional complete agent stylesheet, and
summary. The fingerprint covers book identity, section identity, raw editable
HTML, and the agent-owned stylesheet. Every `oldText` is
non-empty and must occur exactly once at its turn in the evolving source. A
stale fingerprint, missing match, ambiguous match, empty batch, unknown field,
or malformed edit rejects the entire call and changes neither memory, storage,
nor the rendered book. A valid batch applies in order, passes through the same
sanitizer and package-relative resource handling as `rewrite_section`, becomes
one saved revision and one Undo step, renders through Foliate, survives reload,
and preserves the current agent stylesheet when no replacement stylesheet is
supplied. Full `rewrite_section` remains available and unchanged.

Evidence: focused exact-edit and fingerprint units; hostile, missing,
ambiguous, ordered, CSS-preservation, and atomic-rejection cases; genuine
WebMCP schema/result calls; real Foliate rendering plus Undo and reload; storage
revision count; production build, browser console, failed-request, and
off-origin-request observations.

Scope: exact source replacement is the v0 patch language. Line-number, unified
diff, selector/DOM-operation, and partial-source-read tools are not implied.
