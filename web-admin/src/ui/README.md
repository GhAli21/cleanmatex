# CleanMateX UI Library

This is the **design system** for the CleanMateX Platform HQ Console.

## Structure

```
src/ui/
├── primitives/         # Low-level shadcn/ui components (Radix-based)
│   ├── button.tsx
│   ├── input.tsx
│   ├── form.tsx
│   ├── table.tsx
│   └── ...
├── components/         # High-level Cmx* components (use these in features)
│   ├── cmx-button.tsx
│   ├── cmx-input.tsx
│   ├── cmx-form.tsx
│   ├── cmx-data-table.tsx
│   ├── cmx-chart.tsx
│   └── cmx-toast.tsx
└── index.ts            # Main barrel export
```

## Usage in Features

### ✅ Correct - Use Cmx* Components

```tsx
// src/features/billing/ui/billing-form.tsx
import { CmxButton, CmxInput, CmxForm, CmxFormField } from '@ui/components'

export function BillingForm() {
  return (
    <CmxForm form={form} onSubmit={onSubmit}>
      <CmxFormField name="name" label="Name">
        {({ field }) => <CmxInput {...field} />}
      </CmxFormField>
      <CmxButton type="submit">Save</CmxButton>
    </CmxForm>
  )
}
```

### ❌ Incorrect - Don't Use Primitives Directly

```tsx
// ❌ BAD: Using shadcn primitives directly
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
```

### ⚠️ Allowed - Use Primitives Only When Necessary

```tsx
// ⚠️ OK: Only when Cmx* wrapper doesn't exist yet
import { Badge } from '@ui/primitives/badge'
import { Avatar } from '@ui/primitives/avatar'
```

## Import Aliases

```ts
// Recommended imports
import { CmxButton, CmxInput } from '@ui/components'
import { showSuccessToast, showErrorToast } from '@ui/components'

// Alternative (full path)
import { CmxButton } from '@ui/components/cmx-button'

// Main barrel (includes both components and primitives)
import { CmxButton, Badge } from '@ui'
```

## Path Aliases (tsconfig.json)

```json
{
  "paths": {
    "@ui/*": ["./src/ui/*"],
    "@features/*": ["./src/features/*"]
  }
}
```

## Design Principles

1. **Abstraction Layer**: Cmx* components wrap third-party libraries (shadcn, Recharts, Sonner)
2. **Consistency**: All features use the same UI components
3. **Theming**: Global theme changes happen in one place
4. **Future-Proof**: Easy to swap underlying libraries without breaking features
5. **Type Safety**: Strict TypeScript, no `any`

## Component Catalog

### Forms & Inputs
- `CmxButton` - Button with loading state and icons
- `CmxInput` - Text input
- `CmxForm` - Form wrapper with React Hook Form
- `CmxFormField` - Form field with label and validation

### Data Display
- `CmxDataTable` - TanStack Table wrapper
- `CmxChart` - Recharts wrapper for analytics

### Feedback
- **Global Message Utility** (`@ui/feedback`) - Unified message system with multiple display methods
  - `cmxMessage` - Core utility (use in non-React contexts)
    - `cmxMessage.success(message, options?)`
    - `cmxMessage.error(message, options?)`
    - `cmxMessage.warning(message, options?)`
    - `cmxMessage.info(message, options?)`
    - `cmxMessage.loading(message, options?)`
    - `cmxMessage.promise(promise, messages, options?)`
  - `useMessage()` - React hook with i18n integration (recommended for components)
    - `showSuccess(message, options?)`
    - `showError(message, options?)`
    - `showWarning(message, options?)`
    - `showInfo(message, options?)`
    - `showLoading(message, options?)`
    - `handlePromise(promise, messages, options?)`
  - **Display Methods**: Toast (default), Alert, Console, Inline
  - **Features**: Full RTL support, i18n integration, promise handling, type-safe
  - See [feedback/README.md](./feedback/README.md) for full documentation
  - See [feedback/MIGRATION.md](./feedback/MIGRATION.md) for migration guide
- `CmxToast` - Legacy toast wrapper (deprecated, use `cmxMessage` instead)
  - `showSuccessToast(message)` - Deprecated
  - `showErrorToast(message)` - Deprecated
  - `showInfoToast(message)` - Deprecated

## Adding New Components

### 1. Add to primitives/ (if shadcn component)

```bash
npx shadcn@latest add <component>
# Moves to src/ui/primitives/ automatically
```

### 2. Create Cmx* wrapper in components/

```tsx
// src/ui/components/cmx-<component>.tsx
'use client'

import { Component } from '@ui/primitives/<component>'

export interface CmxComponentProps {
  // ...
}

export function CmxComponent(props: CmxComponentProps) {
  // Add CleanMateX-specific behavior
  return <Component {...props} />
}
```

### 3. Export from barrel

```ts
// src/ui/components/index.ts
export * from './cmx-<component>'
```

## Related Documentation

- [UI Blueprint](@/.claude/docs/ui_blueprint.md) - Detailed component specs
- [Frontend Standards](@/.claude/docs/frontend_standards.md) - Frontend architecture rules
- [USAGE_EXAMPLES.md](../../components/ui/USAGE_EXAMPLES.md) - Component examples (legacy location)
