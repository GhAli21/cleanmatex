# UI Design System and Theming — Status

**Last update:** 2026-11-17
**Current document:** `THEMING_ARCHITECTURE_DESIGN.md` (approved by owner 2026-11-16). It wins over any PR file on conflict.
**Plans:** one per package, written just before that package starts. `PLAN_PR-01.md` is executed (see its Progress table and Rulings).
**Code written so far:** PR-01 and all of PR-02 (the owner committed through PR-02 Task 7; the rest is uncommitted). No migration written.
**Resume here:** `RESUME_CONTINUATION.md` (handoff for the next session or assistant).

## Packages

| Package | What | Depends on | State |
|---|---|---|---|
| PR-01 | Tokens, fonts, `cn()` merge, RTL and accessibility fixes in shared components | — | **Implemented 2026-11-16 (all 7 tasks), owner QA pending** |
| PR-02 | Badges, select, remove duplicate components, lint rules | PR-01 | **Implemented 2026-11-17 (all 10 tasks), owner QA pending** (`PLAN_PR-02.md`) |
| PR-07 | Theme tables, resolver, branding and appearance screens, HQ catalogs | PR-02 (dark mode also PR-05) | Not started |
| PR-05 | Page shell; colour and direction class migration, folder by folder | PR-02 (orders after PR-04) | Not started |
| PR-04 | POS touch targets and keyboard shortcuts | PR-01 | Not started |
| PR-03 | Zod validation at boundaries | — (independent track) | Not started |
| PR-06 | Server-component boundaries; cache only if measured | — (independent track) | Not started |

**Recommended order:** PR-01 → PR-02 → PR-07 tasks 1–5 → PR-04 → PR-05 → PR-07 task 6 (dark mode). PR-03 and PR-06 can run any time.

## Decisions (2026-11-16)

- Server-resolved CSS tokens; brand colours computed on the server, so theming needs no newer browser than the app already does.
- HQ publishes themes in `sys_ui_theme_cd`; `STANDARD` is the default and every Organization uses it until it chooses another.
- Organization themes in `org_tenant_ui_theme_dtl`; user preferences on `sys_users_mst`.
- UPPERCASE codes and values everywhere.
- Logo and brand colours move off `org_tenants_mst`; `brand_color_accent` is dropped.
- Splitting `payment-full-view.tsx` is removed from PR-04 and belongs to its own Order Fin package.

- Default table page size becomes 10 (was 5); tables keep their existing per-call size options.
- `app/dashboard/jhtestui` is kept and migrated last.
- `@radix-ui/react-select` approved for the Cmx select wrapper.

- `@mdi/font` stays: catalog icons are stored in the database as MDI class names.
- The colour function moves from PR-07 into PR-01, so the static `STANDARD` values and the per-Organization values come from one source.
- `STANDARD` buttons are aqua with dark text (white on aqua is not readable).

## PR-01 result (2026-11-16)

- Every `--cmx-*` variable the code uses is now defined, in `web-admin/src/ui/foundations/tokens.css`, generated from `web-admin/lib/theme/brand-palette.ts` (the same function PR-07 will run per Organization). Light, dark and system-dark blocks; density and font-scale blocks; print forces light.
- Arabic font self-hosted via `next/font`; no request to Google Fonts at runtime.
- Shared components: logical spacing, RTL chevrons and pagination arrows, translated pagination labels, confirm dialog with focus trap and Escape, wizard confirm without `window.confirm`, badge role removed, input ids from `useId`, default page size 10.
- Brand colour used as text now reads `--cmx-primary-text-rgb` (readable on white); focus rings read `--cmx-focus-ring-rgb`. Primary buttons have dark text on aqua.
- Final review by a fresh reviewer: 4 Important findings fixed (unreadable info banners, `text-primary` low contrast, Escape cancelling a running confirm, closed confirm unlocking page scroll); 5 Minor deferred, listed in `PLAN_PR-01.md` → Final review.
- Checks: brand-palette 61 tests, token guard 5, confirm dialog 8, input id 2 — all pass. ESLint clean on changed files, `check:i18n` passes, `npm run build` passes. Full jest: 9 suites fail, all judged unrelated (detail in `PLAN_PR-01.md` → Rulings).
- `cn()` now merges with `tailwind-merge`, so a `className` passed to a Cmx component overrides that component's conflicting default (for example `px-4` beats `px-2`). The owner repaired the npm install on 2026-11-16. Test `cn` 4/4; build passes.

- Owner QA steps: `QA_TEST_GUIDE.md` → PR-01.

## PR-02 result (2026-11-17)

- **One badge:** `CmxStatusBadge` with 6 locked tones (`neutral info success warning danger brand`). About 127 callers were moved. Order statuses map to 5 tones through `orderStatusTone()`. The legacy `Badge` is deleted.
- **Select:** `CmxSelectDropdown` is built on Radix Select. Its list is portalled above dialogs, and Escape closes only the list. The empty value works. It supports keyboard and RTL.
- **Removed duplicates:** legacy `Button`, `Card`, `Input`, `LoadingButton`, `FormInput`, `src/ui/components/` and `foundations/tokens.ts`. The top bar and permissions inspector moved out of feature imports. The top bar's dead search box is removed, and its user menu is a real menu.
- **Classes:** `src/ui` uses theme tokens and logical (RTL-safe) classes only. A guard test and ESLint (errors in `src/ui`, warnings in `src/features` and `app`) keep it that way. `scripts/ui/codemod-classes.js` is ready for PR-05. PR-05 starts from 5,974 colour warnings, 1,796 direction warnings and 50 `Alert` imports.
- **Pagination text** comes from `common.*` in both languages.
- **Final review by a fresh reviewer:** 4 Important findings fixed, each with a test that failed first: Arabic double-mirroring from the codemod, the top bar menu LTR in Arabic, brand badges without a tint, and a select pick clicking the row behind it. 3 Minor deferred. Details are in `PLAN_PR-02.md` → Final review.
- **Checks:**
  - jest (`ui lib scripts features/orders`): 143 suites pass. 7 fail, all on PR-01's known list.
  - Full ESLint shows 0 errors; `check:i18n` passes.
  - Build: passed after Task 7. Passed again after the review fixes (third attempt; the first two failed because another session deleted routes during the build).
- Owner QA steps: `QA_TEST_GUIDE.md` → PR-02.

## Open

- PR-01 owner QA (`QA_TEST_GUIDE.md`) and commit.
- PR-02: owner QA (`QA_TEST_GUIDE.md` → PR-02, including the Storybook check) and commit.
- Pre-existing, not from this program: 2 type errors (`app/(auth)/login/page.tsx:162`, `src/features/users/ui/membership-lock-action.tsx:84`) and 9 failing jest suites (list in `PLAN_PR-01.md`).
- Font pairs to seed (licence and Arabic coverage check).
- Tailwind v4's exact minimum browser versions.
- Contrast check of the nine proposed theme colour pairs.

## PR file review (2026-11-16)

Checked against the code and corrected: wrong paths (`src/lib/utils.ts` → `lib/utils.ts`; `screens/` → `ui/`; tenant-guard script is `.mjs`), a result type that breaks under `strict: false`, a keyboard-shortcut clash with the existing payment shortcuts, a cache design that read feature flags from the database against the HQ-API rule, an artificial dependency chain, and PR-07's doc path, lowercase codes, inline script and SVG handling. Line numbers quoted inside the PR files were not all re-checked.
