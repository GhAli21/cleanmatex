# CleanMateX Frontend Architecture Rules

This document defines where frontend code belongs in `web-admin`.

## 1. Core architecture

```txt
web-admin/
  app/                    # Next.js App Router only
  src/
    ui/                   # global Cmx Design System
    features/             # feature/domain modules
  lib/                    # shared infrastructure
  messages/               # i18n messages
```

## 2. `app/` routing layer

### Contains

- `page.tsx`
- `layout.tsx`
- `template.tsx`
- `loading.tsx`
- `error.tsx`
- route groups such as `(dashboard)` and `(auth)`

### Responsibilities

- Define route segments.
- Compose feature screens.
- Compose route-specific layout wrappers.
- Handle route-level loading and error boundaries.

### Must not contain

- reusable UI primitives,
- domain business logic,
- feature hooks,
- API clients,
- table/form implementation,
- design-system components.

### Correct example

```tsx
import { OrderListScreen } from '@features/orders/ui/order-list-screen'

export default function OrdersPage() {
  return <OrderListScreen />
}
```

## 3. `src/ui/` global Cmx Design System

Reusable app-wide components live here.

```txt
src/ui/
  foundations/       # tokens, CSS vars, theme provider helpers
  primitives/        # CmxButton, CmxInput, CmxCard, CmxBadge
  forms/             # CmxForm, CmxFormField, CmxSelect, CmxDatePicker
  data-display/      # CmxDataTable, CmxEditableDataTable, CmxKpiCard
  navigation/        # CmxAppShell, CmxBreadcrumbs, CmxTabs
  layouts/           # CmxPageShell, CmxDashboardGrid
  patterns/          # CRUD shells, filter bars, wizard shells
  charts/            # CmxChart wrappers
  feedback/          # cmxMessage, CmxEmptyState, CmxInlineError
  overlays/          # CmxDialog, CmxDrawer, CmxConfirmDialog
```

Rules:

- All exported reusable components must use the `Cmx` prefix.
- `src/ui` must not import from `app/`.
- `src/ui` must not import from `src/features/`.
- shadcn/Radix wrappers belong here, not in feature modules.
- Components must be theme-aware, RTL-safe, accessible, and token-based.

## 4. `src/features/` domain modules

Domain-specific frontend code lives here.

```txt
src/features/orders/
  ui/
    order-list-screen.tsx
    order-filters.tsx
    order-status-badge.tsx
  reports/
    orders-payments-print-rprt.tsx
  api/
    orders-api.ts
  hooks/
    use-orders.ts
  model/
    order-types.ts
    order-mapper.ts
```

Rules:

- Feature UI may import from `@ui/*`, `@lib/*`, and its own local feature folders.
- Feature UI must not import from `app/`.
- Feature UI must not directly import another feature’s internals unless an approved public feature boundary exists.
- Business-specific components belong in feature UI, not in `src/ui`.

Examples:

- `OrderStatusBadge` belongs in `src/features/orders/ui`.
- `CustomerTierBadge` belongs in `src/features/customers/ui`.
- `CmxBadge` belongs in `src/ui/primitives`.

## 5. `lib/` shared infrastructure

Root-level `lib/` contains non-UI shared infrastructure.

```txt
lib/
  api/          # base API client, HTTP errors, interceptors
  supabase/     # Supabase clients/config helpers
  hooks/        # generic cross-feature hooks only
  utils/        # pure generic helpers
  config/       # app config helpers
```

Rules:

- `lib` can be imported by `app`, `src/ui`, and `src/features`.
- `lib` must not depend on `src/features`.
- `lib` must not depend on `src/ui` unless it is explicitly a UI helper under a UI-owned path.

## 6. Path aliases

Use only:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@ui/*": ["src/ui/*"],
      "@features/*": ["src/features/*"],
      "@lib/*": ["lib/*"]
    }
  }
}
```

Correct:

```ts
import { CmxButton } from '@ui/primitives/cmx-button'
import { OrderListScreen } from '@features/orders/ui/order-list-screen'
import { apiClient } from '@lib/api/client'
```

Forbidden:

```ts
import { Button } from '@/components/ui/button'
import { Something } from '@/core/something'
import { X } from '@ui/compat'
import { Y } from '@/app/components/y'
```

## 7. Navigation and menu-visible routes

A route is menu-visible if it appears or should appear in the sidebar/system menu.

For menu-visible routes, update all three artifacts:

| Artifact | Purpose |
|---|---|
| `app/<segment>/page.tsx` | actual Next.js route |
| `web-admin/config/navigation.ts` | React sidebar/menu |
| `supabase/migrations/{seq}_nav_*.sql` | `sys_components_cd`, RBAC, permission/navigation API |

Use `/navigation` before touching route code when:

- adding a page to the sidebar,
- renaming a menu route,
- moving a menu route,
- changing roles/permissions for a menu route,
- removing a menu route,
- changing a flat link into an expandable menu section or vice versa.

`/navigation` is not required when:

- editing the body of an existing page,
- creating hidden detail pages that are not menu entries,
- creating feature components under `src/features/*/ui`,
- creating reusable components under `src/ui`.

## 8. Reports architecture

Reports must be centralized and reusable where possible.

Rules:

- Report files end with `-rprt.tsx`.
- Feature reports live in `src/features/<feature>/reports`.
- Reusable report primitives live in `src/ui/patterns` or `src/ui/data-display`.
- Reports must use shared theme, typography, spacing, and print/PDF layout tokens.
- Reports must support EN/AR and RTL.
- Export/print actions must use permission and feature gates.

Example:

```txt
src/features/orders/reports/orders-payments-print-rprt.tsx
```

## 9. Generated files protection

Do not hand-edit generated files unless the file explicitly says it is manually maintained.

Common protected categories:

- generated route/access inventories,
- generated API types,
- generated DB types,
- generated component registries,
- generated permission/access contracts,
- generated OpenAPI clients.

If generated output is wrong, fix the source generator/input and regenerate.
