# CleanMateX Frontend Skill Pack - Updated

This package replaces the previous frontend skill files with a contradiction-free version.

## Files

- `SKILL.md` — authoritative frontend skill entry point for Claude/Cursor.
- `architecture.md` — folder boundaries, route rules, imports, navigation contract.
- `standards.md` — coding standards, data fetching, forms, tables, i18n, permissions, lint gates.
- `ui-blueprint.md` — Cmx UI component contracts under `src/ui/` only.
- `uiux-rules.md` — screen-level UX, accessibility, RTL, responsive, and state rules.

## Key fixes

- Removed the forbidden `components/ui` structure.
- Standardized imports to `@ui/*`, `@features/*`, and `@lib/*`.
- Made server-side pagination mandatory in data-table contracts.
- Added data-fetching rules for Server Components, TanStack Query, API clients, and Supabase.
- Added permission/action-gate rules.
- Added generated-file protection.
- Made `SKILL.md` short and authoritative; details moved to supporting docs.
