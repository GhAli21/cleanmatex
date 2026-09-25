#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs npm workspace deps (web-admin, cmx-api, packages/*) so build, lint and tests work in cloud sessions.
# --no-save keeps package-lock.json unchanged; --legacy-peer-deps matches web-admin/vercel.json.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --legacy-peer-deps --no-audit --no-fund --no-save
