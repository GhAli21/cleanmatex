# Design System and Theming Architecture — Design

**Status:** Draft for owner approval · **Date:** 2026-11-16 · **App:** `cleanmatex` web-admin (with a synced copy to HQ)
**Relation to the PR docs:** `PR-01` … `PR-07` in this folder are the work packages. Where one disagrees with this document, this document wins. Order and state: `STATUS.md`.

## 1. Intent

Give CleanMateX one token-based design system with three control layers, and repair the current state in which tokens are referenced but never defined.

| Layer | Who | May change |
|---|---|---|
| Platform | HQ (the SaaS Backoffice) only | Token definitions, status colours, type scale, spacing, the list of radius and font presets |
| Organization | Tenant admin, plan-gated | Logo, favicon, app name, two brand seed colours, chosen radius and font preset, default density |
| User | Each person | Light / dark / system, density, font size |

## 2. Goals, non-goals, anti-goals

**Goals**
- Every colour, radius, font and spacing value on screen comes from a named token.
- An Organization's brand is applied to the whole app, the login page and printed documents from one source.
- No flash of the wrong theme on load; no theme JavaScript on the POS hot path.
- Dark mode, compact density and RTL work on every screen without per-screen fixes.
- HQ and the Organization app use the same token names.

**Non-goals**
- A full palette editor for Organizations (rejected: tenants could produce unreadable screens).
- A shared npm package between the two repos (a synced file is enough for now).
- Redesigning individual screens. This is foundation and migration, not new layouts.
- Theming email and notification templates (follow-up; not audited).

**Anti-goals**
- An Organization can never change status colours (success, warning, danger, info) or break text contrast.
- No new entries in the generic settings store (`sys_stng_*`) for appearance.
- No second token system living beside the new one after migration ends.

## 3. Current state (audit, 2026-11-16)

- Tailwind v4, no config file; `app/globals.css` registers only 6 colours in `@theme`.
- Cmx components use 49 `--cmx-*` variables in about 1,216 places; **none are defined** in web-admin, so all render from inline fallbacks that disagree (three "primary" blues, two radii).
- About 8,500 raw palette classes and 498 `bg-white`; about 190 semantic classes (`bg-primary`, `text-destructive` …) are no-ops.
- Dark mode forced off. No density or font scale. `ThemeConfig` / `applyThemeTokensToDom()` in `src/ui/foundations/tokens.ts` is never called.
- Brand colours are saved on `org_tenants_mst` but never applied to the UI; `brand_color_accent` is never read back.
- RTL depends on about 100 global override rules that double-flip some flex layouts; about 2,000 physical classes remain.
- `cn()` is hand-rolled without `tailwind-merge`, so class overrides depend on order.
- A duplicate shadcn component set is exported beside Cmx primitives; some variants render with no background.
- No `next/font`; Arabic font arrives by a render-blocking `@import`.
- HQ has a forked `src/ui` whose tokens are defined but named differently (`--cmx-accent-rgb` vs `--cmx-primary-rgb`).

## 4. Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Server-resolved CSS tokens: resolve on the server, write `data-*` attributes and seed variables on `<html>`, CSS derives the rest | No flash, no client theme code; brand changes appear on next navigation | **Chosen by owner** |
| B | Client theme provider computing the palette in JavaScript | Instant switching; flashes default theme, adds client work on every page | Rejected: poor fit for POS |
| C | Generated stylesheet per Organization | Fastest runtime; needs a generation and cache pipeline | Rejected: too heavy for a few variables |

Organization override depth: **curated presets** (owner's choice) — seeds plus HQ-published radius and font presets.

## 5. Architecture

### 5.1 Token layers (one stylesheet, owned by this repo)

1. **Primitive** — raw scales: neutral ramp, brand ramps, status ramps, spacing, radius, type sizes. Never used in components.
2. **Semantic** — meaning: `surface`, `surface-raised`, `text`, `text-muted`, `border`, `primary`, `primary-fg`, `secondary`, `danger`, `success`, `warning`, `info`, `focus-ring`. Registered in Tailwind `@theme` so `bg-primary`, `text-danger` etc. exist.
3. **Component** — only where a component needs its own knob (control height, table row height, card padding).

During the migration the existing `--cmx-*-rgb` variables are the source of truth, because about 1,200 places already read them as `rgb(var(--cmx-…-rgb))` and need a space-separated triplet, not a colour. The semantic Tailwind names are mapped from them. When the last direct reference is gone (end of PR-05) the variables are renamed to plain semantic tokens.

"Secondary" already means the neutral button style in the code, so the brand's second colour is called `brand-secondary` throughout.

**Brand colours are computed on the server, not in the browser.** One pure TypeScript function takes the two seeds and returns every brand-dependent value for both light and dark: the brand and secondary steps (base, hover, subtle), the text colours on them (`primary-fg`, `secondary-fg`, target 4.5:1), and the neutral surfaces and borders. The maths is done in OKLCH; the output is plain colour values any browser understands. The function is unit-tested, and because it is pure it also runs in the browser for the branding screen's live preview.

The seed is always used unchanged as the solid colour (buttons, active states); the text on it is white or dark, whichever is readable. Where the brand colour is used as text or a border on a surface, a darker (light mode) or lighter (dark mode) shade is derived until it is readable. When that derived shade differs from the seed, the branding screen says so beside the colour field at the moment of entry, so nothing is adjusted silently. With the `STANDARD` aqua this means buttons are aqua with dark text, and links are a deeper aqua.

The mode is chosen by `data-mode` on `<html>`. "System" is handled by a plain `@media (prefers-color-scheme: dark)` rule, so **no inline script is needed**.

Neutral surfaces and borders take a very small amount of the brand hue (OKLCH chroma capped at about 0.015) so the app does not look flat grey. Status colours are not tinted.

The typography utility classes that are used today but defined nowhere (`.cmx-type-page-title`, `.cmx-type-section-title`) are defined here, plus a KPI style with tabular numerals.

**Browser support.** The devices real customers will use are not known yet, so theming adds no browser requirement of its own. It avoids the newer CSS colour features (`light-dark()`, relative colour syntax) and relies only on custom properties, attribute selectors and media queries. The effective floor is therefore the one Tailwind v4 already sets for the whole app (about Safari 16.4, Chrome 111, Firefox 128); that figure is from memory and must be confirmed against Tailwind's documentation in the plan.

### 5.2 Runtime resolution

Order, lowest to highest: token defaults in CSS → the HQ theme the Organization chose (or HQ's default theme) → the Organization's own overrides on its active theme row (only if the plan allows) → user preference.

The layers do not overlap: the Organization sets brand, the user sets mode, density and font size. The only shared item is density, where the user value wins and `NULL` means "follow the Organization".

The root layout (server) writes:

```html
<html lang dir
      data-mode="LIGHT|DARK|SYSTEM"
      data-density="COMFORTABLE|COMPACT"
      data-font-scale="SM|MD|LG"
      data-font="<font pair code>">
  <head>
    <style>
      :root            { /* light brand values + radius values */ }
      [data-mode=DARK] { /* dark brand values */ }
      @media (prefers-color-scheme: dark) { [data-mode=SYSTEM] { /* dark brand values */ } }
    </style>
```

The `<style>` block holds only the computed values for this Organization (a few dozen variables). The token stylesheet itself is static and cached by the browser.

**Shared devices.** Counter tablets are shared by several cashiers. Sign-in overwrites the user-preference cookie from the signed-in person's `sys_users_mst` row; sign-out clears it. The Organization's brand is not personal and stays.

**Before sign-in.** The Organization is unknown on the login page until the person signs in (one person can belong to several Organizations). The login page therefore shows the brand of the Organization last used on that device, taken from a small non-sensitive cookie (logo URL, seeds, app name) written at sign-in, and the CleanMateX brand on a first visit. Branding the login page by custom domain or sub-domain is a separate feature and out of scope.

**Print and documents.** A `@media print` block forces light surfaces and black text whatever the screen mode, keeping the brand colour for headers. Server-generated documents (tax invoices, receipts) and the customer-mobile API read the same resolved theme and always use the light logo.

**Caching.** The active theme is one indexed row per Organization. It is read once per request and reuses whatever request-level sharing the tenant profile already has. No new cache layer is added unless measurement shows this read matters. If the tenant profile loader it rides on keeps anything beyond a single request, its key includes `tenant_org_id`, and saving or switching a theme refreshes that entry in the same operation so the change shows on the next page load.

**Other notes**

- User values are mirrored in one cookie so the server can render before any user query.
- Radius preset values come from the HQ catalog and are written as variables; font presets map to fonts bundled with `next/font`.
- The branding screen previews by scoping the same variables to a preview container. No second rendering path.

### 5.3 Density and POS speed

- `data-density` drives control height, row height and padding tokens. Compact is the Organization default candidate for counter screens.
- A touch-target token (`--cmx-touch-min`, 44px) replaces the scattered `min-h-[44px]`. Components that need finger-sized targets on touch devices use it under `@media (pointer: coarse)`, so a tablet gets finger-sized controls in either density and a desktop back-office user is not forced into oversized ones. No setting is needed. (Changed in PR-01: a blanket rule on every `button` and `input` was dropped because it also stretched switches, chips and icon buttons; components adopt the token in PR-04.)
- Brand colour used as text or as a focus ring has its own tokens (`primary-text`, `focus-ring`), darkened in light mode and lightened in dark mode until it reaches 4.5:1 on the surface. The solid `primary` stays the exact seed. Text on a solid brand colour (`primary-fg`) is white when readable, otherwise dark navy (`STANDARD` aqua gets dark text).
- Keyboard shortcut registry and POS ergonomics stay as specified in `PR-04`; this design only supplies the tokens they need.

## 6. Data model

All new tables carry the full standard audit set (`created_at/_by/_info`, `updated_at/_by/_info`, `rec_status`, `rec_order`, `rec_notes`, `is_active`, and the rest of the house set). Strings are `TEXT`. All codes and value strings are UPPERCASE, stored exactly as written, and mirrored by TypeScript constants and by the `data-*` attributes.

### 6.1 `sys_ui_radius_cd` — HQ radius presets (new)

| Column | Type | Notes |
|---|---|---|
| `code` | TEXT PK | seeded: `SHARP`, `STANDARD` (default), `SOFT`, `ROUND` |
| `name`, `name2` | TEXT | EN / AR label |
| `radius_sm`, `radius_md`, `radius_lg` | TEXT NOT NULL | CSS lengths, CHECK on format |
| `is_default` | BOOLEAN NOT NULL | exactly one true (partial unique index) |

### 6.2 `sys_ui_font_pair_cd` — HQ font pairings (new)

| Column | Type | Notes |
|---|---|---|
| `code` | TEXT PK | seeded: `STANDARD` (default) plus two or three more; the font families are chosen in the plan after a licence and Arabic-coverage check |
| `name`, `name2` | TEXT | EN / AR label |
| `font_family_en`, `font_family_ar` | TEXT NOT NULL | display only; files are bundled in code |
| `is_default` | BOOLEAN NOT NULL | exactly one true |

Both: read by any signed-in user, written only from HQ. Adding a new font family needs a deploy; HQ can enable, disable, rename and set the default without one. Radius is fully data-driven.

### 6.3 `sys_ui_theme_cd` — HQ ready-made themes (new)

Complete themes published by HQ. Every Organization, on any plan, can pick one. A theme is built from two seeds plus one radius preset and one font preset.

| Column | Type | Notes |
|---|---|---|
| `code` | TEXT PK | UPPERCASE, e.g. `STANDARD`, `OCEAN`, `EMERALD` |
| `name`, `name2` | TEXT | EN / AR label |
| `description`, `description2` | TEXT | EN / AR short description for the picker |
| `brand_color_primary` | TEXT NOT NULL | `#RRGGBB`, CHECK |
| `brand_color_secondary` | TEXT NOT NULL | `#RRGGBB`, CHECK |
| `ui_radius_code` | TEXT NOT NULL | FK → `sys_ui_radius_cd(code)` RESTRICT |
| `ui_font_pair_code` | TEXT NOT NULL | FK → `sys_ui_font_pair_cd(code)` RESTRICT |
| `is_default` | BOOLEAN NOT NULL | exactly one true; used by an Organization that has chosen nothing |

Read by any signed-in user, written only from HQ.

**Seeded themes.** `STANDARD` is the default: every Organization uses it until it chooses another, and an Organization with no row in `org_tenant_ui_theme_dtl` simply resolves to `STANDARD`.

| Code | Character | Primary seed | Secondary seed |
|---|---|---|---|
| `STANDARD` | CleanMateX brand (aqua and navy, from the brand specification) | `#0AB6D8` | `#0E2A47` |
| `OCEAN` | Classic business blue | `#2563EB` | `#0F172A` |
| `EMERALD` | Fresh green | `#059669` | `#064E3B` |
| `TEAL` | Calm teal | `#0D9488` | `#134E4A` |
| `ROYAL` | Purple | `#7C3AED` | `#1E1B4B` |
| `ROSE` | Crimson | `#E11D48` | `#4C0519` |
| `SUNSET` | Warm orange | `#EA580C` | `#7C2D12` |
| `GOLD` | Amber and brown | `#B45309` | `#451A03` |
| `SLATE` | Neutral blue-grey | `#475569` | `#0F172A` |
| `GRAPHITE` | Near-black, minimal | `#18181B` | `#52525B` |

The hex values other than `STANDARD` are proposals. Each must pass the contrast test in both light and dark before it is seeded; any that fails is adjusted, not shipped. All ten use radius `STANDARD` and font pair `STANDARD` unless the plan gives one a distinct character.

### 6.4 `org_tenant_ui_theme_dtl` — Organization themes (new)

Detail table of `org_tenants_mst`. An Organization may keep several saved themes; one is in use. Each row starts from an HQ theme (`ui_theme_code`) and may override parts of it. An empty override column means "use the HQ theme's value", so later HQ changes to that theme flow through.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_org_id` | UUID NOT NULL | FK → `org_tenants_mst(id)` |
| `theme_name`, `theme_name2` | TEXT NOT NULL | EN / AR name of the saved theme |
| `is_active` | BOOLEAN NOT NULL | **this theme is the one in use**; at most one true per Organization (partial unique index on `tenant_org_id` where `is_active` and `rec_status = 1`). Deletion uses `rec_status = 0`. |
| `ui_theme_code` | TEXT NOT NULL | FK → `sys_ui_theme_cd(code)` RESTRICT; the HQ theme this row starts from |
| `logo_url` | TEXT | light-surface logo; custom-branding tier |
| `logo_dark_url` | TEXT | dark-surface logo; falls back to `logo_url` |
| `favicon_url` | TEXT | white-label tier |
| `app_display_name`, `app_display_name2` | TEXT | replaces "CleanMateX" in title and sidebar; white-label tier |
| `brand_color_primary` | TEXT | override, `#RRGGBB`, CHECK; NULL = HQ theme's value; custom-branding tier |
| `brand_color_secondary` | TEXT | override, same rule |
| `ui_radius_code` | TEXT | override, FK → `sys_ui_radius_cd(code)` RESTRICT; NULL = HQ theme's value |
| `ui_font_pair_code` | TEXT | override, FK → `sys_ui_font_pair_cd(code)` RESTRICT; NULL = HQ theme's value |
| `default_ui_density` | TEXT | `COMFORTABLE` / `COMPACT`; NULL = `COMFORTABLE` |

Also: `UNIQUE (id, tenant_org_id)`, list index tenant-first, RLS by `tenant_org_id`, and every query filters `tenant_org_id` explicitly.

**Invariants**
- Switching the theme in use is one atomic operation (old row off, new row on, same transaction).
- The theme in use cannot be deleted or switched off on its own; another must be made active first.
- Logo and favicon uploads accept raster images only (PNG, WebP; ICO for the favicon), with type and size checked on the server. **SVG is not accepted**, which removes the script-injection risk without a sanitiser.

**Columns retired from `org_tenants_mst`** (pre-launch, so one source of truth instead of a compatibility copy): `logo_url`, `brand_color_primary`, `brand_color_secondary`, `brand_color_accent`. An Organization that already has a logo or non-default colours gets one active theme row (pointing at `STANDARD`, with its logo and colours kept as overrides); every other Organization gets no row and resolves to `STANDARD`. After that, then the columns are dropped in a later migration after all readers are repointed (branding service, `tenants/me` route, tax documents, customer-mobile API, HQ tenant details). Accent is not carried over; it is derived.

### 6.5 `sys_users_mst` — user preferences (new columns)

Stored on the person, so preferences follow the user across Organizations.

| Column | Type | Values | Default |
|---|---|---|---|
| `ui_color_mode` | TEXT NOT NULL | `LIGHT`, `DARK`, `SYSTEM` | `SYSTEM` |
| `ui_density` | TEXT NULL | `COMFORTABLE`, `COMPACT` | NULL = follow the Organization |
| `ui_font_scale` | TEXT NOT NULL | `SM`, `MD`, `LG` | `MD` |

A person may update only their own row's three columns, through a server route. `org_users_mst.preferences` (JSONB) is left untouched.

### 6.6 Gating

- **All plans:** pick any active HQ theme, and set the default density.
- **Custom branding** (logo, colour overrides, radius and font overrides): one existing plan flag.
- **White label** (favicon, app name, hiding the CleanMateX mark): one existing plan flag.
- The four overlapping flags found in `feature-flags.ts` are reduced to these two; which two survive is settled in the plan after reading the HQ flag catalog.
- User preferences are not gated.

## 7. Rollout

| Phase | Content | Visible result |
|---|---|---|
| 0 Foundation | Token stylesheet, `@theme` registration, `--cmx-*` aliases, `next/font`, `tailwind-merge` in `cn()`, remove duplicate shadcn exports, fix Cmx primitives that use raw palette | App looks consistent; no-op classes start working |
| 1 Theme runtime | Migrations 6.1–6.5, resolver, `<html>` attributes, cookie, rebuilt branding screen with saved themes and preview, user appearance screen (density, font size), logo in sidebar and login | Organization brand applied everywhere |
| 2 HQ | Theme, radius and font catalogs on HQ's existing code-table engine; token stylesheet synced to HQ; HQ token names aligned | HQ controls presets |
| 3 Migration | Codemod raw palette → semantic classes folder by folder (orders first: 1,686 uses); lint rule blocks new raw palette and physical direction classes; codemod physical → logical classes; delete the global RTL override block | Whole app themeable |
| 4 Dark mode and POS | Dark mode offered to users only when Phase 3 is complete; compact density and touch token; `PR-04` shortcuts | Dark mode, faster counter use |

Each phase ends with: eslint, typecheck, build, `check:i18n`, Storybook checked across (light, dark) × (EN, AR) × (comfortable, compact) using new toolbars, and STATUS and doc updates. Phase 2 also adds a check that fails when the token stylesheet in HQ differs from this repo's.

## 7a. External review (Gemini, 2026-11-16)

**Taken:** shared-device cookie handling; print and document rules; guard on deleting the theme in use; upload safety (done by refusing SVG rather than sanitising it); second foreground colour; brand-tinted neutrals; defining the missing typography classes; the Storybook matrix gate; the HQ token drift check.

**Not taken**
- Three-level cache with Redis and a 75 ms timeout — new infrastructure for a single indexed row, with no measurement behind it.
- A nonce-carrying inline script for "system" mode — replaced by a media query, which needs no script. (No Content-Security-Policy was found in the app config either.)
- Deriving colours in the browser with relative colour syntax — moved to the server so older browsers work.
- Moving POS keyboard shortcuts into Phase 1 and adding saved table views to Phase 4 — unrelated scope; shortcuts stay with `PR-04`.
- Fixes to `CmxMoneyText`, `CmxConfirmDialog`, `CmxSelectDropdown` and `CmxInput` ids in Phase 0 — not supported by the audit.
- Comfortable density at 44–48px for every control — oversizes back-office screens; solved by the pointer rule in 5.3.
- Storing docs under `docs/` and a new `docs/DESIGN_SYSTEM.md` — feature docs stay in this folder.
- Statements that uploads use Supabase Storage (the audit found MinIO) and the specific RLS function and permission names — unverified; settled in the plan against the real code.

## 8. Decisions made by the assistant (owner delegated)

- Drop `brand_color_accent`; accent is derived from the seeds.
- Move logo and brand colours off `org_tenants_mst` rather than keep two copies.
- `ui_density` on the user is nullable so an Organization default can exist.
- UPPERCASE codes and value strings everywhere (owner's direction for theme codes; extended to all values so there is one convention), so the database value, the TypeScript constant and the `data-*` attribute are the same string.
- Brand colours computed on the server so theming needs no newer browser than the app already does.
- Dark mode is the last thing switched on, because it looks broken until raw palette classes are gone.
- New font families need a deploy.

## 9. Left to the implementation plan

- Exact token names and values, and reconciling defaults with the brand specification (`docs/brand/clean_mate_x_brand_specifications_v_1.1.md`, aqua `#0AB6D8`), which matches no current code default.
- Permission codes for editing the Organization theme, and their migration.
- Which two feature flags survive.
- The sync mechanism for the token file to HQ.
- Whether the branding screen's logo upload route needs changes for the dark logo and favicon.

## 10. Not verified

- Counts are grep approximations and include comments.
- Email and notification templates were not audited for branding.
- Whether the current branding page enforces any plan flag.
- The live database was not queried; table facts come from migration files.
- Tailwind v4's exact minimum browser versions.
- What file types the current logo upload route accepts.
- The `STANDARD` seeds come from the audit's reading of the brand specification, not from my own reading of that file.
