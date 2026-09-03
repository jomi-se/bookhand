# Security policy

## Supported version

Bookhand is a hackathon proof of concept. Security fixes apply to the current
`main` branch and the deployment at <https://bookhand.dev/>.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow instead of opening
a public issue. Include the affected URL or commit, reproduction steps, and the
impact you observed. Please do not include private book content or credentials.

Bookhand is local-first and has no application backend or accounts. Imported
EPUBs and agent-produced markup are nevertheless untrusted inputs; reports
about content isolation, unexpected network requests, unsafe markup execution,
or WebMCP authorization boundaries are especially useful.
