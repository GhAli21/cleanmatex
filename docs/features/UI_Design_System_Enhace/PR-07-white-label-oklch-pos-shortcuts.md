# PR-07: Single-Seed OKLCH Tenant Brand Customization, Dark Mode & POS Power-User Shortcuts
**Branch:** `feat/pr-07-white-label-oklch-pos-shortcuts`
**Depends On:** `PR-06`
**Scope:** `supabase/migrations/`, `web-admin/app/layout.tsx`, `web-admin/app/globals.css`, `web-admin/src/features/settings/**`, `web-admin/src/features/orders/**`

## Objective
Allow tenants to customize their single primary brand color safely (without breaking contrast or semantic ERP status colors), activate Dark Mode, and add keyboard-first POS counter shortcuts.

## Tasks

### 1. Database & Zod Schema for Single-Seed Tenant Brand Color
- Add a nullable `brand_primary_color VARCHAR(32) NULL` column to the tenant branding/settings table (via a clean SQL migration under `supabase/migrations/` and Prisma schema update). `NULL` defaults cleanly to CleanMateX's standard blue (`#2563eb`).
- Add strict Zod v4 validation (`/^#([0-9a-fA-F]{6})$/` or valid `oklch(...)` string) in the tenant branding Server Action/API route (enforcing RBAC + `tenant_org_id` isolation).
- Cache `brand_primary_color` inside the tenant's Redis/L1 settings cache (with the same fault-tolerant DB fallback from PR-06) and invalidate on save.

### 2. Algorithmic OKLCH Theme Engine & Dark Mode Activation
- Remove `color-scheme: light only;` from `web-admin/app/globals.css` and activate `[data-theme="dark"]` semantic tokens.
- Implement CSS Relative Color Syntax (`oklch(from var(--tenant-seed) l c h)`) in `globals.css` to derive:
  - Full brand ramp (`--brand-50` through `--brand-950`)
  - Automatic WCAG AA button text (`--brand-on-primary: oklch(from var(--action-primary) clamp(0.15, (0.68 - l) * 1000, 0.98) 0.01 h)`), snapping to dark text if a tenant picks a bright color (e.g., yellow/lime) and white text if they pick a dark color (e.g., navy/crimson)
  - Subtle hue-harmonized dark mode surfaces (`--bg-canvas`, `--bg-surface`, `--border-subtle`)
- **Lock ERP Status Semantics:** Keep `success` (paid/ready), `warning` (pending/in-progress), `danger` (cancelled/overdue), and `info` fixed across all tenants so operational badges are never overridden by tenant brand colors.
- In `web-admin/app/layout.tsx` (Server Component), inject `data-theme` (from cookie) and `style={{ '--tenant-seed': tenant.brandPrimaryColor ?? '#2563eb' }}` directly on `<html>` with zero SSR FOUC.

### 3. Tenant Branding Settings UI (Live Preview & Guardrails)
- Build a **Brand Color Customization** card inside Tenant Branding Settings (`src/features/settings/**`) featuring:
  - Curated accessible preset swatches + native `<input type="color">` / hex input.
  - **Live Mini Preview Card** (showing a Primary CTA button, Active Sidebar item, Focus Ring, and a locked `"Paid"` status badge) that updates in real time via local `--tenant-seed` CSS override before saving.
  - One-click **"Reset to CleanMateX Default"** button (`brand_primary_color = null`).
- Add a Theme Switcher (`Light` / `Dark` / `System`) and Density Switcher (`Compact` / `Standard` / `Comfortable`) to the user menu.

### 4. Migrate Remaining Hardcoded Palette Utilities & Add POS Shortcuts
- Run a targeted pass across `src/ui/**` and `src/features/orders/**` replacing remaining hardcoded `bg-white`, `bg-gray-50`, `text-gray-900`, `border-gray-200` classes with semantic tokens (`bg-surface`, `bg-surface-muted`, `text-foreground`, `border-border`) so Light and Dark modes render cleanly.
- Add a scoped keyboard shortcut hook (`usePosHotkeys`) to New Order / POS Intake and Order Workspace screens (auto-disabled when focus is inside inputs/textareas):
  - `/` -> Focus item/garment search
  - `F2` -> Open `CustomerPickerModal`
  - `F9` -> Open Payment modal / full view
  - `Cmd/Ctrl + Enter` -> Submit / Save Order
  - `?` -> Open Keyboard Shortcuts Cheat-Sheet `CmxDialog`

## Verification Gate
- Test Light Mode, Dark Mode, and 3 extreme tenant brand seeds (`#0f172a` dark navy, `#facc15` bright yellow, `#e11d48` crimson) in both EN and AR to confirm WCAG contrast clamping, locked status badge clarity, and zero FOUC on reload.