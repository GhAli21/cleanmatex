# PR-07: Three-Layer Theme Runtime, DB Schema, Branding Screen, HQ Catalogs & Dark Mode
**Branch:** `feat/pr-07-theme-runtime`
**Depends On:** `PR-02`. The dark-mode switch (task 6) also waits for `PR-05`.
**Design:** `THEMING_ARCHITECTURE_DESIGN.md` in this folder (wins on any conflict). Read sections 5 and 6 before starting.
**Scope:** `supabase/migrations/`, `web-admin/prisma/`, `web-admin/app/layout.tsx`, `web-admin/lib/theme/**`, `web-admin/src/features/settings/**`, and `cleanmatexsaas/platform-web` for task 5.

> Rewritten 2026-11-16. The file name still says "pos-shortcuts"; POS shortcuts live in PR-04, not here.

## Objective
Implement the three control layers (HQ → Organization → User): the HQ catalogs with seeded themes, the Organization theme table, user preference columns, server-side resolution with no flash, the Organization branding screen and the user appearance screen, the HQ catalog screens, and finally dark mode.

## Rules that apply to every task
- Load `/database` before any SQL, `/multitenancy` for the `org_*` table, `/frontend` and `/i18n` for screens, `/backend` for routes and services.
- Migrations are written, never applied by the assistant. One migration at a time: take the next number by listing `supabase/migrations/` at that moment, write the file, stop, and wait for the owner to confirm it applied.
- Every object and column is documented in the migration (`COMMENT ON`). Strings are `TEXT`. Full audit column set on every new table. No `DROP … CASCADE`.
- Every query on `org_tenant_ui_theme_dtl` filters `tenant_org_id` explicitly.
- All codes and value strings are UPPERCASE and identical in the database, the TypeScript constants and the `data-*` attributes.

## Tasks

### 1. Migrations (in this order, each its own file)
1. **HQ catalogs and seeds**
   - `sys_ui_radius_cd` (`code` PK, `name`, `name2`, `radius_sm`, `radius_md`, `radius_lg`, `is_default`). Seed `SHARP`, `STANDARD` (default), `SOFT`, `ROUND`.
   - `sys_ui_font_pair_cd` (`code` PK, `name`, `name2`, `font_family_en`, `font_family_ar`, `is_default`). Seed `STANDARD` (default) plus two or three pairs chosen after a licence and Arabic-coverage check.
   - `sys_ui_theme_cd` (`code` PK, `name`, `name2`, `description`, `description2`, `brand_color_primary`, `brand_color_secondary`, `ui_radius_code` FK RESTRICT, `ui_font_pair_code` FK RESTRICT, `is_default`). Seed the ten themes in design section 6.3 with EN and AR names; `STANDARD` is the default. Every seeded pair of colours must pass the contrast test (task 2) in light and dark before the migration is written.
   - Each table: one partial unique index so only one row is the default; `CHECK` on colour and length formats; read for signed-in users, write for HQ only, following the RLS pattern of an existing `sys_*_cd` table.
2. **Organization theme table** — `org_tenant_ui_theme_dtl` exactly as design section 6.4, including `ui_theme_code` NOT NULL FK RESTRICT, nullable override columns, `default_ui_density` CHECK (`COMFORTABLE`, `COMPACT`), `UNIQUE (id, tenant_org_id)`, a partial unique index allowing one row in use per Organization, tenant-first list index, and RLS using the same tenant function the other `org_*` tables use (look it up; do not assume its name).
   - Data: one row in use for each Organization that already has a logo or non-default colours on `org_tenants_mst`, pointing at `STANDARD` with those values as overrides. Organizations with nothing custom get **no row** and resolve to `STANDARD`.
3. **User preferences** — add to `sys_users_mst`: `ui_color_mode` NOT NULL default `SYSTEM` (`LIGHT`, `DARK`, `SYSTEM`); `ui_density` NULL (`COMFORTABLE`, `COMPACT`; NULL follows the Organization); `ui_font_scale` NOT NULL default `MD` (`SM`, `MD`, `LG`).
4. **Permissions** — only if the existing settings permission does not already cover the branding screen. If new codes are needed they are `resource:action`, seeded in their own migration.
5. **Feature flags** — reduce the four overlapping branding flags to two (custom branding, white label) with `/create-feature-flag`. Find which are read today and which plans map to them before changing anything.
6. **Retire old columns (last, after task 3 is merged and verified)** — drop `logo_url`, `brand_color_primary`, `brand_color_secondary`, `brand_color_accent` from `org_tenants_mst` with `DROP COLUMN … RESTRICT`, in a separate migration, only after a search shows no remaining reader in either repo.

After each applied migration: `npm run prisma:pull` from the repo root.

### 2. Colour function and resolver (`web-admin/lib/theme/`)
- `compute-brand-palette.ts`: a pure function from two seed colours to every brand-dependent value for light and dark (brand and secondary base, hover, subtle; `primary-fg` and `secondary-fg` at 4.5:1 or better; tinted neutral surfaces and borders). Output is plain colour values, no CSS colour functions. It reports when a seed had to be clamped.
- Tests for it: the ten seeded themes plus hard cases (`#facc15` bright yellow, `#0f172a` near-black, `#ffffff`, `#000000`, a mid-grey), asserting contrast in both modes.
- `resolve-theme.ts`: token defaults → the Organization's HQ theme (or `STANDARD`) → the Organization's overrides (only if the plan flag allows) → the user's preferences. One read of the theme in use per request, filtered by `tenant_org_id`, reusing the request-level sharing the tenant profile already has. No new cache layer.
- TypeScript constants for every code and value in `web-admin/lib/constants/`, types in `web-admin/lib/types/`, and Zod schemas built from the same constants.

### 3. Wiring
- `app/layout.tsx`: write `data-mode`, `data-density`, `data-font-scale`, `data-font` on `<html>` and one `<style>` block with the computed values (`:root`, `[data-mode=DARK]`, and `@media (prefers-color-scheme: dark) { [data-mode=SYSTEM] }`). No inline script. Until task 6, `data-mode` is always `LIGHT`.
- Cookies: sign-in overwrites the user-preference cookie from the person's `sys_users_mst` row; sign-out clears it. A second small cookie holds the last Organization's public brand (logo URL, seeds, app name) for the login page; it contains nothing sensitive.
- Show the Organization logo and app name in the sidebar, top bar and page title; show the last-used Organization's brand on the login page, CleanMateX on a first visit.
- Repoint every reader of the old columns to the resolver: `lib/services/tenant-profile.service.ts`, `app/api/v1/tenants/me/route.ts`, `lib/services/tax-document-read.service.ts`, `lib/services/customer-mobile-tenant.service.ts`, and the HQ tenant details screen. Documents and receipts always use the light logo. Search both repos for any other reader before task 1.6.

### 4. Screens (Cmx components only, EN and AR, `cmxMessage` for feedback)
- **Organization branding** (replace `app/dashboard/settings/branding/page.tsx`; the page composes a screen from `src/features/settings/ui/`):
  - Pick an HQ theme (all plans). Saved themes list: create, rename, make active, delete. The theme in use cannot be deleted; switching is one atomic server operation.
  - With the custom-branding flag: logo, dark logo, colour overrides, radius and font overrides, default density. With the white-label flag: favicon, app name. Controls a plan does not include are shown disabled with the reason.
  - A live preview box that applies the same variables locally, using the same colour function.
  - When a colour is clamped for contrast, say so beside the field at that moment.
  - Uploads: PNG and WebP (ICO for the favicon), type and size checked on the server. SVG is refused. The existing upload route uses MinIO; extend it, do not add a second one.
  - Server side enforces the plan flag and permission again; the screen checks are for display only.
- **User appearance**: light / dark / system (hidden until task 6), density (comfortable / compact / follow Organization), font size. A route that updates only the caller's own three columns.
- If the branding route or its menu entry changes, follow `/navigation` (config and migration together) and the access-contract workflow.

### 5. HQ (`cleanmatexsaas`, done from that repo)
- Manage the three catalogs with HQ's existing code-table engine. A theme or preset in use cannot be deleted, only made inactive.
- Copy the token stylesheet from this repo, rename HQ's `--cmx-accent-rgb` usage to match, and add a check that fails when the two copies differ.

### 6. Dark mode (only after PR-05 is complete)
- Let `data-mode` take the user's value and show the mode choice on the user appearance screen.
- Walk every main screen in dark, EN and AR.

## Verification Gate
- `npm run typecheck`, `npx eslint . --quiet`, `npm run build`, `npm run check:i18n`, the colour-function tests, and a tenant-isolation test showing one Organization cannot read or change another's themes.
- No flash of the default theme on a hard reload with a non-`STANDARD` theme in use.
- Two users on one device: the second user's sign-in does not show the first user's preferences.
- Print preview and a generated tax document while the screen is in dark mode: both are light, with the light logo.
- An Organization with no theme row renders `STANDARD`.
- A plan without custom branding cannot save overrides through the API.
- Update `STATUS.md`, the feature docs (permissions, flags, migrations, i18n keys, routes, constants) and the QA steps the owner can run.
