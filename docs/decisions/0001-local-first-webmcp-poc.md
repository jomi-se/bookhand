# ADR 0001: Local-first WebMCP proof of concept

## Status

Accepted on 2026-09-01.

## Context

The hackathon value is showing that WebMCP gives an agent meaningful, precise
control over a reading and study experience. Requiring a private gateway or
hosted backend would make the judging path fragile and obscure that claim.

## Decision

Build the first vertical slice as a client-side, local-first application. Use
WebMCP as the agent-facing semantic capability layer. Keep Agent Connect an
optional future integration rather than a prerequisite.

Use stable native study blocks for recurring patterns and permit richer
generated labs only inside an explicit, bounded study-board surface. The proof
of concept does not need production-grade isolation machinery, but generated
content must not silently gain the application's storage or navigation powers.

## Consequences

The demo is easy to run and its WebMCP contribution is legible. Persistence and
generated artifacts are limited to one browser. Synchronization, arbitrary
extensions, and user-owned remote agents remain later decisions.

