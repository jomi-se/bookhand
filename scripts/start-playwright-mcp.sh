#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$project_root/.playwright-mcp/npm-cache}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$project_root/.playwright-mcp/cache}"

exec npx -y @playwright/mcp@latest \
  --device "Pixel 7" \
  --isolated \
  --config "$project_root/.codex/playwright-mcp.json"

