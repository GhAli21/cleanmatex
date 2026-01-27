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
4. **Search for existing message keys** before adding new ones
5. **Use tCommon()** for common message keys

## Folder Structure

```
app/            # Routing only (page.tsx, layout.tsx)
src/
  ui/           # Global Cmx Design System (Cmx* prefix)
  features/     # Feature modules (domain-specific)
lib/            # Shared infrastructure
```

## Path Aliases

```typescript
import { CmxButton } from '@ui/primitives/cmx-button'
import { OrderListScreen } from '@features/orders/ui/order-list-screen'
import { apiClient } from '@lib/api/client'
```

## Component Rules

### Reusable UI -> `src/ui/`
- All components use `Cmx` prefix
- Generic, not domain-specific
- Examples: `CmxButton`, `CmxDataTable`, `CmxForm`, `CmxPageHeader`

### Feature-Specific UI -> `src/features/<module>/ui/`
- Domain logic components
- Examples: `OrderStatusBadge`, `CustomerForm`, `OrderListScreen`

### Routes -> `app/`
- Routing and composition only
- Compose from features and ui
- NEVER define primitives here

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
- Use Tailwind for layout: `flex`, `grid`, `gap-4`, `p-4`
- Use theme tokens for colors

### DO NOT
- Hardcode colors: `text-blue-500`, `bg-red-500`
- Use hex codes: `#1d4ed8`
- Import shadcn/ui directly in features

## Translation Usage

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

## Message Utility (cmxMessage)

```typescript
import { useMessage } from '@ui/feedback';

function MyComponent() {
  const { showSuccess, showError, handlePromise } = useMessage();

  const handleSave = async () => {
    await handlePromise(saveData(), {
      loading: t('messages.saving'),
      success: t('messages.saveSuccess'),
      error: t('errors.saveFailed'),
    });
  };
}
```

## Import Rules

### ALLOWED
```typescript
import { CmxButton } from '@ui/primitives/cmx-button'
import { OrderListScreen } from '@features/orders/ui/order-list-screen'
import { supabaseClient } from '@lib/supabase/client'
```

### FORBIDDEN
```typescript
import X from '@/app/components/...'  // NEVER
import { Button } from '@/components/ui/button'  // NEVER
```

See `architecture.md` for complete architecture rules.
See `standards.md` for detailed coding standards.
