# CleanMateX UI Blueprint Notes

**Status:** Historical blueprint and migration-context document  
**Last Updated:** 2026-03-10

## Purpose

This file preserves the architectural intent behind the CleanMateX UI system, but it should not be treated as the primary import or usage authority.

## Current Authority

For current UI guidance, use:

- `README.md` in this folder
- `../../README.md`
- `../../../CLAUDE.md`
- `web-admin/.clauderc`

## Current Import Rules

Use the approved UI domains:

- `@ui/primitives`
- `@ui/feedback`
- `@ui/overlays`
- `@ui/forms`
- `@ui/data-display`
- `@ui/navigation`

Do not use this file as authority for:

- `@ui` barrel imports as the default
- legacy `@ui/components/*` guidance
- coexistence claims for deprecated patterns

## Architectural Value Still Retained Here

This file is still useful for understanding the intended layered UI model:

- primitives
- forms
- data-display
- feedback
- page-level UI patterns

Use it as design-history and architectural context, not as the canonical implementation guide.

## Migration Note

Older migration references in this file may describe transitional or legacy patterns that are no longer recommended. When this file conflicts with current project rules, the current project rules win.

## Historical Notes

Some earlier blueprint checkpoints described component-layer progress and migration work during the UI system buildout. Keep those notes as architecture history only, not as release-truth or current implementation status.

## Related Documentation

- `README.md`
- `USAGE_EXAMPLES.md`
- `feedback/README.md`
- `../../README.md`
