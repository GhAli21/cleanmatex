---
name: preference_kind_tabs_icons_and_bg_mode
overview: Render catalog MDI icons on new-order preference kind tabs; add a single code-level switch for inactive-tab color (dot vs full tab background); fix kind_code merge bug in the catalog service.
todos:
  - id: fix-kind-code-merge
    content: In preference-catalog.service.ts getPreferenceKinds, use s.kind_code (or cf?.kind_code ?? s.kind_code) instead of cf.kind_code when cf may be undefined
    status: completed
  - id: tab-bg-mode-constant
    content: Add a typed constant in preferences-panel (or tiny lib/constants/orders file) e.g. PREFERENCE_KIND_INACTIVE_COLOR_MODE = 'dot' | 'full_tab'
    status: completed
  - id: tab-ui-icons-and-bg
    content: preferences-panel.tsx — render MDI <i> when kind.icon matches safe mdi-* pattern; branch inactive styling on the constant (dot vs full background + contrast text)
    status: completed
  - id: verify-build
    content: Run npm run build in web-admin
    status: completed
---

# Preference kind tabs — icons + inactive background mode

## Context

- Catalog stores **MDI class suffixes** in `icon` (e.g. `mdi-tune`, `mdi-package-variant`) and **hex** in `kind_bg_color` (see `sys_preference_kind_cd` / pgAdmin screenshot).
- Global MDI CSS is already loaded in [`web-admin/app/globals.css`](web-admin/app/globals.css); same pattern as [`web-admin/src/features/orders/ui/product-card.tsx`](web-admin/src/features/orders/ui/product-card.tsx): `<i className={\`mdi ${icon}\`} />`.
- Today in [`web-admin/src/features/orders/ui/preferences-panel.tsx`](web-admin/src/features/orders/ui/preferences-panel.tsx): **active** tab uses full `kind_bg_color` on the button; **inactive** tabs only show a **small dot** when a color exists. **Icons from DB are not rendered.**

## 1. Render `icon` when present

**File:** [`preferences-panel.tsx`](web-admin/src/features/orders/ui/preferences-panel.tsx) (kind tab row).

- If `kind.icon` is a non-empty string and matches a safe pattern (e.g. `^mdi-[a-z0-9-]+$` — align with seeded values, reject arbitrary classes), render:

  `<i className={cn('mdi', kind.icon, 'shrink-0 text-base', ...stateClasses)} aria-hidden="true" />`

- Place **before** the label (respect RTL: existing flex + `flex-row-reverse` on the tab bar should order icon + text correctly; if not, use logical margin `me-1` / `ms-1`).
- **Contrast:** with active full-color background use light icon (`text-white`); inactive **dot mode** use muted icon; inactive **full_tab mode** (below) use `text-white` on colored pill.

## 2. Code parameter — inactive tab: dot vs full background

**Goal:** One explicit **TypeScript constant** (not DB) so developers can switch behavior without env.

**Suggested shape** (name can be adjusted in implementation):

```ts
/** Inactive tabs: show catalog color only as accent dot, or as full tab background. */
export const PREFERENCE_KIND_INACTIVE_COLOR_MODE = 'dot' as const;
// alternative: 'full_tab'
```

- **`'dot'` (default, current):** Unchanged behavior for inactive: white/light tab, optional colored dot when `kind_bg_color` set; active tab keeps full `kind_bg_color` + white text.
- **`'full_tab'`:** When `kind_bg_color` is set on an **inactive** tab, apply `style={{ backgroundColor: kind.kind_bg_color }}` to the whole button (same as active), with **white** (or contrast-safe) label + icon. **Active** tab should still read as selected: e.g. `ring-2 ring-offset-1 ring-blue-600` (or `shadow-md` + `scale-[1.02]`) so it is distinguishable from inactive colored pills.

Edge cases:

- No `kind_bg_color`: keep neutral gray/white styling for both modes.
- `full_tab` + very light hex: optional follow-up is relative luminance helper; **v1** can document “use saturated hex in catalog” or reuse a tiny contrast helper if one exists in the repo.

**Placement:** Prefer a **single const at top of `preferences-panel.tsx`** to keep scope minimal; only extract to `lib/constants/orders-preferences-ui.ts` if you want reuse from Storybook/tests.

## 3. Service bug (still required)

In [`preference-catalog.service.ts`](web-admin/lib/services/preference-catalog.service.ts) `getPreferenceKinds`, merged `kind_code: cf.kind_code` throws when `cf` is undefined (tenant has no `org_preference_kind_cf` row). Use `s.kind_code` or `cf?.kind_code ?? s.kind_code`.

## 4. Verification

`cd web-admin && npm run build`

## Out of scope (unless you ask later)

- Per-tenant `icon` override (needs new column + migration + admin form).
- Wiring GET `quickBarOnly` query param in [`preference-kinds/route.ts`](web-admin/app/api/v1/catalog/preference-kinds/route.ts) (currently hardcoded `true`).
