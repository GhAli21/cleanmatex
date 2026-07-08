# CleanMateX Cmx UI Blueprint

This document defines the UI abstraction layer under `src/ui/`.

All feature code should use Cmx components, not raw third-party primitives.

## 1. Folder structure

```txt
src/ui/
  foundations/
    cmx-theme-provider.tsx
    cmx-theme-tokens.css
    cmx-density.ts
  primitives/
    cmx-button.tsx
    cmx-input.tsx
    cmx-textarea.tsx
    cmx-card.tsx
    cmx-badge.tsx
    cmx-checkbox.tsx
    cmx-switch.tsx
    cmx-label.tsx
    index.ts
  forms/
    cmx-form.tsx
    cmx-form-field.tsx
    cmx-select.tsx
    cmx-select-dropdown.tsx
    cmx-date-picker.tsx
    index.ts
  data-display/
    cmx-data-table.tsx
    cmx-editable-data-table.tsx
    cmx-kpi-card.tsx
    cmx-empty-state.tsx
    index.ts
  navigation/
    cmx-app-shell.tsx
    cmx-breadcrumbs.tsx
    cmx-tabs.tsx
    index.ts
  layouts/
    cmx-page-shell.tsx
    cmx-section.tsx
    cmx-dashboard-grid.tsx
    index.ts
  patterns/
    cmx-crud-shell.tsx
    cmx-filter-bar.tsx
    cmx-wizard.tsx
    index.ts
  charts/
    cmx-chart.tsx
    index.ts
  feedback/
    cmx-message.ts
    cmx-inline-error.tsx
    cmx-summary-message.tsx
    cmx-progress-bar.tsx
    index.ts
  overlays/
    cmx-dialog.tsx
    cmx-drawer.tsx
    cmx-confirm-dialog.tsx
    index.ts
```

No `components/` folder. No `components/ui`.

## 2. Import rules

Correct:

```ts
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard } from '@ui/primitives/cmx-card'
import { CmxDataTable } from '@ui/data-display/cmx-data-table'
import { CmxDialog } from '@ui/overlays/cmx-dialog'
import { cmxMessage } from '@ui/feedback/cmx-message'
import { cn } from '@lib/utils/cn'
```

Forbidden:

```ts
import { Button } from '@/components/ui/button'
import { Button } from '@ui/compat'
import { Dialog } from '@radix-ui/react-dialog'
```

Feature code must not import raw shadcn/Radix primitives. Wrap them once in `src/ui`.

## 3. Design token contract

Cmx components must support:

- light/dark mode,
- accent theme,
- radius theme,
- density theme,
- RTL,
- accessible focus states,
- semantic variants.

Theme attributes live on `<html>`:

```txt
class="dark"
data-accent="blue|emerald|violet|..."
data-radius="sm|md|lg"
data-density="compact|comfortable|spacious"
dir="ltr|rtl"
```

Use CSS variables:

```css
--cmx-background-rgb
--cmx-foreground-rgb
--cmx-surface-rgb
--cmx-border-rgb
--cmx-primary-rgb
--cmx-danger-rgb
--cmx-warning-rgb
--cmx-success-rgb
```

## 4. `CmxButton` contract

Purpose: standard action button.

Props should support:

```ts
type CmxButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'

interface CmxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CmxButtonVariant
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}
```

Required behavior:

- disable while loading,
- show spinner when loading,
- keep accessible name,
- maintain focus ring,
- support RTL icon spacing,
- no hardcoded colors.

## 5. `CmxInput` contract

Purpose: standard input wrapper.

Required behavior:

- forward ref,
- support invalid state,
- support disabled/read-only,
- support leading/trailing slot where needed,
- use tokenized focus/error styles,
- work inside `CmxFormField`.

## 6. `CmxForm` and `CmxFormField` contract

Purpose: standard RHF form shell and field wrapper.

Required behavior:

- accepts `UseFormReturn<T>`.
- supports Zod/RHF validation messages.
- provides label, description, error, required marker.
- connects `aria-describedby` correctly.
- supports RTL layout.
- does not own domain validation.

Pattern:

```tsx
<CmxForm form={form} onSubmit={onSubmit}>
  <CmxFormField form={form} name="name" label={t('fields.name')}>
    {({ field }) => <CmxInput {...field} />}
  </CmxFormField>
</CmxForm>
```

## 7. `CmxDataTable` server-side contract

Purpose: non-editable data table for large lists.

Pagination must be server-side.

Minimum props:

```ts
interface CmxDataTableProps<TData> {
  rows: TData[]
  columns: CmxColumnDef<TData>[]
  getRowId: (row: TData) => string

  page: number
  pageSize: number
  totalRows: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void

  sort?: CmxSortState
  onSortChange?: (sort: CmxSortState) => void

  filters?: unknown
  loading?: boolean
  error?: string | null
  emptyState?: React.ReactNode

  rowActions?: (row: TData) => React.ReactNode
  selection?: CmxSelectionState<TData>
}
```

Required behavior:

- loading skeleton,
- empty state,
- error state,
- total row count,
- accessible table headers,
- keyboard-safe row actions,
- RTL-safe horizontal scroll,
- no client-side pagination over large datasets.

## 8. `CmxEditableDataTable` contract

Purpose: editable grids only.

Use when rows can be edited inline.

Required behavior:

- server-safe row identity,
- row-level dirty tracking,
- row-level validation,
- save/cancel per row or controlled batch save,
- loading state per save action,
- conflict handling,
- keyboard navigation,
- clear error placement,
- no silent discard of unsaved changes.

Feature code must not build custom editable table logic unless the Cmx component cannot support the case and the gap is documented.

## 9. `cmxMessage` contract

Purpose: single message API for all user-facing feedback.

Required methods:

```ts
cmxMessage.success(messageKeyOrText, options?)
cmxMessage.error(messageKeyOrText, options?)
cmxMessage.warning(messageKeyOrText, options?)
cmxMessage.info(messageKeyOrText, options?)
cmxMessage.confirm(options)
```

Rules:

- Prefer i18n keys or already translated strings depending on existing project pattern.
- Do not expose raw backend errors.
- Use consistent duration and placement.
- Destructive confirmation must be explicit.

## 10. `CmxDialog` / `CmxDrawer` contract

Required behavior:

- accessible title and description,
- focus trap,
- ESC handling,
- loading-safe close behavior,
- dirty-form close confirmation where needed,
- responsive fallback to drawer on mobile if app pattern requires it,
- RTL-safe animation direction.

## 11. `CmxEmptyState` contract

Required props:

```ts
interface CmxEmptyStateProps {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
}
```

Usage rules:

- explain what is empty,
- provide next action only if permission allows,
- avoid generic “No data” for business screens.

## 12. `CmxKpiCard` contract

Required behavior:

- label,
- value,
- optional delta/trend,
- loading skeleton,
- accessible label/value structure,
- tokenized semantic trend colors,
- compact layout for dashboard grids.

## 13. Charts

Charts must be wrapped as Cmx chart components.

Rules:

- no raw chart usage in feature code unless approved,
- support empty state,
- support loading state,
- support RTL labels where relevant,
- use tokenized colors,
- provide accessible summary text.

## 14. Component export rules

Each `src/ui/<group>/index.ts` should export stable public components.

Avoid deep unstable imports when an index barrel exists and is established.

Keep `.clauderc` / AI import hints in sync with actual exports when the repo uses them.

## 15. When a Cmx component is missing

If a feature needs reusable behavior that does not exist:

1. Create or extend the Cmx component in `src/ui`.
2. Add exports.
3. Add usage example if project docs have component docs.
4. Use the Cmx component from feature code.
5. Do not create one-off raw shadcn copies in the feature.
