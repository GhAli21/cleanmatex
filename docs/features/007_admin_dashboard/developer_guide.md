---
version: v1.0.0
last_updated: 2025-10-31
author: CleanMateX Development Team
---

# Developer Guide - PRD-007 Admin Dashboard

## Overview

This guide provides comprehensive technical documentation for developers working with the CleanMateX Admin Dashboard. It covers architecture, code structure, API usage, and best practices.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Component Documentation](#component-documentation)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Internationalization](#internationalization)
8. [Styling & Theming](#styling--theming)
9. [Testing](#testing)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase Local CLI
- Docker (for Redis, MinIO)
- VS Code (recommended)

### Initial Setup

```bash
# Clone the repository
cd cleanmatex/web-admin

# Install dependencies
npm install

# Start Supabase Local
cd ..
supabase start

# Start Docker services (Redis, MinIO)
docker-compose up -d redis minio

# Start development server
cd web-admin
npm run dev
```

The application will be available at `http://localhost:3001`

### Environment Variables

Create `.env.local` in `web-admin/`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## Architecture Overview

### Technology Stack

```
┌─────────────────────────────────────────┐
│         Next.js 15 App Router           │
│         React 19 + TypeScript 5+        │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼──────────┐
│  Supabase      │  │  Tailwind CSS   │
│  PostgreSQL    │  │  Recharts       │
│  Auth          │  │  next-intl      │
└────────────────┘  └─────────────────┘
```

### Application Layers

1. **Presentation Layer**: React components, pages
2. **Business Logic Layer**: Custom hooks, utilities
3. **Data Access Layer**: Supabase client, API calls
4. **State Management**: React Query + Zustand
5. **Internationalization**: next-intl

---

## Project Structure

```
web-admin/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── layout.tsx                  # Authenticated layout
│   │   ├── orders/                     # Order management
│   │   ├── customers/                  # Customer management
│   │   ├── settings/                   # Settings pages
│   │   │   ├── layout.tsx              # Settings layout with tabs
│   │   │   ├── general/page.tsx
│   │   │   ├── branding/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   └── subscription/page.tsx
│   │   └── reports/page.tsx            # Reports hub
│   └── globals.css                     # Global styles + RTL
├── components/
│   ├── dashboard/
│   │   ├── widgets/                    # 10 dashboard widgets
│   │   ├── charts/                     # Chart components
│   │   ├── QuickActionsStrip.tsx
│   │   ├── GlobalFiltersBar.tsx
│   │   └── DashboardContent.tsx
│   ├── settings/
│   │   └── BusinessHoursEditor.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── LanguageSwitcher.tsx
│   └── providers/
│       └── IntlProvider.tsx
├── lib/
│   ├── hooks/
│   │   └── useQueryParams.ts           # Query parameter management
│   ├── auth/
│   │   └── role-context.tsx            # RBAC context
│   ├── services/
│   │   └── dashboard.service.ts
│   └── utils/
│       └── rtl.ts                      # RTL utilities
├── messages/
│   ├── en.json                         # English translations (500+)
│   └── ar.json                         # Arabic translations (500+)
└── config/
    └── navigation.ts                   # Navigation configuration
```

---

## Component Documentation

### Dashboard Widgets

#### Creating a New Widget

```typescript
// components/dashboard/widgets/MyWidget.tsx
'use client'

import { useTranslations } from 'next-intl'
import { Widget } from '../Widget'
import { TrendingUp } from 'lucide-react'

export function MyWidget() {
  const t = useTranslations('dashboard')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // Fetch data from API
      const response = await fetch('/api/my-data')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Widget
      title={t('myWidget')}
      icon={<TrendingUp className="h-5 w-5" />}
      loading={loading}
      error={error}
    >
      {/* Widget content */}
      <div className="space-y-4">
        {data && (
          <div className="text-2xl font-bold">{data.value}</div>
        )}
      </div>
    </Widget>
  )
}
```

#### Widget Props

```typescript
interface WidgetProps {
  title: string              // Widget title
  icon?: React.ReactNode     // Icon component
  loading?: boolean          // Loading state
  error?: Error | null       // Error state
  actions?: React.ReactNode  // Action buttons
  children: React.ReactNode  // Widget content
}
```

### Settings Pages

#### Creating a Settings Tab

1. Create page in `app/dashboard/settings/{tab}/page.tsx`
2. Add tab to layout in `app/dashboard/settings/layout.tsx`
3. Add translations to `messages/en.json` and `messages/ar.json`

Example:

```typescript
// app/dashboard/settings/mytab/page.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save } from 'lucide-react'

export default function MyTabPage() {
  const t = useTranslations('settings')
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      // Save settings
      await fetch('/api/settings/mytab', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Settings content */}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Save className="h-5 w-5" />
          {loading ? t('saving') : t('saveChanges')}
        </button>
      </div>
    </div>
  )
}
```

### Quick Actions

#### Using QuickActionsStrip

```typescript
import { QuickActionsStrip } from '@/components/dashboard/QuickActionsStrip'

export default function MyPage() {
  return (
    <div>
      <QuickActionsStrip />
      {/* Page content */}
    </div>
  )
}
```

### Global Filters

#### Using GlobalFiltersBar

```typescript
import { GlobalFiltersBar, GlobalFilters } from '@/components/dashboard/GlobalFiltersBar'
import { useFilters } from '@/lib/hooks/useQueryParams'

export default function OrdersPage() {
  const { filters, updateFilters } = useFilters<GlobalFilters>()

  // Apply filters to your query
  const { data } = useOrders(filters)

  return (
    <div>
      <GlobalFiltersBar
        filters={filters}
        onFiltersChange={updateFilters}
        showDateFilter
        showStatusFilter
        showBranchFilter
        availableStatuses={[
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' }
        ]}
      />

      {/* Orders list */}
    </div>
  )
}
```

---

## State Management

### URL Query Parameters

```typescript
import { useQueryParams, useQueryParam, useFilters } from '@/lib/hooks/useQueryParams'

// Method 1: All query params
const [params, setParams, clearParams] = useQueryParams<{ status: string; page: number }>()
setParams({ status: 'active', page: 2 })

// Method 2: Single parameter
const [status, setStatus] = useQueryParam<string>('status')
setStatus('active')

// Method 3: Filter state with defaults
const { filters, updateFilters, resetFilters, hasActiveFilters } = useFilters({
  status: '',
  dateFrom: undefined,
  dateTo: undefined
})
```

### React Query (Data Fetching)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Fetch data
const { data, loading, error } = useQuery({
  queryKey: ['orders', filters],
  queryFn: () => fetchOrders(filters)
})

// Mutate data
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: updateOrder,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }
})
```

---

## API Integration

### Supabase Client

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

// Query with tenant filtering
const { data, error } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('tenant_org_id', tenantId)
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
  .limit(20)

// Insert data
const { data, error } = await supabase
  .from('org_orders_mst')
  .insert({
    tenant_org_id: tenantId,
    customer_id: customerId,
    order_number: 'ORD-001',
    status: 'pending'
  })

// Update data
const { data, error } = await supabase
  .from('org_orders_mst')
  .update({ status: 'completed' })
  .eq('id', orderId)
  .eq('tenant_org_id', tenantId)
```

### API Routes

```typescript
// app/api/my-endpoint/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get tenant ID from JWT
  const tenantId = user.user_metadata?.tenant_org_id

  // Query data
  const { data, error } = await supabase
    .from('org_orders_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)

  return NextResponse.json({ data, error })
}
```

---

## Internationalization

### Using Translations

```typescript
import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('common')

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('save')}</button>
    </div>
  )
}
```

### Adding Translation Keys

1. Add to `messages/en.json`:
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Feature description",
    "action": "Take Action"
  }
}
```

2. Add to `messages/ar.json`:
```json
{
  "myFeature": {
    "title": "ميزتي",
    "description": "وصف الميزة",
    "action": "اتخاذ إجراء"
  }
}
```

3. Use in component:
```typescript
const t = useTranslations('myFeature')
<h1>{t('title')}</h1>
```

### RTL Support

```typescript
import { useLocale } from 'next-intl'
import { isRTL, getDirection } from '@/lib/utils/rtl'

export function MyComponent() {
  const locale = useLocale()
  const dir = getDirection(locale)

  return (
    <div dir={dir} className={isRTL(locale) ? 'rtl-specific-class' : ''}>
      {/* Content */}
    </div>
  )
}
```

### RTL CSS Classes

```css
/* Use Tailwind RTL utilities */
<div className="ml-4 rtl:ml-0 rtl:mr-4">  /* Margin */
<div className="text-left rtl:text-right"> /* Alignment */
<div className="flex-row rtl:flex-row-reverse"> /* Flex direction */
```

---

## Styling & Theming

### Tailwind CSS Classes

```typescript
// Color classes
bg-blue-600 text-white hover:bg-blue-700

// Spacing
p-4 px-6 py-2.5 mt-4 mb-6 gap-3

// Layout
flex items-center justify-between
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4

// Typography
text-sm font-medium text-gray-700
text-2xl font-bold text-gray-900

// Borders & Shadows
border border-gray-200 rounded-lg shadow-sm

// Responsive
hidden md:block lg:flex
```

### Custom Styles

```css
/* app/globals.css */
[dir="rtl"] .custom-class {
  /* RTL-specific styles */
}
```

---

## Testing

### Unit Testing (Future)

```typescript
import { render, screen } from '@testing-library/react'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

### E2E Testing (Future)

```typescript
import { test, expect } from '@playwright/test'

test('dashboard loads correctly', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('h1')).toContainText('Dashboard')
})
```

---

## Best Practices

### Component Structure

```typescript
// 1. Imports
import { useState } from 'react'
import { useTranslations } from 'next-intl'

// 2. Types/Interfaces
interface Props {
  id: string
  name: string
}

// 3. Component
export function MyComponent({ id, name }: Props) {
  // 4. Hooks
  const t = useTranslations('common')
  const [state, setState] = useState()

  // 5. Event handlers
  const handleClick = () => {}

  // 6. Render
  return <div>{/* JSX */}</div>
}
```

### Naming Conventions

- **Components**: PascalCase (`MyComponent.tsx`)
- **Files**: kebab-case (`my-utils.ts`)
- **Functions**: camelCase (`handleClick`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ITEMS`)
- **Types/Interfaces**: PascalCase (`UserData`)

### Code Organization

```typescript
// ✅ Good: Clear, focused components
export function OrderCard({ order }) {
  return <Card>{/* Order display */}</Card>
}

// ❌ Bad: Mixing concerns
export function OrderCard({ order, onEdit, onDelete, showDetails }) {
  // Too many responsibilities
}
```

### Performance

```typescript
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Complex rendering */}</div>
})

// Use useMemo for expensive calculations
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value)
}, [data])

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])
```

---

## Troubleshooting

### Common Issues

#### Issue: Translations not showing

**Solution**:
```typescript
// Check locale is set correctly
const locale = useLocale()
console.log('Current locale:', locale)

// Verify translation key exists
const t = useTranslations('myKey')
console.log('Translation:', t('subKey'))
```

#### Issue: RTL layout broken

**Solution**:
```typescript
// Ensure HTML dir attribute is set
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>

// Use RTL utilities
<div className="ml-4 rtl:ml-0 rtl:mr-4">
```

#### Issue: Supabase RLS blocking queries

**Solution**:
```typescript
// Always filter by tenant_org_id
const { data } = await supabase
  .from('org_orders_mst')
  .select('*')
  .eq('tenant_org_id', tenantId) // ← Critical!
```

#### Issue: Components not updating

**Solution**:
```typescript
// Invalidate React Query cache
queryClient.invalidateQueries({ queryKey: ['orders'] })

// Or refetch
const { refetch } = useQuery({...})
await refetch()
```

### Debug Mode

```typescript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', { data, state, props })
}
```

### Performance Profiling

```bash
# Analyze bundle size
npm run build
npm run analyze

# Check for unused dependencies
npx depcheck
```

---

## Additional Resources

### Internal Documentation
- [Architecture Overview](./technical_docs/architecture.md)
- [API Specifications](./technical_docs/api_specifications.md)
- [Component Structure](./technical_docs/component_structure.md)
- [User Guide](./user_guide.md)
- [Testing Scenarios](./testing_scenarios.md)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [next-intl](https://next-intl-docs.vercel.app/)
- [Recharts](https://recharts.org/)

---

**Version**: v1.0.0
**Last Updated**: 2025-10-31
**Maintained By**: CleanMateX Development Team
