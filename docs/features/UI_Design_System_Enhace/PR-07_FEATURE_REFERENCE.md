# PR-07 — Organization themes, sign-in brand, user appearance: reference

What PR-07 tasks 1–11 added, for anyone maintaining it. Design: `THEMING_ARCHITECTURE_DESIGN.md`. Plan and rulings: `PLAN_PR-07.md`. Manual checks: `QA_TEST_GUIDE.md` → PR-07.

## How a page gets its theme

`app/layout.tsx` calls `getRequestTheme()` (`lib/services/ui-theme.service.ts`, cached per request, never throws). It merges three layers, each one overriding the one before it:

1. **HQ theme:** `sys_ui_theme_cd`, with its corner style and font pair. If a code is missing, the `is_default` row is used, then the built-in `STANDARD` values.
2. **Organization theme:** the row of `org_tenant_ui_theme_dtl` that is in use. Colour, corner and font overrides apply only with the `custom_branding` flag. The app name applies only with `white_label`.
3. **User preferences:** `sys_users_mst.ui_color_mode / ui_density / ui_font_scale`.

The layout writes `data-mode`, `data-density`, `data-font-scale` and `data-font` on `<html>`. It also writes `<style id="cmx-theme">` from `themeStyleCss()`, which is empty for plain `STANDARD`. The palette comes from `computeBrandPalette`, the same function that generates `tokens.css`.

## Database (all applied 2026-11-17)

| Migration | What |
|---|---|
| 0752 | `sys_ui_radius_cd`, `sys_ui_font_pair_cd`, `sys_ui_theme_cd` (10 themes). Service role only. |
| 0753 | `org_tenant_ui_theme_dtl`: saved themes per Organization, at most one in use (`uq_otut_one_in_use`). Tenants can only read it; writes go through the API. |
| 0754 | `sys_users_mst.ui_color_mode`, `ui_density`, `ui_font_scale` |
| 0757 | Flags `custom_branding` (PRO, ENTERPRISE) and `white_label` (ENTERPRISE). Retires `tenant_branding_config`, `tenant_white_label` and `white_label_enabled`. Adds the `TENANT_LOGO` purposes `DARK` and `FAVICON`. Rollback script: `cleanmatexsaas/docs/Added_Feature_Flags_docs/Rollback_Scripts/0757_rollback_ui_branding_flags.sql`. |
| 0759 | Drops `org_tenants_mst.brand_color_primary/secondary/accent` |

## Permissions and flags

- `settings:read` lets a user load the branding screen.
- `settings:branding` lets a user create, edit, activate or delete a theme, and upload logos.
- The Appearance page needs only a signed-in user; each user edits only their own row.
- Flags are read with `getFeatureFlags(tenantId)`. The theme service checks them again on every write and on every render.

## Routes

| Route | Method | Purpose |
|---|---|---|
| `/dashboard/settings/branding` | page | Logos and saved themes |
| `/dashboard/account/appearance` | page | User density and text size |
| `/api/v1/settings/branding` | GET | Saved themes, catalog and plan |
| `/api/v1/settings/branding/themes` | POST | New theme |
| `/api/v1/settings/branding/themes/[id]` | PATCH, DELETE | Edit a theme, or delete it (not the one in use) |
| `/api/v1/settings/branding/themes/[id]/activate` | POST | Make a theme the one in use |
| `/api/v1/me/ui-preferences` | GET, PUT | Your own appearance |

Theme writes check CSRF, `settings:branding` and the rate limit (`lib/services/org-ui-theme-http.ts`). Error codes: `NOT_FOUND` 404, `FEATURE_NOT_IN_PLAN` 403, `THEME_IN_USE` 409, `INVALID_CATALOG_CODE` 400.

## Sign-in page brand

`/api/auth/login` and `/api/auth/choose-tenant` set the `cmx_last_brand` cookie (HttpOnly, SameSite lax, 180 days) with the main logo URL, the two seed colours and the app name (set only with `white_label`). `app/(auth)/login/layout.tsx` reads the cookie and checks it with Zod. It accepts a logo only from this project's public Supabase storage.

## Logos

Logos are File Util `TENANT_LOGO` files with the purposes `MAIN`, `RECEIPT`, `DARK` and `FAVICON`. `org_tenants_mst.logo_url` keeps the published `MAIN` URL. The sidebar, the browser title and the sign-in page read the logo and name from `useTenantBrand()` (`lib/theme/tenant-brand.tsx`).

## i18n keys

- `settings.brandingScreen.*`: the branding screen.
- `authSession.appearance.*`: the Appearance page.
- `layout.topBar.appearance`: the user menu item.

Removed: `settings.logo`, `logoGuidelines`, `brandColors`, `accentColor`, `accentButton`.

## Not here yet

- Dark mode: `mode` is always `LIGHT` until PR-07 task 6, after PR-05.
- HQ screens for the catalogs: `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`, waiting for owner approval.
