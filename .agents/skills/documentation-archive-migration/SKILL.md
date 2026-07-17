---
name: documentation-archive-migration
description: Convert outdated, duplicate, or non-canonical CleanMateX documentation into redirect stubs, support-only references, or archive-ready material. Use when legacy docs should stop acting like active truth and need a safe migration path that preserves discoverability.
---

# Documentation Archive Migration

Retire legacy docs safely.

## Use This Skill To

- convert old docs into redirect stubs
- mark folders as legacy or historical
- prepare docs for archival without losing discoverability

## Workflow

1. Confirm the canonical destination already exists.
2. Identify which legacy docs still need discoverability.
3. Replace or update them with redirect context.
4. Move historical-only material toward archive-safe state if requested.
5. Update indexes so active docs stop pointing at legacy locations.

## Guardrails

- Do not archive the only current source of truth.
- Do not delete context that is still useful for traceability unless explicitly requested.
- Prefer short redirect docs over silent removal.

## Output Contract

Always report:

- canonical destination
- legacy items touched
- redirect/archive actions
- remaining cleanup still needed
