# Agent setup

## Shared repository behavior

`AGENTS.md` is canonical. Claude reads it through the `@AGENTS.md` import in
`CLAUDE.md`. Skills are stored once in `.agents/skills`; `.codex/skills` and
`.claude/skills` point to them.

Impeccable is present for explicit UI work and review. No Claude post-tool hook
is configured, so ordinary edits do not automatically invoke it.

## Playwright MCP

Both Codex and Claude use `scripts/start-playwright-mcp.sh`, which starts an
isolated headless Chromium MCP session with the project configuration. The npm
and browser caches stay outside version control.

If Chromium is missing, install the browser expected by the local Playwright
package before using browser automation.

## Devpost

The project declares the remote Devpost MCP at `https://devpost.com/mcp` for
both harnesses. Authentication remains in each user's harness credential store;
no token belongs in this repository.

For Codex, install the official Devpost Hackathons plugin if its guided skills
are not already available, then authenticate the MCP server:

```sh
codex mcp login devpost
```

Restart the harness after adding or authenticating an MCP server so its tools
and skills are rediscovered. In Claude Code, approve the project MCP declaration
and complete its OAuth flow when prompted.

