# Rule: always reuse shared Cmx components

Applies to every frontend change in `web-admin`: pages, screens, forms, dialogs, tables, filters, and detail views.

## Must
1. Build UI only from the shared Cmx components in `src/ui/` (`@ui/primitives`, `@ui/forms`, `@ui/data-display`, `@ui/overlays`, `@ui/feedback`, `@ui/navigation`, `@ui/patterns`). Search `src/ui/` for an existing component BEFORE writing any markup.
2. Inputs: `CmxInput`, `CmxSelect` (both support `error`), LOV/picker components for values that live in a table. Labels: `CmxFieldLabel` (help icon, required star, RTL). Never a raw `<input>`, `<select>`, `<label>`, or `<table>` in feature code.
3. Tables: `CmxDataTable` / `CmxDataGrid`. Paging uses the shared settings in `src/ui/data-display/cmx-table-defaults.ts` (`CMX_DEFAULT_PAGE_SIZE`, `CMX_PAGE_SIZE_OPTIONS`). Never hardcode a page size or page-size list in a screen.
4. Feedback: `cmxMessage` / `useMessage()` from `@ui/feedback`.
5. If a shared component lacks something you need, IMPROVE THE SHARED COMPONENT (backward compatible: optional props, no renames, no behavior change for existing callers) so every screen benefits. Add or update its test and story (`/storybook`). Do not fork it.
6. Shared defaults (page size, density, date format, label pattern such as `Label - [db_column]`) live in ONE shared constant or helper under `src/ui/` (or the feature's `lib/` when feature-only) and are imported, never copied.

## Must not
- Create a one-off component in a feature folder that duplicates or wraps a shared Cmx component only to restyle it.
- Copy-paste markup or Tailwind class strings from a Cmx component into a screen.
- Add a feature-local field/label/table wrapper when a Cmx one exists (migrate existing ones such as `NtfFormField` to `CmxFieldLabel` when you touch them).

## Allowed exceptions
- A feature-specific composite (for example a routes dialog) that is BUILT FROM Cmx components.
- A genuinely new reusable component: create it in `src/ui/` with the `Cmx` prefix, with test, EN/AR, and RTL support.

## Review checklist
- [ ] No raw form/table elements in feature code.
- [ ] No hardcoded page sizes; uses `cmx-table-defaults`.
- [ ] Any missing capability was added to the shared component, not worked around locally.
- [ ] Existing callers of a changed shared component still type-check (`npx tsc --noEmit`).
