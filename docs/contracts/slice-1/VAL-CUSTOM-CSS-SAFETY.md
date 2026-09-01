# VAL-CUSTOM-CSS-SAFETY: Bound custom book CSS resource access

Surface: browser and network.
Needs: VAL-READER-STYLE and controlled intercepted origin.
Behavior: Preview/Apply rejects or neutralizes every remotely resolving resource reference with a specific visible error and zero request. The adversarial corpus covers case, whitespace, comments, CSS escapes, quoted/unquoted and protocol-relative/HTTP(S) URLs, `@import`, font sources, and nested fallback/function forms. Allowed local presentation declarations preview, apply, persist, and reset normally.
Evidence: Parameterized adversarial CSS corpus and results, visible validation errors, intercepted request count, and allowed-preview/apply/reset screenshots.
