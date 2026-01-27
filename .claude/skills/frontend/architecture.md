# Frontend Architecture Rules

You are generating code for **CleanMateX/CleanMateXSAAS**, a multi-tenant SaaS platform built with **Next.js App Router, TypeScript, TailwindCSS, shadcn/ui, Supabase**, and a custom **Cmx UI Design System**.

## 1. Project Architecture (MUST FOLLOW)

### 1.1 Routing Layer - `app/`

**Contains:**
- `page.tsx`, `layout.tsx`, `template.tsx`
- `loading.tsx`, `error.tsx`
- Route groups `(dashboard)`, `(auth)`, etc.

**Responsibilities:**
- Routing and composition only
- Compose feature screens and Cmx UI

**DO NOT:**
- Define reusable primitives
- Put business logic here
- Put design system components here

### 1.2 Global UI System - `src/ui/`

The **Cmx Design System** lives here.

**Structure:**
```
src/ui/
  foundations/    # tokens, theme, CSS vars
  primitives/     # CmxButton, CmxInput, CmxCard
  forms/          # CmxForm, CmxFormField, CmxFormSection
  data-display/   # CmxDataTable, CmxKpiCard, CmxEmptyState
  navigation/     # CmxAppShell, sidebar, breadcrumbs
  layouts/        # major layout shells
  patterns/       # CRUD shells, list-with-filters, wizards
  charts/         # Recharts wrappers
  feedback/       # toast, inline error/success, confirm dialog
  overlays/       # modals, side panels
```

All global reusable components MUST be prefixed with **`Cmx`**.

### 1.3 Feature Modules - `src/features/`

Domain-level modules live here:
- `src/features/orders/`
- `src/features/customers/`
- `src/features/tenants/`

Each feature may have:
- `ui/` - feature-specific components and screens
- `api/` - API clients for this feature
- `hooks/` - feature hooks
- `model/` - types and mappers

Example:
```
src/features/orders/
  ui/
    order-list-screen.tsx
    order-filters.tsx
  api/
    orders-api.ts
  hooks/
    use-orders.ts
  model/
    order-types.ts
```

### 1.4 Shared Infrastructure - `lib/` (root-level)

Contains:
- `lib/api/` - base API clients
- `lib/supabase/` - supabase client
- `lib/hooks/` - generic hooks
- `lib/utils/` - utilities
- `lib/config/` - configuration helpers

## 2. Path Aliases

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

**Usage:**
```typescript
// Global UI (design system)
import { CmxButton } from '@ui/primitives/cmx-button'

// Feature UI
import { OrderListScreen } from '@features/orders/ui/order-list-screen'

// Infrastructure
import { apiClient } from '@lib/api/client'
```

Do not invent other top-level paths like `@/components` or `@/core`.

## 3. Rules for Where Code Goes

### Reusable UI -> `src/ui/`
Components that are:
- Reused across multiple features
- Generic in nature (button, input, table, layout, etc.)

Examples: `CmxButton`, `CmxInput`, `CmxForm`, `CmxDataTable`, `CmxPageHeader`

### Feature-Specific UI -> `src/features/<module>/ui`
Components that contain business/domain logic:
- `OrderStatusBadge`
- `CustomerTierBadge`
- `OrderListScreen`
- `TenantSettingsForm`

### Routes -> `app/`
Only use for:
- Composing feature screens
- Handling routing, layouts, segment-specific logic

```tsx
// app/dashboard/orders/page.tsx
import { OrderListScreen } from '@features/orders/ui/order-list-screen'

export default async function OrdersPage() {
  return <OrderListScreen />
}
```

## 4. Theming & Styling Rules

### Theme Engine
`ThemeProvider` sets DOM attributes on `<html>`:
- `class="dark"` (for dark mode)
- `data-accent="blue" | "emerald" | "violet"`
- `data-radius="sm" | "md" | "lg"`
- `data-density="compact" | "comfortable" | "spacious"`

### Styling - DO
- Use CSS variables and theme tokens: `rgb(var(--cmx-primary-rgb))`
- Use Tailwind for layout/spacing/typography: `flex`, `grid`, `gap-4`, `p-4`

### Styling - DO NOT
- Hardcode brand colors: `text-blue-500`, `bg-red-500`
- Use hex codes directly: `#1d4ed8`, `#ef4444`
- Use shadcn/ui directly inside features - always wrap as Cmx in `src/ui` first

## 5. Import Rules (CRITICAL)

### From `src/ui` (global design system):
```typescript
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxDataTable } from '@ui/data-display/cmx-datatable'
import { CmxPageHeader } from '@ui/navigation/cmx-page-header'
```

### From `src/features` (domain UI):
```typescript
import { OrderListScreen } from '@features/orders/ui/order-list-screen'
import { CustomerForm } from '@features/customers/ui/customer-form'
```

### From `lib` (infra):
```typescript
import { supabaseClient } from '@lib/supabase/client'
import { apiClient } from '@lib/api/client'
```

### NEVER:
- Import UI from `app/*`: `import X from '@/app/components/...'` -> FORBIDDEN
- Invent `components/` or `shared/` or `common/` top-level UI folders
- Mix `src/ui` and `components/ui`. There is only `src/ui`
