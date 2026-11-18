# PR-07 (tasks 1–5) — Theme Runtime: Catalogs, Organization Themes, User Preferences, Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, owner's standing choice) with one fresh whole-change review at the end. Steps use `- [ ]`.

**Status:** Approved by owner 2026-11-17 (all 9 planning rulings accepted). Running inline.
**Goal:** Every Organization's chosen theme (HQ preset plus plan-gated overrides) and every user's density and font size reach the page from the server, with no flash, plus the screens to manage them.
**Architecture:** Three HQ catalogs and one Organization table hold the data. A per-request server resolver (`lib/theme/resolve-theme.ts`) merges defaults, the HQ theme, the Organization's overrides and the user's preferences. The root layout writes the `data-*` attributes and one `<style>` block computed by the existing `computeBrandPalette()`. The screens are the Organization branding screen and the user appearance screen.
**Tech stack:** Next.js 16 App Router, Prisma, Supabase (service role for `sys_*` reads), next-intl, Cmx components, Zod, Jest.
**Spec:** `THEMING_ARCHITECTURE_DESIGN.md` (wins on conflict) → `PR-07-white-label-oklch-pos-shortcuts.md`. Out of scope here: PR-07 task 6 (dark mode, after PR-05).

## Progress

| Task | State | Date | Notes |
|---|---|---|---|
| 1 Colour checks, constants, types | Done | 2026-11-17 | `lib/constants/ui-theme.ts` (`UI_THEME_SEEDS`, modes, densities, scales, defaults, `UI_CATALOG_CODE_PATTERN`), `lib/validations/ui-theme.ts` (strict `uiPreferencesSchema`, `orgThemeInputSchema`), `seedAdjustments()` in `brand-palette.ts`. Tests: palette (now reads the seeds from the constants) + `__tests__/lib/constants/ui-theme.test.ts`, 65 pass; both failed first (module missing). Rulings below. |
| 2 Migration A — HQ catalogs and seeds | Done | 2026-11-17 | `0752_ui_theme_catalogs.sql` applied by the owner (local and remote), Prisma pulled. Remote check: 10 themes, 4 radius, 1 font pair. |
| 3 Migration B — Organization theme table | Done | 2026-11-17 | `0753_org_tenant_ui_theme.sql` applied by the owner (local and remote), Prisma pulled. Remote check: RLS on, 7 indexes, 0 rows (no Organization had custom colours). |
| 4 Migration C — user preference columns | Done | 2026-11-17 | `0754_sys_users_ui_prefs.sql` applied by the owner (local and remote), Prisma pulled; remote shows the columns with their defaults. |
| 5 Migration D — flags and logo purposes | Done | 2026-11-17 | `0757_ui_branding_flags.sql` applied (local and remote); remote check: `custom_branding` PRO+ENTERPRISE, `white_label` ENTERPRISE, 3 duplicates inactive, `DARK`/`FAVICON` purposes with their types. Constants synced: 3 keys removed from `feature-flags.ts` and `lib/types/tenant.ts`; `FILE_PURPOSES.TENANT_LOGO` + DARK, FAVICON. Platform inventory rebuilt (retired keys gone). Tests: feature-flag + file-util 44 pass. Rollback script in HQ repo. |
| 6 Resolver | Done | 2026-11-17 | `lib/theme/resolve-theme.ts` (pure `resolveTheme`), `lib/services/ui-theme.service.ts` (`getTenantTheme(tenantId, userId?)`, cached `getRequestTheme()`, `DEFAULT_THEME`), `lib/types/ui-theme.ts`, `getSessionIdentity()` split out of `getTenantIdFromSession` (same behaviour). Tests: resolve-theme 8/8 (RED first), ui-theme.service 3/3, tenant-context + session-guard 33/33. ESLint clean. Typecheck running in background. |
| 7 Layout wiring and login brand | Done | 2026-11-17 | Root layout: `data-density/font-scale/font` + `<style id="cmx-theme">` from `getRequestTheme()` (empty for plain STANDARD) + `TenantBrandProvider`. Last-brand cookie written by `/api/auth/login` and `/api/auth/choose-tenant` (`writeLastBrandCookie`, never fails sign-in); `app/(auth)/login/layout.tsx` + `LoginBrandProvider`; login page shows the Organization logo and name. `ResolvedTheme.logoUrl` (all plans); `lib/theme/tenant-brand.tsx` (`useTenantBrand`): sidebar logo/name and browser title use it. Tests: resolve-theme 9, theme-style 4, last-brand 4, ui-theme.service 5, tenant-brand 2 (RED first except 3 service cases); theme + foundations + navigation 113/113. Lint clean. |
| 8 Repoint readers, close the open PATCH | Done | 2026-11-17 | `getTenantPrimaryColor()` (never throws) in `ui-theme.service.ts`; `tenant-resolve.service.ts` and `customer-mobile-tenant.service.ts` take `primaryColor` from it and no longer select `brand_color_primary`. Test `__tests__/services/tenant-public-brand.test.ts` + service case, RED first; public/tenant suites 58/58; lint clean. PATCH already removed by another session (ruling). |
| 9 Branding screen | Done | 2026-11-17 | Service `lib/services/org-ui-theme.service.ts` (+ `getUiThemeCatalog`, `uiThemeErrorStatus`), route helpers `lib/services/org-ui-theme-http.ts`; routes `GET /api/v1/settings/branding` (themes + catalog + plan), `POST /themes`, `PATCH`/`DELETE /themes/[id]`, `POST /themes/[id]/activate`; old colour PUT, `updateTenantBranding` and `BrandingSettingsDto/Input` removed. Screen `src/features/settings/ui/branding/` (`branding-screen.tsx`, `theme-editor-form.tsx`, `theme-preview.tsx`), `api/branding-api.ts`, `hooks/use-branding.ts`; page is a thin wrapper. i18n `settings.brandingScreen.*` EN/AR (5 unused keys removed; line-level edit, the file has mixed line endings); `check:i18n` passes. Access contract `settings-access.ts` updated by hand (derive cannot see template paths), `check --wire` PASS, `sync` done. Tests: service 7, routes 7, form 4 (all RED first); settings + forms suites 64/64. Shared fix in `cmx-hex-color-field.tsx` (barrel import). Fixed a PR-02 test regression: `label-printing-settings-screen.test.tsx` lacked the Radix jsdom stubs. |
| 10 User appearance screen | Done | 2026-11-17 | `GET`/`PUT /api/v1/me/ui-preferences` (own row by session user id, strict schema, CSRF on PUT, 401 signed out), test 4/4 (RED first). Page `/dashboard/account/appearance` → `src/features/auth-session/ui/account-appearance-screen.tsx` (density incl. follow-Organization, text size; mode hidden; edits as draft state, no effect). Top bar menu item "Appearance" (test updated to 5 items). Contract in `auth-session-access.ts` (auth_only), `check --wire` PASS, sync done. i18n `authSession.appearance.*`, `layout.topBar.appearance` EN/AR; `check:i18n` passes; lint clean. Typecheck (after Task 9): only the 4 known pre-existing errors. |
| 11 Migration E — retire old colour columns | Done | 2026-11-17 | `0759_org_tenants_drop_brand_colors.sql` applied (local and remote), types and Prisma regenerated by the owner; remote check: 0 `brand_color*` columns left on `org_tenants_mst`. Full typecheck running (scratchpad `tsc-t11.txt`). |
| 12 HQ catalog screens and token sync (HQ repo) | Plan written, waiting for owner approval | 2026-11-17 | `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`: A1 registry entries (`ui-radius`, `ui-font-pairs`, `ui-themes`) on HQ's generic code-table engine + `appearance` hub group; A2 screens/i18n; B token sync + `--cmx-accent-rgb` rename (48 HQ files) split into its own package. Rulings there: reuse `catalog.view/manage`, font pairs not creatable from the screen, `cssLength` field type. Open owner choice: contrast check for new HQ themes. |
| 13 Verification, review, docs | Done | 2026-11-18 | Typecheck after the fix pass: only the 4 known errors. Typecheck (after Task 11): only the 4 known pre-existing errors. Full jest: 581/592 suites pass; failures = the 7 known (3 cmx-dialog, 3 payment, order-financial-view) + `api-route-auth-guard` (pre-existing, Task 7 ruling) + `request-permission-auth` (pre-existing: imports nothing PR-07 changed, last touched 2026-11-13) + 2 PR-02 test regressions now fixed (`workflow-action-bar-layout` expected tone `error` → `danger`; `session-screens` feedback mock lacked `CmxStatusBadge`). QA guide → PR-07 written (18 checks). Full ESLint `--quiet`: 0 errors (2026-11-18). Build: passed. Reviewer run 2 DONE 2026-11-18: C1 root layout keeps the previous user's theme/brand after client-side sign-in/out/switch (router.push); I1 activate vs concurrent delete can leave 0 active (2nd updateMany count unchecked); I2 after plan downgrade any edit nulls stored overrides. Fix pass DONE 2026-11-18, each RED→GREEN: C1 `auth-context-full-load.test.ts` (sign-in, choose-tenant, sign-out and session expiry now `window.location.assign`, a full page load); I1 `activate rolls back with NOT_FOUND when the target is gone at the switch`; I2 `an update that leaves out plan-gated fields keeps them as stored` + form `save leaves out the fields the plan does not include`. Suite: jest lib/services/features settings+auth-session/api v1/ui navigation/hooks 283/283 suites, 2886 tests; ESLint 0 on changed files. Deferred minors: M1 race loser P2002 → 500 instead of 409; M2 HQ-deactivated theme in use renders but its edit fails INVALID_CATALOG_CODE until another is picked; M3 sign-in waits for the brand cookie's theme read (measure); M4 customer-mobile list reads catalogs per Organization (already a shortcut); M5 logos outside Supabase public storage do not show on sign-in; M6 raw `<img>` in login/sidebar, Appearance page title English-only; M7 `ui_color_mode` accepted but unused until dark mode. Ruling: C1 fixed by a full page load rather than `router.refresh()` — a full load also drops every in-memory client state of the previous person — cost: one full reload after sign-in/out (a second or so). |

States: Not started → In progress → Done (checks passed) → Blocked (say why). After every task and every meaningful step: update this table, `STATUS.md` and `RESUME_CONTINUATION.md`, and write the docs before starting a long check.

## Checked against the code and the live database (2026-11-17)

- **Colour function exists** (PR-01): `lib/theme/brand-palette.ts` → `computeBrandPalette(primaryHex, secondaryHex): BrandPalette`, `contrastRatio`, `cssVarName`, `BRAND_TOKENS`. It does not report when it derived a shade different from the seed.
- **The logo now belongs to File Util** (File_Util Phase 5, built 2026-11-17). Category `TENANT_LOGO`, entity = tenant id, purposes `MAIN` and `RECEIPT`, write permission `settings:branding`. File Util decision 14 keeps `org_tenants_mst.logo_url` as the published URL of the `MAIN` file. The branding route `PUT /api/v1/settings/branding` now saves colours only (`primaryColor`, `secondaryColor`, `accentColor`) through `updateTenantBranding()`.
- **Permission:** `settings:branding` already exists and guards the branding PUT; `settings:read` guards GET. No new permission is needed.
- **Flags (live DB):**
  - `custom_branding` and `white_label` are clean booleans, but no plan enables them (`enabled_plan_codes` is empty; the `sys_ff_pln_flag_mappings_dtl` rows exist with `is_enabled=false`).
  - Their duplicates carry the plans: `tenant_branding_config` (object) is on PRO and ENTERPRISE, `tenant_white_label` is on ENTERPRISE. `white_label_enabled` is on no plan.
  - No app code reads any of them (types only).
  - Routes check plan flags with `checkPlanFlag(tenantId, key)` (`lib/services/plan-flags.service.ts`, RPC `hq_ff_get_effective_value`).
- **Grants rule (after 0745/0746):** `sys_*` tables stay closed to `anon` and `authenticated` and are read with the service role (`catalogReadClient`). `org_*` gets an explicit `GRANT SELECT` to `authenticated` plus a policy `tenant_org_id = (SELECT current_tenant_id())` (pattern: `0743`, `org_file_mst`). This replaces the design's "read by any signed-in user".
- **Root layout** already reads the tenant on the server per request: `getTenantTimeZone()` = `cache()` + `getTenantIdFromSession()` + Prisma. The resolver follows the same pattern.
- **Sign-in and sign-out run in the browser** (`lib/auth/auth-context.tsx`). There is no server route at sign-in.
- **Readers of `brand_color_*`:** `lib/services/tenant-profile.service.ts`, `lib/services/tenant-resolve.service.ts`, `lib/services/customer-mobile-tenant.service.ts`, `lib/types/tenant.ts`. HQ's readers are checked in Task 11.
- **Open hole (found by the File_Util session):** `PATCH /api/v1/tenants/me` spreads the raw request body into the `org_tenants_mst` update with no field allowlist, so any column (brand colours and `logo_url` included) can be written.
- **HQ** has no generic code-table engine: `products-items-config` uses its own `pic-*` screens plus a model registry.
- **Latest migration:** `0750_file_util_retire_product_images.sql`. Numbers are taken live, right before each file is written.

## Rulings made while planning

1. **Logos stay in File Util; the theme table has no logo columns.** The design's `logo_url`, `logo_dark_url` and `favicon_url` on `org_tenant_ui_theme_dtl` are dropped. The dark logo and favicon become two new File Util purposes on `TENANT_LOGO` (`DARK`, `FAVICON`), and `org_tenants_mst.logo_url` stays (it is File Util's projection, not a retired column). Logos therefore belong to the Organization, not to each saved theme. Cost if wrong: an Organization cannot keep a different logo per saved theme.
2. **Only colour columns retire** from `org_tenants_mst` in Task 11: `brand_color_primary`, `brand_color_secondary`, `brand_color_accent`. `logo_url` stays (ruling 1).
3. **User preferences are read on the server per request from the session, with no preference cookie.** Sign-in is in the browser, so a cookie would need extra sync calls. A per-request read (one primary-key lookup, `cache()`d) shows the signed-in person's values on a shared tablet by construction. Cost if wrong: one extra small query per page render; measure if it matters.
4. **Login-page brand cookie** (`cmx_last_brand`: logo URL, two seeds, app name; no ids, no personal data) is written by `POST /api/v1/ui-theme/last-brand`, which the browser calls once after sign-in. Sign-out does not clear it (the brand is not personal, design 5.2).
5. **Seed one font pair, `STANDARD`** (system Latin stack plus Noto Sans Arabic, the font already bundled). Each further pair needs bundled font files (licence, Arabic coverage, roughly 150 KB per family), so it waits for an owner request. The radius catalog gets all four presets.
6. **Flags:** `custom_branding` gets PRO and ENTERPRISE (copied from `tenant_branding_config`), and `white_label` gets ENTERPRISE (copied from `tenant_white_label`), in both `enabled_plan_codes` and the mapping rows. `tenant_branding_config`, `tenant_white_label` and `white_label_enabled` are set `is_active=false`, `rec_status=0`. `branded_receipts`, `branded_emails` and `receipt_branding_enabled` mean other things and are untouched. Cost if wrong: a plan gains or loses branding controls. The owner can change the plan list in HQ without a deploy.
7. **App name stays on the theme row** (`app_display_name`, `app_display_name2`), as designed.
8. **The user appearance screen is a new page, `/dashboard/account/appearance`,** linked from the top bar user menu. It is not in the sidebar, so it needs no navigation migration, but it does get a page access contract.
9. **`accentColor` disappears from the branding API** (design: accent is derived).

## Rulings made while executing

- **Task 1: no proposed seed needed adjusting.** PR-01's palette test already proved all ten pairs (and the hard cases) readable in both modes. The test now reads the seeds from `UI_THEME_SEEDS`, so the migration and the test share one list.
- **Task 1: `seedAdjustments` returns `{ primary, secondary }` (light mode),** not `{ primaryText, focusRing }`. The focus ring is the same shade as the primary text, so a second flag would always match. Dark mode is not offered until PR-07 task 6.
- **Task 1: theme, radius and font pair codes are not closed TypeScript lists.** They are HQ data (HQ adds rows without a deploy). The constants hold the defaults and the code pattern; Zod checks the pattern and the database checks the foreign key.
- **Task 1: the `ResolvedTheme` type moves to Task 6,** where it is first used.
- **Task 5: the favicon is PNG only.** ICO is not in `sys_file_mime_types_cd`, and `file-sniff.ts` cannot verify it. Every current browser accepts a PNG favicon. Cost if wrong: an Organization with only an `.ico` file must convert it.
- **Task 6: flags come from `getFeatureFlags(tenantId)`, not `checkPlanFlag`.** `checkPlanFlag` calls the flag RPC with the user's session client, and `feature-flags.service.ts` notes that browser sessions cannot execute those RPCs (0651/0652), so it would always answer false. `getFeatureFlags` uses the service role, applies per-Organization overrides, and caches for 5 minutes per process. Cost: a plan change shows up to 5 minutes late.
- **Task 6: the service test was written after the loader** and was not seen failing. The pure resolver test failed first.
- **Task 6: one auth check per page.** `getSessionIdentity()` returns tenant and user from the same validated session; `getTenantIdFromSession()` now calls it (no behaviour change).
- **Task 7: the last-brand cookie is set inside the two sign-in routes, not by a separate `/api/v1/ui-theme/last-brand` route (changes ruling 4).** Both routes already set the remember-me cookie at the moment the session is bound to an Organization; doing it there needs no extra browser request. The cookie is HttpOnly (only the server reads it).
- **Task 7: pre-existing test failures, not from PR-07:** `__tests__/security/api-route-auth-guard.test.ts` fails 2 cases at HEAD: `choose-tenant` already calls `get_user_tenants` but is not in its allow-list, and the File_Util session's 5 `/api/v1/file-util/*` routes lack the guard pattern.
- **Task 7: the server-rendered `<title>` template still ends in "— CleanMateX"** (`app/layout.tsx` metadata); the dashboard's client title bridge replaces it with the white-label name after load. `shortcut:` a `generateMetadata` in the root layout would fix the first paint; do it if a white-label customer notices.
- **Task 8: `PATCH /api/v1/tenants/me` was already removed by another session** (route header says so; GET only). Nothing to change.
- **Task 8: the branding page's own read/write (`tenant-profile.service.ts` `getTenantProfile().branding`, `updateTenantBranding`, `/api/v1/settings/branding`) moves in Task 9,** which replaces that API. Repointing only the read now would show STANDARD right after a save on the old page.
- **Task 8: `Tenant` type fields `brand_color_*` (`lib/types/tenant.ts`) are removed in Task 11** with the columns. Documents and receipts already read `logo_url` (the light MAIN logo).
- **Task 8: the mobile tenant-list change has no test of its own;** it is the same one-line swap as the slug resolve, which is tested.
- **Task 9: the whole branding screen has no render test;** its form (plan gating, adjusted-colour notice, NULL overrides, name required) is tested, and its service and routes are. Browser QA covers the list and dialogs.
- **Task 9: PR-02 broke test suites outside its run scope.** `label-printing-settings-screen.test.tsx` failed because the Radix select needs jsdom stubs; fixed. Task 13 runs the full jest to find any others.
- **Task 10: the appearance screen has no render test;** its route is tested (own row, three columns, refusals). Browser QA covers the screen.
- **Planning note corrected (Task 12):** HQ does have a generic code-table engine (`code-tables.registry.ts`); the catalogs are registry entries, not hand-built screens.
- **Task 13: `__tests__/auth/request-permission-auth.test.ts` fails and is not from PR-07** (its module imports nothing PR-07 changed; no uncommitted change in `lib/auth`). Left for its owner.
- **Task 13: three PR-02 test regressions outside PR-02's test run were fixed here** (label printing Radix stubs, workflow badge tone, sessions feedback mock).
- **Task 5: the dark logo allows the same types as the main logo** (JPEG, PNG, WebP), single slot.

## Global Constraints

- Never apply a migration. Write the file, stop, and wait for the owner to confirm it applied, then run `npm run prisma:pull` from the repo root.
- Never edit an existing migration. No `DROP … CASCADE`. `TEXT`, not `VARCHAR`. `COMMENT ON` every object. Full house audit column set on every new table.
- Every `org_tenant_ui_theme_dtl` query filters `tenant_org_id` in the query itself (Prisma `where`, nested writes, `updateMany`).
- Codes and values are UPPERCASE and identical in the database, the TypeScript constants and the `data-*` attributes: modes `LIGHT DARK SYSTEM`, densities `COMFORTABLE COMPACT`, font scales `SM MD LG`, radius `SHARP STANDARD SOFT ROUND`, theme codes as in design 6.3.
- Load `/database` before SQL, `/multitenancy` for `org_*`, `/backend` for routes, `/frontend` + `/i18n` for screens, `/create-feature-flag` for Task 5, `/refill-ui-access-contract-permissions` + `/rebuild-ui-access-contract` for the new page, `/storybook` for any new Cmx component.
- Cmx components only, `cmxMessage` for feedback, EN and AR keys aligned, RTL.
- The server enforces `settings:branding` and the plan flags again; screen checks are display only.
- No new cache layer (design 5.2).

## Review Focus

1. **A seed whose readable text shade differs from the seed** (for example `#facc15`): the branding screen says so beside the field when the colour is entered, and the saved theme renders readable text in light mode.
2. **Plan downgrade** (an Organization with overrides loses `custom_branding`): the page renders the HQ theme's values, not the stored overrides, and the overrides are kept for an upgrade.
3. **Two Organizations:** A cannot read, switch or delete B's saved themes through any route, including by passing B's theme id.
4. **Switching the theme in use under concurrent requests:** never zero or two active rows. The database index and the transaction together guarantee it.
5. **Shared tablet:** after user X signs out and Y signs in, the next page shows Y's density and font size, never X's.

---

### Task 1: Colour checks, constants, types

**Files:** Modify `lib/theme/brand-palette.ts`. Create `lib/constants/ui-theme.ts`, `lib/types/ui-theme.ts`, `lib/validations/ui-theme.ts`. Test `__tests__/lib/theme/brand-palette.test.ts` (extend), `__tests__/lib/constants/ui-theme.test.ts`.

**Produces:** `seedAdjustments(primaryHex, secondaryHex): { primaryText: boolean; focusRing: boolean }` (true when the derived readable shade differs from the seed). Constants `UI_COLOR_MODES`, `UI_DENSITIES`, `UI_FONT_SCALES`, `UI_RADIUS_CODES`, `UI_THEME_CODES`, `UI_THEME_SEEDS` (code → `{ primary, secondary }`, the ten from design 6.3), `DEFAULT_UI_THEME_CODE = 'STANDARD'`. Types `ResolvedTheme` (Task 6). Zod schemas `uiPreferencesSchema` and `orgThemeInputSchema`, built from the constants.

- [ ] Test first: for each of the ten `UI_THEME_SEEDS`, `computeBrandPalette` gives text on primary, primary-text on surface and secondary text at ≥ 4.5:1 in LIGHT and DARK. Hard cases `#facc15`, `#0f172a`, `#ffffff`, `#000000`, `#808080` hold the same. `seedAdjustments('#facc15', …).primaryText === true`; `seedAdjustments('#0E2A47', …).primaryText === false`.
- [ ] Run, watch it fail (`seedAdjustments` missing; a seed may fail contrast).
- [ ] Implement `seedAdjustments`. Any proposed seed that fails contrast is adjusted in `UI_THEME_SEEDS` (design 6.3: "adjusted, not shipped"), with a ruling line here giving the old and new hex.
- [ ] Constants test: every Zod enum equals its constant array.
- [ ] Green: `npx jest __tests__/lib/theme __tests__/lib/constants/ui-theme.test.ts`.

### Task 2: Migration A — HQ catalogs and seeds

**Files:** `supabase/migrations/{next}_ui_theme_catalogs.sql`.

- [ ] `sys_ui_radius_cd`, `sys_ui_font_pair_cd`, `sys_ui_theme_cd` exactly as design 6.1–6.3, with the full audit set. `CHECK` on `#RRGGBB` and on CSS lengths (`^[0-9]+(\.[0-9]+)?(px|rem)$`). One partial unique index per table on `(is_default) WHERE is_default AND rec_status = 1`. FKs `ON DELETE RESTRICT`.
- [ ] Seeds: radius `SHARP` (0/0/0), `STANDARD` (0.375/0.5/0.75 rem, the current `tokens.css` values; read them at write time), `SOFT`, `ROUND`; font pair `STANDARD`; the ten themes with Task 1's final seeds and EN/AR names and descriptions.
- [ ] RLS on, no policy for `anon`/`authenticated`, `REVOKE ALL FROM anon, authenticated`, `GRANT ALL TO service_role` (grants rule).
- [ ] **Stop.** Owner applies. Then `npm run prisma:pull`.

### Task 3: Migration B — Organization theme table

**Files:** `supabase/migrations/{next}_org_tenant_ui_theme.sql`.

- [ ] `org_tenant_ui_theme_dtl` as design 6.4 **without the three logo columns** (ruling 1). `UNIQUE (id, tenant_org_id)`. Partial unique `(tenant_org_id) WHERE is_active AND rec_status = 1`. Index `(tenant_org_id, rec_status, theme_name)`. FK to `org_tenants_mst(id)` RESTRICT. `default_ui_density` CHECK.
- [ ] RLS: `tenant_isolation_org_tenant_ui_theme_dtl` `USING (tenant_org_id = (SELECT current_tenant_id()))`. `GRANT SELECT` to `authenticated` (writes go through the server with Prisma). `REVOKE ALL FROM anon`.
- [ ] Data: for each tenant whose `brand_color_primary` or `brand_color_secondary` is set and differs from the old code defaults (`#3B82F6`, `#10B981`) or `STANDARD`'s seeds, insert one active row `ui_theme_code='STANDARD'` with those colours as overrides, `theme_name='Custom'`, `theme_name2='مخصص'`. Read the live counts first (expected: demo data only).
- [ ] **Stop.** Owner applies. Then `prisma:pull`.

### Task 4: Migration C — user preference columns

**Files:** `supabase/migrations/{next}_sys_users_ui_prefs.sql`.

- [ ] Add `ui_color_mode TEXT NOT NULL DEFAULT 'SYSTEM'`, `ui_density TEXT NULL`, `ui_font_scale TEXT NOT NULL DEFAULT 'MD'` to `sys_users_mst`, each with a `CHECK` and a `COMMENT ON`.
- [ ] **Stop.** Owner applies. Then `prisma:pull`.

### Task 5: Migration D — flags and logo purposes

**Files:** `supabase/migrations/{next}_ui_branding_flags.sql`, `lib/constants/feature-flags.ts`, `lib/constants/file-util.ts`.

- [ ] Flags per ruling 6: update `hq_ff_feature_flags_mst.enabled_plan_codes` and the matching `sys_ff_pln_flag_mappings_dtl.is_enabled` rows, and deactivate the three duplicates. Follow `/create-feature-flag` for the table and constant sync. Remove the three keys from `feature-flags.ts` and `lib/types/tenant.ts` once a search shows no reader.
- [ ] File Util purposes `DARK` and `FAVICON` on `TENANT_LOGO` in `sys_file_purpose_cd`, single-slot like `MAIN`. Read the 0743 seed shape and the allowed types at write time. The favicon needs ICO plus PNG. If ICO is not in the File Util type list, add it to that list in the same migration only if `file-sniff.ts` can recognise it; otherwise the favicon is PNG only, recorded as a ruling.
- [ ] Mirror `FILE_PURPOSES.TENANT_LOGO` in `lib/constants/file-util.ts`.
- [ ] **Stop.** Owner applies.

### Task 6: Resolver

**Files:** Create `lib/theme/resolve-theme.ts` (`server-only`), `lib/services/ui-theme.service.ts`. Test `__tests__/lib/theme/resolve-theme.test.ts`.

**Produces:**
- `resolveTheme(input: { hqTheme; orgTheme | null; customBranding: boolean; whiteLabel: boolean; user | null; radius; font }): ResolvedTheme`. This is pure; all the merging happens here.
- `getRequestTheme = cache(async (): Promise<ResolvedTheme>)`. It loads the tenant and user from the session, the active org row (`where: { tenant_org_id, is_active: true, rec_status: 1 }`), the HQ rows through `catalogReadClient`, and the two flags through `checkPlanFlag`, then calls `resolveTheme`. On any error it returns the `STANDARD` defaults (a page must never fail because of a theme).

`ResolvedTheme = { mode: 'LIGHT'; density; fontScale; fontCode; radius: { sm; md; lg }; seeds: { primary; secondary }; appName: string | null; appName2: string | null }`. `mode` is fixed to `LIGHT` until PR-07 task 6.

- [ ] Tests first, against `resolveTheme`:
  - no org row → `STANDARD`;
  - org row with overrides and `customBranding=false` → HQ theme values (Review Focus 2);
  - the same with `true` → overrides;
  - `appName` only with `whiteLabel`;
  - user density `null` → the org default → `COMFORTABLE`;
  - user values win;
  - signed-out → defaults;
  - `mode` is always `LIGHT`.
- [ ] Implement; green.

### Task 7: Layout wiring and login brand

**Files:** `app/layout.tsx`, create `lib/theme/theme-style.ts`, `app/api/v1/ui-theme/last-brand/route.ts`, `lib/auth/auth-context.tsx` (one call after sign-in), `app/(auth)/login/page.tsx`. Test `__tests__/lib/theme/theme-style.test.ts`, `__tests__/api/v1/ui-theme-last-brand.route.test.ts`.

**Produces:** `themeStyleCss(theme: ResolvedTheme): string`. It returns `:root{…light brand vars + radius}` `[data-mode=DARK]{…}` `@media (prefers-color-scheme: dark){[data-mode=SYSTEM]{…}}`, values from `computeBrandPalette`, variable names from `cssVarName`.

- [ ] Test first: the output contains each `BRAND_TOKENS` variable in all three blocks; no `<`; seeds that are not `#RRGGBB` are never interpolated (fall back to `STANDARD`).
- [ ] `layout.tsx`: `data-density`, `data-font-scale`, `data-font` from `getRequestTheme()`; `data-mode="LIGHT"`; `<style dangerouslySetInnerHTML>` with `themeStyleCss`; no script. The `STANDARD` theme with no overrides renders the same values as today's static `tokens.css`, so the output is unchanged for most Organizations.
- [ ] Last-brand route: `requirePermission`-free but session-required; reads the resolved brand plus the `MAIN` logo URL; sets `cmx_last_brand` (`HttpOnly=false` so the login page can read it on the server, `SameSite=Lax`, `Secure`, 180 days, JSON ≤ 1 KB). Test: no session → 401; the cookie holds no tenant id or email.
- [ ] Login page: reads `cmx_last_brand` on the server, validates it with Zod (drop it if invalid), shows its logo and app name, and applies its seeds through `themeStyleCss`. On a first visit it shows CleanMateX.
- [ ] Sidebar and top bar: show the Organization logo (`logo_url`) and app name when set.

### Task 8: Repoint readers, close the open PATCH

**Files:** `lib/services/tenant-profile.service.ts`, `lib/services/tenant-resolve.service.ts`, `lib/services/customer-mobile-tenant.service.ts`, `lib/types/tenant.ts`, `app/api/v1/tenants/me/route.ts`, `app/api/v1/settings/branding/route.ts`. Tests beside each service's existing tests.

- [ ] Test first: `PATCH /api/v1/tenants/me` with `{ brand_color_primary, logo_url, id, tenant_org_id }` changes none of them (an allowlist of the general-profile fields only). Watch it fail on today's code.
- [ ] Each reader takes colours from `getRequestTheme()`, or for non-request callers from a tenant-id variant `getTenantTheme(tenantId)` (same merge, same tenant filter). Documents and receipts use the light logo.
- [ ] The branding GET/PUT body becomes the theme API of Task 9. `accentColor` is gone (ruling 9).
- [ ] Green: the services' and routes' suites.

### Task 9: Branding screen

**Files:** `app/dashboard/settings/branding/page.tsx` (composes only), create `src/features/settings/ui/branding/*` (screen, saved-themes list, theme picker, overrides form, preview), `src/features/settings/api/branding-api.ts`, `src/features/settings/hooks/use-branding.ts`, routes `app/api/v1/settings/branding/themes/route.ts` (GET list, POST create), `themes/[id]/route.ts` (PATCH, DELETE), `themes/[id]/activate/route.ts` (POST), `catalog/route.ts` (GET HQ themes, radius, fonts). i18n `messages/{en,ar}/settings/branding*.json` (extend the existing namespace). Tests `__tests__/services/ui-theme.service.test.ts`, `__tests__/api/v1/settings-branding-themes.route.test.ts`, `__tests__/features/settings/branding-screen.test.tsx`.

- [ ] Service tests first:
  - `activateTheme(tenantId, id)` turns the old row off and the new one on in one transaction;
  - activating another tenant's id → NOT_FOUND (Review Focus 3);
  - deleting the active row → refused;
  - saving overrides without `custom_branding` → refused (`FEATURE_NOT_IN_PLAN`), and the same for the app name without `white_label`;
  - every query carries `tenant_org_id`.
- [ ] Routes: `settings:read` for GET, `settings:branding` + CSRF + rate limit for writes, Zod bodies from Task 1, flags checked again on the server.
- [ ] Screen:
  - HQ theme cards;
  - saved themes (create, rename, make active, delete; the active one has no delete);
  - overrides behind `custom_branding`, app name behind `white_label`; a disabled control says why (plan);
  - the logo, dark logo and favicon through `FileAttachments` (`TENANT_LOGO`, purposes `MAIN`/`DARK`/`FAVICON`);
  - a live preview box with the same variables on a scoped container;
  - the `seedAdjustments` notice beside the colour field as it is typed (Review Focus 1).
- [ ] Screen test: the notice appears for `#facc15`; the plan-gated fields are disabled with a reason when the flag is off.
- [ ] `settings-access.ts` updated through the access-contract workflow (new API dependencies).

### Task 10: User appearance screen

**Files:** create `app/dashboard/account/appearance/page.tsx`, `src/features/account/ui/appearance-screen.tsx`, `app/api/v1/me/ui-preferences/route.ts` (GET, PUT), the access contract plus registry entry, a top bar user menu item, and i18n. Tests: route and screen.

- [ ] Route test first: PUT updates only the caller's own row (`where: { id: session user id }`) and only the three columns; a body with `id`, `email` or another user's id changes nothing else; invalid values → 400.
- [ ] Screen: density (comfortable, compact, follow Organization) and font size. Mode is hidden until task 6. After save, `router.refresh()` so the server re-renders the `data-*` attributes.
- [ ] Shared-device check (Review Focus 5): a test that `getRequestTheme` reads the session user's row and that no preference is read from a cookie.

### Task 11: Migration E — retire old colour columns

- [ ] Search both repos (`cleanmatex`, `cleanmatexsaas`, including HQ tenant details, platform-api and mobile) for `brand_color_primary|brand_color_secondary|brand_color_accent`. Repoint any HQ reader first; that repoint is done from the HQ repo.
- [ ] `ALTER TABLE org_tenants_mst DROP COLUMN … RESTRICT` ×3 in a new migration. **Stop.** Owner applies. `prisma:pull`, then typecheck.

### Task 12: HQ (done from `cleanmatexsaas`, own plan)

- [ ] A short `PLAN_PR-07-HQ.md`, written in that repo after Task 2 is applied: list and edit screens for the three catalogs in the style of its `products-items-config` screens. A row in use cannot be deleted, only made inactive. Copy `tokens.css` and rename `--cmx-accent-rgb` usage. Add a check that fails when the two copies differ.

### Task 13: Verification, review, docs

- [ ] `npx eslint . --quiet`, typecheck in the background, `npm run check:i18n`, jest (`__tests__/lib __tests__/ui __tests__/api __tests__/services __tests__/features/settings`), `npm run build`.
- [ ] One fresh whole-change review (most capable model), given this plan's Review Focus. Critical and Important findings are fixed, each with a failing test first; Minors are logged.
- [ ] Docs:
  - `STATUS.md` PR-07 result;
  - `QA_TEST_GUIDE.md` → PR-07: no flash on hard reload with a non-`STANDARD` theme, two users on one tablet, plan downgrade, two Organizations, print and tax document in light, login page brand;
  - this feature folder's permissions, flags, migrations, routes and i18n keys;
  - `.clauderc` if a Cmx component is added;
  - `docs/features/File_Util` note for the two new purposes.
