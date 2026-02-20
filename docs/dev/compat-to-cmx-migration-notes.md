# Compat-to-Cmx Migration: Implementation Notes & Suggestions

This document records notes, gotchas, and suggestions discovered during the migration from `@ui/compat` to Cmx design system components (Phases 1–7). Use it for future refactors and onboarding.

---

## 1. Executive Summary

- **Compat layer removed:** `web-admin/src/ui/compat/` was deleted. All app/feature code now uses Cmx components from `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, etc.
- **Cmx components upgraded:** `CmxInput`, `CmxSelect`, and primitives `Alert` were extended to support compat-style props (`label`, `error`, `helpText`, `message`, `destructive` variant) so call sites could migrate without losing behaviour.
- **Barrel conflict resolved:** `CmxDataTable` was exported from both `data-display` and `components`; the duplicate export was removed from `components` so the barrel has a single source.

---

## 2. Phases Completed

| Phase | Scope | Notes |
|-------|--------|------|
| 1 | Tabs, ProgressBar, SummaryMessage | Tabs → CmxTabsPanel; ProgressBar → CmxProgressBar (`@ui/feedback`); SummaryMessage → CmxSummaryMessage (`@ui/feedback`). |
| 2 | Button | `isLoading` → `loading`, `variant="danger"` → `variant="destructive"`. LoadingButton kept for icon/fullWidth. |
| 3 | Badge | Compat Badge → `@ui/primitives/badge`. `info` variant added to primitives Badge where needed. |
| 4 | Card | Card → CmxCard + CmxCardHeader/CmxCardTitle/CmxCardDescription/CmxCardContent/CmxCardFooter. Pattern helper: `src/ui/patterns/cmx-card-with-header.tsx`. |
| 5 | Form controls | Input, Textarea, Label, Checkbox, Switch, Select → Cmx equivalents. **Recommendation:** Use upgraded CmxInput/CmxSelect with `label`/`error`/`helpText` instead of wrapping in custom divs. |
| 6 | Alert, Dialog, subscription page | Alert/AlertDescription → primitives `Alert` (with `message` + `destructive`). Subscription page: Alert, Badge, ProgressBar, Select, Input → Cmx/primitives/feedback. |
| 7 | Remove compat | Deleted `src/ui/compat/`, removed its export from `src/ui/index.ts`, updated `.clauderc`, eslint, and docs. |

---

## 3. Cmx Component Upgrades (Best Practice)

### 3.1 CmxInput (`@ui/primitives`)

- **Added optional props:** `label`, `error`, `helpText`, `leftIcon`, `rightIcon`, `fullWidth` (default `true`).
- **Rationale:** Compat Input had built-in label/error/helpText; bare CmxInput did not. Adding these to CmxInput avoids wrapping every field in manual `<label>` + error/help blocks and keeps a single component for both “raw” and “form” usage.
- **Accessibility:** Uses `id`, `aria-invalid`, `aria-describedby` for error/help text.
- **Suggestion:** Prefer CmxInput with `label`/`error`/`helpText` over ad-hoc wrappers for consistency and a11y.

### 3.2 CmxSelect (`@ui/primitives`)

- **Added optional props:** `label`, `helpText`, `fullWidth` (default `true`). Already had `error`.
- **Rationale:** Same as CmxInput: compat Select had label/helpText; CmxSelect did not. Call sites (e.g. add-item-modal) were passing `label={...}` and getting no visible label until the upgrade.
- **Suggestion:** Use CmxSelect with `label`/`helpText` for forms; use native `<select>` with styling only when you need custom children (e.g. options as JSX).

### 3.3 Alert (`@ui/primitives`)

- **Added:** Optional `message` prop (rendered as content when no `children`). Variant `"destructive"` (mapped to same styling as `"error"`). Exported `AlertDescription` for structured content.
- **Rationale:** Compat Alert used `message`; primitives Alert used `children`. Adding `message` allowed a drop-in replacement. `destructive` matched compat variant name.
- **Note:** Alert lives in `@ui/primitives`, not `@ui/feedback`. The migration guide previously said “CmxAlert from @ui/feedback”; the actual replacement is `Alert` from `@ui/primitives`.

---

## 4. Gotchas & Fixes During Implementation

### 4.1 Card structure: Footer outside Content

- **Issue:** In some files (e.g. BrandingSettings, BusinessHoursSettings), `CmxCardFooter` was placed *inside* `CmxCardContent`, leading to invalid structure.
- **Fix:** Ensure order is `CmxCardContent` then `CmxCardFooter` as siblings under `CmxCard` (footer after content, not nested inside it).

### 4.2 Checkbox: `onCheckedChange` → `onChange`

- **Issue:** Compat Checkbox used `onCheckedChange(checked: boolean)`. CmxCheckbox uses standard input `onChange`.
- **Fix:** Replace `onCheckedChange={(checked) => ...}` with `onChange={(e) => ... e.target.checked }` in pre-submission-pieces-manager, order-details-section, etc.

### 4.3 product-form: Card and Button/Input

- **Issue:** product-form used `Card` and `Input`/`Button` but only imported `CmxCard`, `CmxInput`, `CmxButton`; the old names were still in JSX, causing undefined components.
- **Fix:** Replaced all `<Card>`, `<Input>`, `<Button>` with `<CmxCard>`, `<CmxInput>`, `<CmxButton>` and fixed closing tags. Also `variant="secondary"` → `variant="outline"` for CmxButton.

### 4.4 Preferences page: Select with children

- **Issue:** UserPreference passes `<Select><option>...</option></Select>` as children; compat Select supported both `options` prop and `children`. CmxSelect only accepts `options` (array).
- **Fix:** Replaced compat Select with a styled native `<select className="...">` so option children continue to work; did not switch to CmxSelect with an options array to avoid refactoring the cloneElement flow.

### 4.5 UsageWidget CmxProgressBar import

- **Note:** UsageWidget should import `CmxProgressBar` from `@ui/feedback`, not `@ui/primitives`. Primitives does not export CmxProgressBar.

### 4.6 add-item-modal labels

- **Issue:** After swapping compat Input/Select for CmxInput/CmxSelect, `label={...}` was still passed but original CmxInput/CmxSelect did not render it.
- **Fix:** CmxInput and CmxSelect were upgraded to support `label` (and `error`/`helpText`), so add-item-modal and similar forms now show labels without extra wrapper components.

---

## 5. Barrel Export Conflict: CmxDataTable

- **Error:** `Module './data-display' has already exported a member named 'CmxDataTable'. Consider explicitly re-exporting to resolve the ambiguity.`
- **Cause:** `src/ui/index.ts` re-exported both `./data-display` and `./components`. `data-display` exports the server-side **CmxDataTable** (cmx-datatable.tsx); `components` also exported a **CmxDataTable** (cmx-data-table.tsx, client-side table).
- **Fix:** Removed `export * from './cmx-data-table'` from `src/ui/components/index.ts`. The barrel now exposes a single CmxDataTable (from data-display). The client-side table in `components/cmx-data-table.tsx` remains available via direct import (`@ui/components/cmx-data-table`) if needed.
- **Suggestion:** If you need both tables, consider renaming one (e.g. client-side one to `CmxClientDataTable`) and exporting it from data-display or a dedicated module to avoid future barrel clashes.

---

## 6. Config & Docs Updates

- **`.clauderc`:** UI snippets updated from `@ui/compat` to Cmx paths (CmxButton, CmxInput, CmxDialog, CmxCard, Alert, CmxSelect). `table` snippet removed (compat did not export Table).
- **`eslint.config.mjs`:** Restricted-imports message updated; added pattern to forbid `@ui/compat` and `**/ui/compat`.
- **`docs/dev/ui-migration-guide.md`:** Status set to Phase 7 complete; compat removed from architecture and import table; added `@ui/overlays`.
- **`src/ui/feedback/cmxMessage_developer_guide.md`** and **`src/ui/feedback/README.md`:** SummaryMessage examples updated from `@ui/compat` to `CmxSummaryMessage` from `@ui/feedback`.

---

## 7. Suggestions for Future Work

1. **Legacy `src/ui/components`:** The index still re-exports CmxButton, CmxChart, CmxForm, CmxInput, CmxToast. These overlap with primitives (e.g. CmxButton, CmxInput). Consider phasing out `export * from './components'` in `src/ui/index.ts` and directing all usage to `@ui/primitives` / `@ui/data-display` / etc., or explicitly re-export only non-overlapping symbols to avoid future “already exported” errors.
2. **Alert location in docs:** In the migration guide, “Feedback” section says “Alert → CmxAlert from @ui/feedback”. In code, Alert is from `@ui/primitives`. Update the guide to say “Alert, AlertDescription from `@ui/primitives`” for consistency.
3. **Badge:** Migration guide says “Badge → CmxBadge” and “@ui/data-display”. In code, Badge is exported from `@ui/primitives/badge`. Confirm and align docs with actual exports.
4. **Card:** Guide says “CmxCard family @ui/data-display”; in code CmxCard is in `@ui/primitives/cmx-card`. Update docs to `@ui/primitives` or `@ui/primitives/cmx-card`.
5. **select-dropdown:** Compat had a composable `select-dropdown` (SelectTrigger, SelectValue, SelectContent, SelectItem). It was removed with compat. Any remaining usage should be migrated to `CmxSelectDropdown` from `@ui/forms`; grep for `select-dropdown` or `SelectTrigger`/`SelectContent` to find call sites.
6. **i18n:** After changing UI copy (e.g. button labels, placeholders), run `npm run check:i18n` and update `en.json`/`ar.json` as needed.
7. **Verification:** After any UI refactor, run `npm run build` and `npm run check:i18n` in web-admin.

---

## 8. Files Touched (Summary)

- **Removed:** Entire `web-admin/src/ui/compat/` (17 files).
- **Modified (examples):**  
  `web-admin/src/ui/index.ts`, `web-admin/src/ui/primitives/cmx-input.tsx`, `web-admin/src/ui/primitives/cmx-select.tsx`, `web-admin/src/ui/primitives/alert.tsx`, `web-admin/src/ui/components/index.ts`,  
  `.clauderc`, `web-admin/eslint.config.mjs`, `docs/dev/ui-migration-guide.md`,  
  `web-admin/app/dashboard/**/*.tsx`, `web-admin/app/register/**/*.tsx`, `web-admin/src/features/**/*.tsx` (settings, orders, inventory, catalog, etc.).
- **Reference:** Full list of migrated files is implied by the removal of all `from '@ui/compat'` (and equivalent) imports in `.tsx`/`.ts` under web-admin.

---

## 9. Verification Commands

```bash
# No compat imports in app/feature code
rg "@ui/compat" web-admin --glob "*.{tsx,ts}"   # Should find only eslint rule or docs

# Build
cd web-admin && npm run build

# i18n
cd web-admin && npm run check:i18n
```

---

## 10. Gaps Covered (Post-Migration)

The following gaps were identified and addressed after the migration:

| Gap | Fix |
|-----|-----|
| **ui-migration-guide: wrong module paths** | Data Display: Card/Badge corrected to `@ui/primitives` (not `@ui/data-display`). Feedback: Alert/AlertDescription corrected to `@ui/primitives` (not CmxAlert from `@ui/feedback`). |
| **ui-migration-guide: obsolete compat options** | Removed "Option A: Keep Legacy Import" and "Option B: Switch to @ui/compat". Replaced with a single "Migrate to Cmx Components" flow and a note that compat has been removed. |
| **ui-migration-guide: checklist and verification** | Checklist updated: "Prefer @ui/compat" removed; "Use Cmx components only" added. Call Site Inventory and Phase 5/6 Verification sections updated to Phase 7 (compat removed, rg commands for verification). ESLint example block removed (config already forbids @ui/compat). |
| **Barrel: CmxDataTable conflict** | `CmxDataTable` was exported from both `data-display` and `components`. Removed export from `components/index.ts` so the barrel has a single source (`data-display`). |
| **Legacy docs (ui-migration-guide_phase4.md)** | Left as historical; references compat. For current state use [ui-migration-guide.md](ui-migration-guide.md) and this notes doc. |

**Permanently fixed:**

- **Legacy `src/ui/components` barrel:** `export * from './components'` was **removed** from `src/ui/index.ts`. The main `@ui` barrel no longer re-exports the components layer, so there is no overlap with primitives/forms/feedback and no risk of "already exported" errors. **Canonical paths:** CmxButton, CmxInput, CmxCard, Alert, Badge → `@ui/primitives`; CmxForm, CmxSelectDropdown → `@ui/forms`; CmxToast / toast helpers → `@ui/feedback`; CmxChart (if needed) → `@ui/components` only.
- **select-dropdown:** Legacy compat select-dropdown usage was removed. Composable dropdowns use **CmxSelectDropdown** from `@ui/forms` (e.g. PieceBulkOperations, PieceCard, processing-modal-filters). No further migration needed.

---

## 11. Ensuring Cursor/Claude Follow the Rules

To maximize the chance that Cursor and Claude Code follow the UI/Cmx rules:

1. **Always-applied rules:** `.cursor/rules/web-admin-ui-imports.mdc` has `alwaysApply: true` and states: use Cmx only, no `@ui/compat`, use import snippets from `web-admin/.clauderc` → `ui_components`, run `npm run build` after UI changes.
2. **CLAUDE.md:** The repo root `CLAUDE.md` includes a mandatory UI Quick Rule (Cmx only, .clauderc snippets) and a section "How to Make Cursor/Claude Follow the Rules" describing always-applied rules, skills, build-time enforcement, and .clauderc.
3. **Build-time enforcement:** ESLint `no-restricted-imports` forbids `@ui/compat` and `@/components/ui`. Invalid imports fail TypeScript. Running `npm run build` in web-admin catches violations even if the AI suggested wrong imports.
4. **.clauderc:** Keep `ui_components` in sync with `web-admin/src/ui` so generated code uses correct Cmx paths.
5. **Explicit prompts:** When you need a rule followed, state it (e.g. "Use Cmx components only and import from .clauderc").

---

*Last updated: Phases 1–7, CmxDataTable barrel fix, docs gap fixes, rule-adherence section, permanent removal of `export * from './components'` from main barrel.*
