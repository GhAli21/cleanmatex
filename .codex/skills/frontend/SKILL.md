---
name: frontend
description: Frontend development standards for Next.js 15, React 19, TypeScript, Tailwind CSS, Cmx Design System. Use when creating components, pages, forms, or frontend code.
user-invocable: true
---

# CleanMateX Frontend Standards

## CRITICAL Rules

1. **Always use cmxMessage** for all messages, errors, alerts
2. **Pagination must be server-side** (API-driven)
3. **Use CmxEditableDataTable** for editable tables
4. **NEVER create `components/` folder** - use `src/ui/` or `src/features/*/ui/`
5. **Use `/rebuild-ui-access-contract`** when changing dashboard route access, permission-gated actions, feature-flag gates, workflow-role gates, or the permissions inspector popup

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
- Update BOTH `en.json` and `ar.json` when adding translations

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
- `web-admin/src/features/*/access/` - Feature-local UI access contracts for dashboard routes and gated actions
