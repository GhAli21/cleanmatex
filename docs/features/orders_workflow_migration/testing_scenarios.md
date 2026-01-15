---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

# Testing scenarios

## Preparation list

- Loads using screen contract statuses (no hardcoded status list)
- Paginates server-side
- Works in EN and AR (RTL)

## Preparation detail

- Shows workflow context panel (flags + item count)
- Completing preparation:
  - Works with `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM=false` (old workflow forced)
  - Works with `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM=true` (new workflow enabled) *once contracts exist for the screen*
  - Shows user-facing error on failure
  - Navigates to Processing screen on success

## OrderActions

- Opens confirmation dialog
- Executes status change using transition hook
- Shows blockers when returned by API (quality gate failures)


