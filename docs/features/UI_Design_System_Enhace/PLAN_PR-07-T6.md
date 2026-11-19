# PR-07 task 6: Dark mode for users — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, the owner's choice for this program). Load `/frontend` and `/i18n` before any code, `/database` + `/file-util-wire` before Task 6, `/order-fin` (read-only display) before touching the tax document preview.

**Status:** APPROVED 2026-11-19 as written; ruling 6 = **A** (publish the dark logo to `org_tenants_mst.logo_dark_url`).
**Goal:** a person can choose Light, Dark or Follow device on Account → Appearance; every screen reads correctly in dark (EN and AR); paper and print previews stay light, with the light logo.
**Spec:** `PR-07-white-label-oklch-pos-shortcuts.md` → "6. Dark mode" and its Verification Gate; `THEMING_ARCHITECTURE_DESIGN.md` wins on conflict. Where they disagree with the code, this plan's rulings decide.
**Depends on:** PR-05 (done 2026-11-19; owner QA and commit pending). PR-07 tasks 1–13 (done).
**Tech:** Next.js 16, React 19, Tailwind v4, next-intl, Recharts, Jest.

## Progress

| Task | State | Date | Notes |
|---|---|---|---|
| 1 Tokens: dark only on screen; `[data-mode=LIGHT]` subtree | **Done** | 2026-11-19 | `tokens.css` and `themeStyleCss()`: light rule is `:root, [data-mode=LIGHT]`; DARK inside `@media screen`; SYSTEM inside `@media screen and (prefers-color-scheme: dark)`. Closes PR-05 review finding 6 (paper gets every light value). Tests red first (3), then theme + foundations 109/109. HQ has no token copy yet (HQ package B). |
| 2 Resolver and layout take the person's mode | **Done** | 2026-11-19 | `resolveTheme()` takes `user.ui_color_mode` (checked against `UI_COLOR_MODES`, else `SYSTEM`; signed out = `SYSTEM`); `ResolvedTheme.mode: UiColorMode`; `getTenantTheme()` selects the column; layout comment removed. Tests red first (resolver mode test; service test expects `DARK`); theme + service + preferences route 91/91. |
| 3 Appearance screen: mode choice | **Done** | 2026-11-19 | Keys `authSession.appearance.mode`, `modeHint`, `modeOptions.{LIGHT,DARK,SYSTEM}` EN/AR (none existed; no glossary term). Third choice on `account-appearance-screen.tsx`, in the dirty check and the save body. New test `__tests__/features/auth-session/account-appearance-screen.test.tsx` red first, then green. `check:i18n` passed. |
| 4 Charts read the tokens | **Done** | 2026-11-19 | `globals.css`: Recharts tooltip (surface-elevated, border, foreground; `!important` only for the inline box style), grid lines, axis lines and tick text, hover cursor read tokens. `TopServicesWidget` lost its fixed `#f0f0f0` grid and white tooltip. `cmx-line-chart` already used tokens. Test red first (`globals-css` charts test); foundations 29/29. |
| 5 Paper previews stay light on screen | **Done** | 2026-11-19 | `data-mode="LIGHT"` on the paper element (not the page backdrop) of all 11 `src/features` print components and of `app/dashboard/reports/print` and `reports/cash-variance/print` (they draw their own paper). `ready/[id]/print/[type]` and `b2b/statements/[id]` render receipt/details/statement components, now light, so their fixed grey `<style>` text reads on screen. `PrintItemLabels` is print-only (hidden on screen) and needs nothing after Task 1. Guard `__tests__/ui/foundations/paper-light.test.ts` scans every `*-print(-rprt|-screen).tsx`; shown red by removing one attribute. |
| 6 Dark logo in dark mode (ruling 6 = A) | **Done** | 2026-11-19 | File Util is committed (6b1d3bf2). Migration `0773_org_tenants_logo_dark_url.sql` written (`org_tenants_mst.logo_dark_url TEXT NULL`, `COMMENT ON`, no backfill: a DARK logo uploaded earlier is published the next time that slot changes). Owner applied 0773 (local + remote), regenerated types and pulled Prisma. Tests first (red, then green): File Util DARK delete clears only `logo_dark_url`, MAIN delete leaves it, MAIN→DARK move rewrites both; resolver, brand hook, theme service (`select` both logos) and the CSS rule. Code: `PUBLISHED_URL_PURPOSES` (TENANT_LOGO: MAIN + DARK), `ResolvedTheme.logoDarkUrl`, `TenantBrandProvider`, sidebar renders both images and `globals.css` `.cmx-logo-light/-dark` picks by `data-mode` (same selectors as `tokens.css`; print and light keep the main logo). Not done: the sign-in page brand cookie carries only the main logo. Tests 150/150 (theme, foundations, File Util); typecheck 0; ESLint 0. QA → M12. |
| 7 Dark sweep of every main screen (static) | **Done** | 2026-11-19 | Grep of `src` + `app` (stories excluded): inline colour styles, non-series `fill`/`stroke`, `bg-white`, `bg-black*`, `text-white`. Fixed: `CmxSummaryMessage` close hover `bg-black/5` → `bg-foreground/5` (invisible in dark). Fine as is: modal backdrops `bg-black/40–75`, camera view `bg-black`, chart series and legend colours, `CmxCard` has a border. Not dark-specific (same in light): `processing-piece-row.tsx:262` white on `rejectColor` (default green `#10B981`, about 2.5:1) — left for a follow-up. QA → "PR-07 task 6" rows M1–M12 written. |
| 8 Verification, review, docs | **Done** | 2026-11-19 | For Tasks 1–5 and 7: typecheck 0 errors; full ESLint `--quiet` 0; jest ui + theme + service + route + appearance + settings: 401/401 tests (only the 3 known `cmx-dialog-*` suites fail before any test); `check:i18n` passed; build passed (`npm run build`, 2026-11-19, includes the sidebar hotfix). Fresh read-only review (Review Focus 1–5) 2026-11-19: no Critical; focus 1, 3, 4, 5 hold in code. Fixed with failing tests first: (I1) sign-in page white wash `rgba(255,255,255,…)` and `border-on-solid` borders → `--cmx-surface-rgb` and `border-border`; (I2) light paper inherited dark-mode `color` → `[data-mode=LIGHT]{color}` rule, and the paper guard now also checks `app/**/print/page.tsx`; (m4) only a dark logo → shown in every mode. Deferred Minor: ~~Sonner toasts stay light~~ (fixed 2026-11-19 follow-up: `AppProviders` gets `mode`, Toaster `theme`); logout error paths use `router.push` (keeps the mode until reload); no `.recharts-legend-item-text` rule (legend uses series colours); no backfill in 0773. After fixes: foundations + theme 116/116, typecheck 0, ESLint 0, build passed (`npm run build`, 2026-11-19). STATUS result section and `PR-07_FEATURE_REFERENCE.md` → "Dark mode" written. |

After every task, update this table, the `STATUS.md` PR-07 row and `RESUME_CONTINUATION.md`. QA steps go only in `QA_TEST_GUIDE.md` → "PR-07 task 6".

## Checked against the code (2026-11-19)

- **Already in place:** `sys_users_mst.ui_color_mode` (NOT NULL, default `SYSTEM`, migration 0754); `PUT /api/v1/me/ui-preferences` accepts it (`uiPreferencesSchema`); `tokens.css` and `themeStyleCss()` already emit `[data-mode=DARK]` and `@media (prefers-color-scheme: dark){[data-mode=SYSTEM]}` blocks; `brand-palette.ts` computes and contrast-tests dark values for all ten HQ themes.
- **Missing:** `resolveTheme()` hard-codes `mode: 'LIGHT'` (`lib/theme/resolve-theme.ts:71`); `getTenantTheme()` does not select `ui_color_mode`; the Appearance screen has no mode control.
- **Print leak (PR-05 review finding 6):** the `@media print` block in `globals.css` resets only neutral tokens. With the screen in dark, brand tokens and status `-bg`/`-text` tokens keep dark values on paper.
- **Raw colours left after PR-05:** Tailwind palette classes and `bg-white` only in 6 `*.stories.tsx` files. Hex values in 24 files: series colours in 7 Recharts files (fine in dark), but `TopServicesWidget` hard-codes grid `#f0f0f0` and a white tooltip, and Recharts' default tooltip is a white box that inherits the page text colour (light in dark mode → unreadable). Two print pages (`app/dashboard/ready/[id]/print/[type]`, `app/dashboard/b2b/statements/[id]`) style text with fixed dark greys that also apply on screen.
- **Paper previews:** 14 `*print*` components/screens, 5 print routes. On a dark screen they would render as dark "paper".
- **Dark logo:** File Util purpose `TENANT_LOGO/DARK` exists (0757) and can be uploaded on Settings → Branding, but nothing reads it. Only `TENANT_LOGO/MAIN` is published to a URL column (`org_tenants_mst.logo_url`, `PUBLISHED_URL_PURPOSE` in `lib/services/file-util/file-util.service.ts`).

## Rulings (planning)

1. **Dark tokens apply only on screen.** Wrap the `[data-mode=DARK]` block in `@media screen`, and the SYSTEM block in `@media screen and (prefers-color-scheme: dark)`, in both `tokens.css` and `themeStyleCss()`. Paper then gets every light value (brand, status, neutrals) with no second copy to maintain; the existing `@media print` neutral reset (white paper, black text) stays. This closes PR-05 review finding 6. Cost: none on screen.
2. **Light is also a selector:** `:root` becomes `:root, [data-mode=LIGHT]` (tokens.css and `themeStyleCss()`), so any element with `data-mode="LIGHT"` forces a light subtree. Used for paper previews (Task 5). The `tokens-css` drift test checks the new selectors.
3. **Default stays `SYSTEM`** (the column default from 0754 and the spec). Consequence: on release, every person whose device is set to dark sees dark at once. Cost if wrong: complaints from people who did not choose it; fix is one click, or a data migration setting existing rows to `LIGHT` (not planned).
4. **Signed-out pages follow the device (`SYSTEM`).** No person is known, and the login page should match the device. The last-brand cookie keeps holding only brand data, not the mode (two people on one device must not share it).
5. **Charts are fixed once, in CSS, not per chart.** `globals.css` gets token rules for the Recharts classes (`.recharts-default-tooltip`, `.recharts-cartesian-grid line`, `.recharts-cartesian-axis-tick-value`, `.recharts-legend-item-text`, `.recharts-tooltip-cursor`). Recharts writes the tooltip style inline, so those two declarations need `!important` (one-line comment says why). `TopServicesWidget` drops its hard-coded grid and tooltip colours so the rules apply. Series colours stay.
6. **Dark logo — owner choice:**
   - **A (recommended):** publish `TENANT_LOGO/DARK` like MAIN: new column `org_tenants_mst.logo_dark_url` (migration, STOP for owner apply), `PUBLISHED_URL_PURPOSE` becomes a list of purposes per category with a target column each, `ResolvedTheme.logoDarkUrl`, sidebar shows it in dark (CSS swap with the ruling-1 selectors, no JS). It edits `file-util.service.ts`, which the File Util session also changes: do Task 6 only after that session's work is committed.
   - **B:** defer the dark logo; in dark mode the main logo sits on a small light plate (`bg-surface` chip) so dark ink stays visible. No migration. The DARK upload slot keeps doing nothing until A is done.
7. **Paper previews:** each print screen root gets `data-mode="LIGHT"` (ruling 2). The two pages with fixed grey `<style>` text then read correctly on screen too; no colour rewrite needed.
8. **No browser walk by the assistant.** Task 7 is a static sweep (grep for raw colours, inline `style` colours, `bg-white`, `text-white` on non-solid fills, `shadow` that relies on white). The owner's walk of every main screen in dark, EN and AR is in `QA_TEST_GUIDE.md`.

## Review Focus

1. Paper and print previews are light in every mode, including a non-STANDARD theme and forced DARK.
2. No screen shows light text on a light box or dark on dark (charts, tooltips, popovers, dialogs, toasts, POS, sidebar, login).
3. Signed-out pages and the first page after sign-in show the right mode; a second person on the same device does not inherit the first one's mode.
4. The mode saved on Appearance reaches `<html data-mode>` after save without a manual reload.
5. If ruling 6A: the published DARK URL is rewritten in the same transaction as every change to that slot, filtered by `tenant_org_id`, and cleared when the file is removed.

### Task 1: Tokens

- [ ] Test first (`__tests__/ui/foundations/tokens-css.test.ts`, `__tests__/lib/theme/theme-style.test.ts`): the DARK block sits inside `@media screen`, the SYSTEM block inside `@media screen and (prefers-color-scheme: dark)`, the light selector is `:root, [data-mode=LIGHT]`. See them fail.
- [ ] Change `src/ui/foundations/tokens.css` and `lib/theme/theme-style.ts`. Update the `globals.css` print comment.
- [ ] Run the foundations and theme tests.

### Task 2: Resolver and layout

- [ ] Test first (`resolve-theme` test): user `DARK` → `mode: 'DARK'`; user null → `SYSTEM`; unknown value → `SYSTEM`.
- [ ] `ResolveThemeInput.user` gains `ui_color_mode`; `ResolvedTheme.mode` type widens to `UiColorMode`; `getTenantTheme()` selects the column; the `DEFAULT_THEME` (no inputs) is `SYSTEM`.
- [ ] `app/layout.tsx`: drop the "stays LIGHT" comment. Check every other reader of `theme.mode` / `ResolvedTheme` (`last-brand.ts`, login page) still types.

### Task 3: Appearance screen

- [ ] `/i18n`: search existing keys for light/dark/system first; add `authSession.appearance.mode`, `modeHint`, `modeOptions.{LIGHT,DARK,SYSTEM}` in EN and AR only if none exist (glossary check).
- [ ] Add the third `Choice` to `account-appearance-screen.tsx`; include `ui_color_mode` in the dirty check and the save body; `router.refresh()` already re-renders `<html>`.
- [ ] Test: changing the mode enables Save and sends `ui_color_mode`. `npm run check:i18n`.

### Task 4: Charts

- [ ] Rules from ruling 5 in `globals.css`; remove fixed grid/tooltip colours in `TopServicesWidget.tsx`; check `cmx-line-chart.tsx` passes no fixed tooltip/grid colour.
- [ ] Test: a `globals-css` assertion that the Recharts tooltip rule reads tokens.

### Task 5: Paper previews

- [ ] Add `data-mode="LIGHT"` to the root element of every print screen and `*-print-rprt.tsx` listed in "Checked against the code", plus `app/dashboard/ready/[id]/print/[type]/page.tsx` and `app/dashboard/b2b/statements/[id]/page.tsx`.
- [ ] Test: one render test of `tax-document-print-rprt` asserting the attribute (cheap guard for the most legally sensitive document).

### Task 6: Dark logo (after the owner picks A or B)

- A: load `/database`, list `supabase/migrations/` and take last+1 at write time; column with `COMMENT ON`; STOP until the owner applies; Prisma pull; then the File Util change (test first: upload/replace/delete of DARK rewrites `logo_dark_url`), resolver field, sidebar swap.
- B: sidebar logo plate in dark only; one test.

### Task 7: Dark sweep (static)

- [ ] Grep `src` and `app` (stories excluded) for: hex or `rgb(` in `style={{…}}` colour props, `bg-white`, `text-white` not on a solid fill, `fill="#` / `stroke="#` outside series colours, `shadow-*` used as the only separator. Fix with tokens; list each in PLAN row 7.
- [ ] Write `QA_TEST_GUIDE.md` → "PR-07 task 6": the main-screen walk in dark (EN and AR), print preview and a tax document in dark, Follow device switching, sign-out/sign-in with two people.

### Task 8: Verification, review, docs

- [ ] `npx tsc --noEmit -p .`, `npx eslint . --quiet`, jest (theme, foundations, appearance, charts, File Util if 6A), `npm run check:i18n`, `npm run build`.
- [ ] One fresh read-only reviewer against Review Focus 1–5; fix Critical/Important with a failing test first.
- [ ] STATUS (PR-07 row + result section), RESUME, `PR-07_FEATURE_REFERENCE.md` (mode, routes, migration if 6A).

## Not in this package

- A per-Organization "force light" setting; per-device mode overrides (a cookie); a mode toggle in the top bar (Appearance only, per spec).
- Restyling chart series colours for dark.
- Storybook dark backgrounds (the 6 stories with raw colours).
