# CleanMateX UI Blueprint Implementation

**Version:** 1.0
**Status:** ✅ Implemented
**Source:** `docs/features/Core/UI_Blueprint_Dev_v1.0.md`

## Overview

This implementation follows the **Project UI Layer Blueprint** which defines a layered, theme-aware, AI-friendly design system using the `Cmx*` component naming convention.

## Architecture Layers

### Layer 1: Foundations (`src/ui/foundations/`)
Design tokens and theme configuration that map Theme Settings Engine → CSS variables.

**Files:**
- `tokens.ts` - Theme configuration and CSS variable application
- `typography.ts` - Typography system (font sizes, weights, line heights)
- `spacing.ts` - Spacing scale
- `shadows.ts` - Shadow system
- `zindex.ts` - Z-index management

**Usage:**
```ts
import { applyThemeTokensToDom, defaultThemeConfig } from '@ui/foundations'

applyThemeTokensToDom(defaultThemeConfig)
```

### Layer 2: Primitives (`src/ui/primitives/`)
Low-level components with `Cmx` prefix that use CSS variables for theming.

**Implemented:**
- `CmxButton` - Button with variants (primary, secondary, ghost, outline, destructive)
- `CmxInput` - Text input
- `CmxTextarea` - Multi-line text input
- `CmxCard` - Card container with Header, Title, Description, Content
- `CmxSpinner` - Loading spinner

**Usage:**
```tsx
import { CmxButton, CmxInput } from '@ui/primitives'

<CmxButton variant="primary" size="md" loading={false}>
  Save
</CmxButton>
```

**Design Principles:**
- All components accept `className` for extension
- All styling uses CSS variables (e.g., `rgb(var(--cmx-primary-rgb))`)
- All components are fully typed with exported `Props` interfaces
- No hard-coded colors - only theme tokens

### Layer 3: Forms (`src/ui/forms/`)
React Hook Form + Zod integration layer.

**Components:**
- `CmxForm` - Form shell with FormProvider
- `CmxFormField` - Field wrapper with label, description, error handling
- `CmxFormSection` - Visual section grouping
- `CmxFormActions` - Submit and cancel buttons

**Usage:**
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CmxForm, CmxFormField, CmxFormActions } from '@ui/forms'
import { CmxInput } from '@ui/primitives'

const form = useForm({
  resolver: zodResolver(schema),
})

<CmxForm form={form} onSubmit={onSubmit}>
  <CmxFormField name="email" label="Email" required>
    {({ field }) => <CmxInput {...field} />}
  </CmxFormField>
  <CmxFormActions primaryLabel="Save" secondaryLabel="Cancel" />
</CmxForm>
```

### Layer 4: Data Display (`src/ui/data-display/`)
Tables, KPIs, and data presentation components.

**Components:**
- `CmxDataTable` - Server-side paginated table (TanStack Table)
- `CmxKpiStatCard` - KPI statistics card
- `CmxEmptyState` - Empty state placeholder

**Usage:**
```tsx
import { CmxDataTable, CmxKpiStatCard, CmxEmptyState } from '@ui/data-display'

<CmxDataTable
  columns={columns}
  data={data}
  loading={loading}
  page={page}
  pageSize={pageSize}
  total={total}
  onPageChange={setPage}
/>
```

### Layer 5: Charts (`src/ui/charts/`)
Recharts wrappers that respect theme colors.

**Components:**
- `CmxLineChart` - Line chart

**Usage:**
```tsx
import { CmxLineChart } from '@ui/charts'

<CmxLineChart data={data} xKey="date" yKey="revenue" />
```

### Layer 6: Feedback (`src/ui/feedback/`)
User feedback components.

**Components:**
- `cmxToast` - Toast notifications (Sonner wrapper)
- `CmxConfirmDialog` - Confirmation dialog

**Usage:**
```tsx
import { showSuccessToast, showErrorToast, CmxConfirmDialog } from '@ui/feedback'

// Toasts
showSuccessToast('Saved successfully')
showErrorToast('Failed to save')

// Confirm dialog
<CmxConfirmDialog
  title="Delete Item?"
  description="This action cannot be undone"
  onConfirm={handleDelete}
  trigger={<button>Delete</button>}
/>
```

### Layer 7: Patterns (`src/ui/patterns/`)
Reusable page-level templates.

**Components:**
- `CmxListWithFilters` - List view with title, filters, and table
- `CmxCrudPageShell` - CRUD page shell (list/detail mode)

**Usage:**
```tsx
import { CmxListWithFilters } from '@ui/patterns'
import { CmxDataTable } from '@ui/data-display'

<CmxListWithFilters
  title="Orders"
  subtitle="Manage customer orders"
  toolbar={<button>+ New Order</button>}
  filters={<OrderFilters />}
  table={<CmxDataTable {...tableProps} />}
/>
```

## Import Patterns

### ✅ Recommended
```tsx
// Import from specific layers
import { CmxButton, CmxInput } from '@ui/primitives'
import { CmxForm, CmxFormField } from '@ui/forms'
import { CmxDataTable } from '@ui/data-display'
import { CmxLineChart } from '@ui/charts'
import { showSuccessToast } from '@ui/feedback'
import { CmxListWithFilters } from '@ui/patterns'
```

### ✅ Alternative (main barrel)
```tsx
// Import everything from main barrel
import {
  CmxButton,
  CmxForm,
  CmxDataTable,
  showSuccessToast,
} from '@ui'
```

### ❌ Avoid
```tsx
// Don't use shadcn components directly in features
import { Button } from '@ui/primitives/button'  // ❌ Use CmxButton instead
```

## CSS Variables Reference

All Cmx components use CSS variables for theming. Define these in your global CSS or via the Theme Engine:

```css
:root {
  /* Primary colors */
  --cmx-primary-rgb: 14 165 233;
  --cmx-primary-hover-rgb: 3 105 161;

  /* Secondary colors */
  --cmx-secondary-bg-rgb: 241 245 249;
  --cmx-secondary-fg-rgb: 15 23 42;
  --cmx-secondary-hover-bg-rgb: 226 232 240;

  /* Destructive */
  --cmx-destructive-rgb: 220 38 38;
  --cmx-destructive-hover-rgb: 185 28 28;

  /* Borders & backgrounds */
  --cmx-border-rgb: 226 232 240;
  --cmx-border-subtle-rgb: 226 232 240;
  --cmx-card-bg-rgb: 255 255 255;
  --cmx-input-bg-rgb: 255 255 255;

  /* Text colors */
  --cmx-foreground-rgb: 15 23 42;
  --cmx-muted-foreground-rgb: 148 163 184;

  /* Table */
  --cmx-table-header-bg-rgb: 248 250 252;
  --cmx-table-row-hover-bg-rgb: 248 250 252;

  /* Radius */
  --cmx-radius-md: 0.375rem;

  /* Z-index */
  --cmx-z-modal: 1050;
}
```

## Migration from Legacy Components

### Old Pattern (shadcn wrappers)
```tsx
import { CmxButton } from '@ui/components/cmx-button'
// This wraps shadcn Button component
```

### New Pattern (Blueprint primitives)
```tsx
import { CmxButton } from '@ui/primitives/cmx-button'
// This is a standalone primitive using CSS variables
```

**Backward Compatibility:**
- Legacy `@ui/components/*` exports still work
- Gradually migrate to Blueprint patterns
- Both patterns can coexist during transition

## Benefits

1. **Single Design Language** - All screens use same primitives
2. **Theme-Aware** - CSS variables enable dynamic theming
3. **AI-Friendly** - Clear naming and structure
4. **Testable** - Small, predictable, typed components
5. **Maintainable** - Layered architecture with clear responsibilities
6. **Extensible** - Easy to add new components following patterns

## Next Steps

1. ✅ Foundations implemented
2. ✅ Core primitives implemented (Button, Input, Card, Spinner)
3. ✅ Forms layer complete
4. ✅ Data display layer complete
5. ✅ Charts layer started
6. ✅ Feedback layer complete
7. ✅ Patterns layer started
8. 🔄 Additional primitives (Select, Checkbox, Radio, Badge, Avatar, Modal, Drawer, Tabs, Accordion, Skeleton, Tooltip)
9. 🔄 Navigation layer (App Shell, Sidebar, Header, Breadcrumbs)
10. 🔄 Wire to Theme Settings Engine

## Related Documentation

- **Source Blueprint:** `docs/features/Core/UI_Blueprint_Dev_v1.0.md`
- **Frontend Standards:** `.claude/docs/frontend_standards.md`
- **Migration Guide:** `src/MIGRATION_GUIDE.md`
