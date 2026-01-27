# CleanMateX Frontend Standards

## 1. Tech Stack & Core Principles

- **Framework:** Next.js (App Router)
- **Language:** TypeScript only (no plain JS for app code)
- **Styling:** Tailwind CSS, design tokens, CSS variables
- **UI Layer:**
  - shadcn/ui (wrapped only in Cmx components)
  - Cmx Design System in `src/ui`
- **State / Data:**
  - React Query (TanStack Query) for async data
  - React Hook Form + Zod for forms & validation
- **API:**
  - Centralized API client in `lib/api`
- **Types:**
  - Supabase generated types for DB entities
  - Shared domain types in `src/features/*/model` or `lib/types`

**Guiding Principles:**
- Composition over inheritance
- Small, focused components
- Strong typing everywhere
- Clear separation of concerns between routing, domain logic, and UI

## 2. UI Standards

### 2.1 Cmx Components (Design System)

All reusable UI must be implemented as **Cmx** components in `src/ui`.

Naming: `CmxButton`, `CmxInput`, `CmxCard`, `CmxDataTable`, `CmxForm`, `CmxPageHeader`

**Usage Rules:**
- Features should **only** use Cmx components (not shadcn directly)
- If a new primitive is needed:
  - Implement it once in `src/ui/primitives/` (wrapping shadcn or native HTML)
  - Use it everywhere via `@ui/...`

### 2.2 Styling & Tailwind

**Use Tailwind for:**
- Layout: `flex`, `grid`, `gap`, margin, padding
- Typography scale: `text-sm`, `text-base`, `text-lg`
- Responsiveness: `sm:`, `md:`, `lg:`, `xl:` breakpoints

**Do NOT hardcode brand colors:**
- Avoid `text-blue-500`, `bg-green-500`, hex literals
- Use theme tokens and CSS variables:
  - `text-[rgb(var(--cmx-foreground-rgb))]`
  - `bg-[rgb(var(--cmx-surface-rgb))]`

### 2.3 Icons (Lucide)

Use `lucide-react` for icons. Wrap common icon patterns into Cmx components where needed.

### 2.4 Toasts (Sonner)

Use Sonner (wired once at app root). Expose wrapper helpers in `src/ui/feedback/`.

## 3. Forms & Validation

### React Hook Form + Zod

All non-trivial forms must use:
- **React Hook Form** for state and submission
- **Zod** for schema validation

**Pattern:**
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const FormSchema = z.object({
  name: z.string().min(1),
})

type FormValues = z.infer<typeof FormSchema>

export function SomeForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '' },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* use CmxForm + CmxInput here */}
    </form>
  )
}
```

**Zod schemas location:**
- For feature forms: under `src/features/<feature>/ui` or `model` if shared
- For shared schemas: `lib/types` or `lib/validation`

## 4. API Client & Data Fetching

### Central API Client (`lib/api`)

Single reusable API client abstraction:
```typescript
// lib/api/client.ts
export async function apiRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  // handle base URL, auth headers, error handling, etc.
}
```

Feature-specific API functions live under `src/features/<feature>/api`:
```typescript
// src/features/orders/api/orders-api.ts
import { apiRequest } from '@lib/api/client'

export async function fetchOrders(params: { page: number }) {
  return apiRequest<{ data: Order[]; total: number }>(`/api/orders?page=${params.page}`)
}
```

### React Query (TanStack Query)

Use React Query for server data caching and fetching:
```typescript
// src/features/orders/hooks/use-orders.ts
import { useQuery } from '@tanstack/react-query'
import { fetchOrders } from '../api/orders-api'

export function useOrders(params: { page: number }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => fetchOrders(params),
  })
}
```

## 5. Supabase Types Usage

- Supabase-generated types used as **base DB shapes**, not directly as UI models
- Map DB types to UI/domain types in a separate mapper function

```typescript
// lib/types/supabase.ts
export type DbOrder = {/* generated */}

// src/features/orders/model/order-types.ts
export type Order = {
  id: string
  customerName: string
}

export function mapDbOrderToOrder(db: DbOrder): Order {
  return {
    id: db.id,
    customerName: db.customer_name ?? '',
  }
}
```

## 6. Tables, Charts, and Analytics

### TanStack Table
Use TanStack Table for complex data tables. Wrap in Cmx components:
- `CmxDataTable`
- `CmxSortableTable`

Feature tables should **compose** from these wrappers.

### Recharts
Use Recharts for charts. Wrap in `src/ui/charts/`:
- `CmxLineChart`
- `CmxBarChart`
- `CmxDonutChart`

## 7. Error Handling & UX

- **Always** use Global Message Utility (`cmxMessage`) for all messages
- Handle errors at three levels:
  1. API error handling in `apiRequest` (HTTP status, network errors)
  2. React Query error boundaries where appropriate
  3. User-facing toasts (Sonner) or inline messages

**Patterns:**
- For forms: show validation errors near fields using Cmx form components
- For lists/tables: show empty/error states with `CmxEmptyState`

## 8. Quick Rules Checklist

- **Routing:** Only in `app/`
- **Reusable UI:** Only in `src/ui`, named with `Cmx*`
- **Feature UI and logic:** In `src/features/<feature>/...`
- **Infra & utilities:** In `lib/`
- **Imports:**
  - `@ui/*` -> `src/ui/*`
  - `@features/*` -> `src/features/*`
  - `@lib/*` -> `lib/*`
- **Do not use:** `components/ui`, `shared/`, `common/` as roots
