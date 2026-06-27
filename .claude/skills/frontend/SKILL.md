---
name: frontend
description: Frontend development standards for Next.js 15, React 19, TypeScript, Tailwind CSS, Cmx Design System. Use when creating components, pages, forms, or frontend code.
user-invocable: true
effort: low
agents:
---

# CleanMateX Frontend Standards

## CRITICAL Rules

1. **Always use cmxMessage** for all messages, errors, alerts
2. **Pagination must be server-side** (API-driven)
3. **Use CmxEditableDataTable** for editable tables
4. **NEVER create `components/` folder** - use `src/ui/` or `src/features/*/ui/`
5. **Routes visible in the system menu MUST go through `/navigation` skill** — any new route, renamed route, moved route, or removed route that appears (or should appear) in the sidebar/system menu requires the **dual-write** workflow: update `web-admin/config/navigation.ts` AND generate a `sys_components_cd` migration. Load `/navigation` BEFORE touching `app/**/page.tsx` for a menu-visible route. See [Routes & Navigation Menu](#routes--navigation-menu) below.
6. **React lint (mandatory before done)** — Read `docs/dev/rules/react-lint-verification-checklist.md`. Effects/Link: `react-effects-patterns.md`. RHF/TanStack/a11y: `react-rhf-and-table-lint.md`. Run `cd web-admin && npx eslint . --quiet` (must be 0). No `setState` in `useEffect`; no `form.watch()` — use `useWatch`; internal links → `next/link`.

## Folder Structure

```
app/            # Next.js App Router (routing only - page.tsx, layout.tsx)
src/
  ui/           # Global Cmx Design System (Cmx* prefix REQUIRED)
    primitives/      # CmxButton, CmxInput, CmxCard
    data-display/    # CmxDataTable, CmxKpiCard
    forms/           # CmxForm, CmxFormField
    navigation/      # CmxAppShell, CmxBreadcrumbs
  features/     # Feature modules (domain-specific)
    orders/
      ui/            # OrderListScreen, OrderFilters
      api/           # orders-api.ts
      hooks/         # use-orders.ts
      model/         # order-types.ts
lib/            # Shared infrastructure (api, supabase, hooks, utils)
```

## Path Aliases

```typescript
import { CmxButton } from '@ui/primitives/cmx-button'
import { OrderListScreen } from '@features/orders/ui/order-list-screen'
import { apiClient } from '@lib/api/client'
```

**DO NOT** create other paths like `@/components` or `@/core`.

## Component Placement Rules

### Reusable UI → `src/ui/` with `Cmx` prefix
Components that are:
- Reused across multiple features
- Generic in nature (button, input, table, layout)

Examples: `CmxButton`, `CmxInput`, `CmxForm`, `CmxDataTable`, `CmxPageHeader`

### Feature-Specific UI → `src/features/<module>/ui`
Components containing business/domain logic:
- `OrderStatusBadge`
- `CustomerTierBadge`
- `OrderListScreen`
- `TenantSettingsForm`

### Routes → `app/`
Only use for routing and composition:

```tsx
// app/dashboard/orders/page.tsx
import { OrderListScreen } from '@features/orders/ui/order-list-screen'

export default async function OrdersPage() {
  return <OrderListScreen />
}
```

## Routes & Navigation Menu

**Hard gate — load `/navigation` before writing route code that affects the menu.**

Any route that is (or will be) visible in the sidebar / system menu is governed by the `/navigation` skill. The frontend route file (`app/**/page.tsx`) is only **one of three** artifacts that must stay in sync:

| Artifact | Owned by | Required for menu visibility |
|---|---|---|
| `app/<segment>/page.tsx` | this skill (`/frontend`) | Yes — the actual Next.js route |
| `web-admin/config/navigation.ts` | `/navigation` skill | Yes — drives the React sidebar |
| `supabase/migrations/{seq}_nav_*.sql` (`sys_components_cd`) | `/navigation` skill | Yes — drives RBAC, permission checks, navigation API |

### When to load `/navigation`

Load `/navigation` BEFORE writing code in any of these cases:

- **Adding a new page** that should appear in the sidebar (e.g. new `app/dashboard/<feature>/page.tsx` that users navigate to)
- **Renaming a route segment** that is reflected in the menu label or URL
- **Moving a route** under a different parent section (re-parenting in the menu tree)
- **Converting a flat link into an expandable section** (or vice versa)
- **Changing which roles/permissions** can see a menu entry
- **Removing a route** that is currently in the menu

### When `/navigation` is NOT required

- The route is **internal/hidden** (detail pages like `[id]`, modals routed via URL, debug-only pages) AND is not in `sys_components_cd`
- You are editing the **body** of an existing page that already has its navigation entry wired
- You are creating a **component** under `src/features/<module>/ui/` without adding a new route

### Workflow when both skills apply

1. Load `/navigation` first — it governs the dual-write contract.
2. Load `/frontend` for component/page implementation rules.
3. Create the `app/<segment>/page.tsx` per `/frontend` rules.
4. Update `web-admin/config/navigation.ts` per `/navigation`.
5. Generate the `sys_components_cd` migration per `/navigation` (do NOT apply it — stop and ask the user to review).
6. If permissions are new, also follow CRITICAL RULE #11 (permission migration).

> Skipping the navigation skill for a menu-visible route causes **sidebar/DB drift**: the link appears in code but RBAC denies access, or RBAC allows it but the sidebar never shows it. Both are silent bugs.

## Styling Rules

### DO
- Use CSS variables: `rgb(var(--cmx-primary-rgb))`
- Use Tailwind for layout/spacing: `flex`, `grid`, `gap-4`, `p-4`
- Support RTL with Tailwind: `ml-4 rtl:ml-0 rtl:mr-4`

### DO NOT
- Hardcode brand colors: `text-blue-500`, `bg-red-500`
- Use hex codes directly: `#1d4ed8`, `#ef4444`
- Import shadcn/ui directly in features (wrap as Cmx in `src/ui` first)

## Internationalization (i18n)

### Always Re-Use Keys

```typescript
import { useTranslations } from 'next-intl';

export default function OrdersPage() {
  const tCommon = useTranslations('common');  // For common keys
  const t = useTranslations('orders');        // For feature keys

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{tCommon('save')}</button>
    </div>
  );
}
```

**CRITICAL:**
- Always search for existing message keys before adding new ones
- Use `tCommon()` for common keys like save, cancel, delete
- Update matching files under `web-admin/messages/en/**` and `web-admin/messages/ar/**` when adding translations

### RTL Support

```tsx
// Direction-aware spacing
<div className="ml-4 rtl:ml-0 rtl:mr-4">Content</div>

// Direction-aware icons
<ChevronRight className="rtl:rotate-180" />
```

## Import Rules (Always Apply — ESLint enforced)

### CORRECT
```typescript
import { CmxButton } from '@ui/primitives'
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'
import { CmxTabsPanel } from '@ui/navigation'
import { CmxDataTable } from '@ui/data-display'
import { CmxProgressBar, CmxSummaryMessage } from '@ui/feedback'
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms'
import { OrderListScreen } from '@features/orders/ui/order-list-screen'
import { supabaseClient } from '@lib/supabase/client'
```

### FORBIDDEN (will fail `npm run build`)
```typescript
import X from '@ui/compat'            // NO - removed, causes build failure
import Y from '@/components/ui'       // NO - doesn't exist
import Z from '@/components/ui/*'     // NO - doesn't exist
import W from '@/app/components/...'  // NO - never import from app
import V from '@/components/...'      // NO - components folder doesn't exist
```

> Full import snippets per component type: see `.claude/docs/web-admin-ui-imports.md`

## Common Patterns

### Server-Side Pagination

```typescript
// API endpoint returns paginated data
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const { data, total } = await getOrders({ page, pageSize });

  return Response.json({ data, total, page, pageSize });
}
```

### Using CmxDataTable

```tsx
import { CmxDataTable } from '@ui/data-display/cmx-datatable';

<CmxDataTable
  columns={columns}
  data={data}
  pagination="server"  // REQUIRED for server-side
  totalRows={total}
  onPageChange={handlePageChange}
/>
```

## Report Naming Convention (Always Apply)

When building or implementing a **report** (screen, component, page, tool):

- Name pattern: `{feature}-{report-name}-rprt`
- Examples: `orders-payments-print-rprt.tsx`, `customers-summary-rprt.tsx`, `financial-monthly-rprt.tsx`
- Apply to ALL report artifacts: component files, screen names, route segments, tool names
- The `-rprt` suffix identifies it as a report and separates it from regular UI components

❌ `orders-payments-print.tsx` — missing suffix
✅ `orders-payments-print-rprt.tsx` — correct

## Additional Resources

- [architecture.md](./architecture.md) - Complete architecture rules and folder structure
- [standards.md](./standards.md) - Detailed frontend coding standards
- [ui-blueprint.md](./ui-blueprint.md) - UI layer blueprint
- [uiux-rules.md](./uiux-rules.md) - UI/UX design guidelines
- [react-effects-patterns.md](../../../docs/dev/rules/react-effects-patterns.md) - Effects, Next `Link`, memoization ESLint
- [react-rhf-and-table-lint.md](../../../docs/dev/rules/react-rhf-and-table-lint.md) - useWatch, TanStack Table, a11y, exports
- [react-lint-verification-checklist.md](../../../docs/dev/rules/react-lint-verification-checklist.md) - Pre-submit agent checklist

## Dashboard `*-access.ts` (load `/rebuild-ui-access-contract` first)

**Do not hand-author large `*-access.ts` blocks from memory.** Use scripts + golden path (`.cursor/rules/ui-access-contract-pattern.mdc`).

### New dashboard route

1. Permission migration + `lib/constants/permissions/{domain}-perm.ts` (if new codes)
2. **`/navigation`** dual-write if menu-visible (`navigation.ts` + `sys_components_cd` migration)
3. `app/dashboard/**/page.tsx` + feature UI
4. Scripts (feature or route scope):

```bash
npm run scaffold:ui-access-contract -- --feature=<feature>
npm run derive:ui-access-contract -- --feature=<feature> --apply --refresh-extract
npm run wire:ui-access-contract -- --feature=<feature> --fix
npm run check:ui-access-contract -- --feature=<feature> --wire --verbose
npm run sync:ui-access-contract
```

`derive` infers from: page/feature permission hooks, **`config/navigation.ts`** (when no page gate), `hasPermissionServer` in linked server actions, `/api/*` literals, `@/app/actions/*` modules.

### Page gate on `page.tsx` (wire audit)

| Pattern | When |
|---------|------|
| `RequireAnyPermission` + `FEATURE_ROUTE_ACCESS.page.permissions` | **Preferred** sync/client pages |
| `hasPermissionServer` + `*.page.permissions` reference | `async` server pages, redirects |
| `wire --fix` | Auto-wraps simple `return (...)` / `return <Component />` pages |

Import: `RequireAnyPermission` from `@features/auth/ui/RequirePermission`; route export from `@features/<feature>/access/<feature>-access`.

### After contract / gate changes

`npm run sync:ui-access-contract` (or `rebuild:platform-info-inventories` if permission scans changed). See **`/rebuild-platform-info-inventories`** for drift.

Full CLI: `docs/platform/ui-access-contract/user_guide.md`

## Platform info inventories (conditional)

After changing page access contracts (`src/features/*/access/*-access.ts`), navigation gates, or UI feature-flag guards:

1. Load **`/rebuild-platform-info-inventories`** — `Mode: refresh` · `Scope: surface=page` · `route=<path>`
2. Run `npm run sync:ui-access-contract` (typical) or `npm run rebuild:platform-info-inventories`
3. Fix new drift in `docs/platform/inventories/DRIFT_REPORT.md`

Do not hand-edit `GENERATED_*.md`.
