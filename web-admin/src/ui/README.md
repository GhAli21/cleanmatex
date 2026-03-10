# CleanMateX UI System

This directory contains the shared UI surface for the CleanMateX web admin.

## Import Policy

Use the approved Cmx UI domains:

- `@ui/primitives`
- `@ui/feedback`
- `@ui/overlays`
- `@ui/forms`
- `@ui/data-display`
- `@ui/navigation`

Do not use:

- `@ui/compat`
- `@/components/ui`
- `@/components/ui/*`
- older `@ui/components` guidance from legacy docs unless it matches current exports and project rules

## Structure

Current UI areas are organized by domain rather than a single legacy components barrel:

- `primitives/`: low-level reusable UI building blocks
- `feedback/`: messaging and feedback utilities
- other domain folders used by the current Cmx design system

## Usage Guidance

- prefer the approved domain entrypoints above
- keep UI usage aligned with `web-admin/.clauderc`
- when documentation and current exports disagree, update the documentation to match the current code and rules
- after UI changes, run `npm run build` from `web-admin/`

## Documentation Note

Some historical UI docs in this directory still mention legacy import paths such as `@ui/components`. Treat those as migration context only until each file is reconciled with the current UI import rules.

## Related Documentation

- `../../README.md`
- `../../docs/README.md`
- `../../CLAUDE.md`
- `feedback/README.md`
