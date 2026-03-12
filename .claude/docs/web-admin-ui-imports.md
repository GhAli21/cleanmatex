# web-admin UI Imports (Mandatory)

When writing or suggesting **UI code in web-admin**:

1. **Use Cmx design system only.** Import from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`. Do **not** use `@ui/compat` (removed).
2. **Use the exact import snippets from `web-admin/.clauderc`** in the `ui_components` section for buttons, inputs, cards, dialogs, alerts, selects, tabs, etc. When generating a component (e.g. Button, Card, Dialog), copy the corresponding snippet from `.clauderc` so imports are correct.
3. **Run `npm run build`** in web-admin after UI changes; ESLint and TypeScript will fail on invalid or restricted imports.

**Restricted** (will fail build/lint): `@ui/compat`, `@/components/ui`, `@/components/ui/*`.

**See also:** `.claude/skills/frontend/standards.md` (section "web-admin/.clauderc (AI Hints)"), `docs/dev/ui-migration-guide.md`.
