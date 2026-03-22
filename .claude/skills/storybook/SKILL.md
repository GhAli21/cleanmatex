---
name: storybook
description: >
  Storybook story generation standards for CleanMateX web-admin.
  Auto-invoked when generating or reviewing .stories.tsx files for Cmx Design System
  components (src/ui/) or feature components (src/features/).
  Covers story structure, RTL stories, a11y, mock patterns, and naming conventions.
  This file is the authoritative reference loaded by the storybook-generator agent
  before writing any story file.
user-invocable: true
---

# Storybook Skill — CleanMateX

## Scope

| This skill owns | Not this skill |
|---|---|
| `.stories.tsx` file structure and content | Component logic or props design → `/frontend` |
| RTL story variants | Which RTL Tailwind classes to use → `/frontend` |
| Mock data and decorator patterns | i18n translation keys → `/i18n` |
| Story naming and file placement conventions | JSDoc on the component itself → `/code-documentation` |
| Storybook commands | Build/dev commands → `/dev-commands` |

---

## Mandatory Rules

1. **Every component in `src/ui/`** must have a `.stories.tsx` file — no exceptions.
2. **`tags: ['autodocs']`** on every `meta` — required for auto-generated docs page.
3. **Always include an RTL story** for any component that has visible text or directional layout.
4. **`parameters: { layout: 'centered' }`** for atomic components; `'fullscreen'` for layout/page components.
5. **Never import from `@/components/ui` or `@ui/compat`** — use `@ui/primitives`, `@ui/feedback`, etc.
6. **No real API calls, auth, or DB access in stories** — use static mock data and decorators.
7. **Story file lives alongside the component** — `CmxButton.stories.tsx` next to `cmx-button.tsx`.

---

## Story File Structure

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs'
import { fn } from 'storybook/test'
// Import component using @ui/* path alias
import { CmxButton } from '@ui/primitives'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Primitives/CmxButton',   // Category/ComponentName — see Naming below
  component: CmxButton,
  parameters: {
    layout: 'centered',             // 'centered' | 'fullscreen' | 'padded'
  },
  tags: ['autodocs'],               // Required — generates API docs page
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'outline', 'destructive'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },  // or fn() for interaction tests
  },
  args: {
    // Default args shared by all stories — override per story
    children: 'Button',
    onClick: fn(),
  },
} satisfies Meta<typeof CmxButton>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: { variant: 'primary', children: 'Save Order' },
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' },
}

export const Loading: Story = {
  args: { loading: true, children: 'Saving…' },
}

export const Disabled: Story = {
  args: { disabled: true, children: 'Unavailable' },
}

// RTL story — required for any component with text or directional layout
export const RTL: Story = {
  args: { children: 'حفظ الطلب' },
  parameters: { direction: 'rtl' },   // activates dir="rtl" via preview.ts decorator
}
```

---

## Naming Conventions

### `title` field — Category/ComponentName

| Source directory | Category prefix |
|---|---|
| `src/ui/primitives/` | `Primitives/` |
| `src/ui/feedback/` | `Feedback/` |
| `src/ui/forms/` | `Forms/` |
| `src/ui/data-display/` | `DataDisplay/` |
| `src/ui/navigation/` | `Navigation/` |
| `src/ui/overlays/` | `Overlays/` |
| `src/features/**/` | `Features/FeatureName/` |

### Export names (story variants)

Use **PascalCase** descriptive names — they appear as tabs in Storybook:

```
Default, Primary, Secondary, Ghost, Outline, Destructive
Loading, Disabled, WithIcon, WithError, WithHelpText
Small, Medium, Large
RTL                   ← always this exact name for Arabic layout stories
AllVariants           ← when showing a grid of all variants in one story
Playground            ← interactive story with all controls exposed
```

---

## Per-Component Story Checklist

### Primitives

**CmxButton** — stories: Primary, Secondary, Ghost, Outline, Destructive, Loading, Disabled, AllSizes, RTL

**CmxInput** — stories: Default, WithLabel, WithError, WithHelpText, WithLeftIcon, WithRightIcon, Disabled, RTL

**CmxTextarea** — stories: Default, WithLabel, WithError, Disabled, RTL

**CmxSelect** — stories: Default, WithLabel, WithError, Disabled, RTL

**CmxCheckbox** — stories: Default, Checked, Indeterminate, Disabled, WithLabel, RTL

**CmxSwitch** — stories: Default, Checked, Disabled, WithLabel, RTL

**CmxSpinner** — stories: Default, AllSizes

**CmxCard** — stories: Default, WithHeader, WithFooter, WithAll, RTL

### Feedback

**CmxStatusBadge** — stories: AllVariants (grid), WithIcon, Pulse, AllSizes, RTL

**CmxProgressBar** — stories: Default, InProgress, Complete, RTL

**CmxProgressIndicator** — stories: Default, WithSteps, RTL

**CmxSummaryMessage** — stories: Success, Error, Warning, Info, RTL

**CmxConfirmDialog** — stories: Default, Open (use decorator to control open state), RTL

### Forms

**CmxForm** — stories: Default (with CmxFormField children), WithValidation, RTL

**CmxFormField** — stories: Default, WithError, Required, RTL

**CmxSelectDropdown** — stories: Default, WithOptions, Disabled, RTL

**CmxCheckboxGroup** — stories: Default, WithPreselected, RTL

### Data Display

**CmxDataTable** — stories: Default (with sample columns+data), Loading, Empty, WithPagination, RTL

**CmxKpiStatCard** — stories: Default, WithTrend, AllVariants, RTL

**CmxEmptyState** — stories: Default, WithAction, RTL

**CmxProcessingStepTimeline** — stories: Default, InProgress, Completed, RTL

### Navigation

**CmxTabsPanel** — stories: Default, WithBadge, RTL

**CmxProgressSteps** — stories: Default, Step2Active, Completed, RTL

**CmxLanguageSwitcher** — stories: Default (no auth needed — static toggle)

### Overlays

**CmxDialog** — stories: Default (closed), Open (use useState decorator), WithForm, RTL

---

## RTL Stories — Pattern

The Storybook toolbar already has a Direction toggle (configured in `.storybook/preview.ts`). The `RTL` story sets it to `'rtl'` by default so reviewers see Arabic layout immediately:

```tsx
export const RTL: Story = {
  name: 'RTL (Arabic)',
  args: {
    // Use real Arabic text — not Lorem Ipsum
    label: 'رقم الطلب',
    placeholder: 'أدخل رقم الطلب',
  },
  parameters: {
    direction: 'rtl',   // passed to preview.ts decorator → sets document.documentElement.dir
  },
}
```

**Real Arabic text to use in stories:**

| Context | Arabic |
|---|---|
| Button save | حفظ |
| Button cancel | إلغاء |
| Button delete | حذف |
| Button submit | إرسال |
| Input label | رقم الطلب |
| Input placeholder | أدخل القيمة |
| Search placeholder | بحث... |
| Status: active | نشط |
| Status: processing | قيد المعالجة |
| Status: completed | مكتمل |
| Status: cancelled | ملغى |
| Table header | الاسم |
| Empty state title | لا توجد نتائج |
| Dialog title | تأكيد الحذف |

---

## Mock Data Patterns

### Static table data

```tsx
// Mock data for CmxDataTable stories — no API call
const mockOrders = [
  { id: '1001', customer: 'Ahmed Al-Rashid', status: 'NEW', total: 45.00 },
  { id: '1002', customer: 'Sarah Johnson', status: 'IN_PROGRESS', total: 128.50 },
  { id: '1003', customer: 'Mohammed Ali', status: 'COMPLETED', total: 67.25 },
]

const mockColumns: ColumnDef<typeof mockOrders[0]>[] = [
  { accessorKey: 'id', header: 'Order #' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'total', header: 'Total' },
]
```

### Controlled open state (Dialog, Confirm)

```tsx
// Decorator to control open/close state for overlay components
export const Open: Story = {
  decorators: [
    (StoryComponent) => {
      const [open, setOpen] = React.useState(true)
      return <StoryComponent args={{ open, onOpenChange: setOpen }} />
    },
  ],
}
```

### Icon usage

```tsx
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
// Pass Lucide icon components directly — they match LucideIcon type
args: { icon: CheckCircle, showIcon: true }
```

---

## a11y Requirements

Every story must pass Storybook's `@storybook/addon-a11y` panel (no red violations). Common rules:

- Interactive elements must have accessible labels (`aria-label` or visible text)
- Form inputs must be linked to labels (CmxInput handles this automatically via `id`)
- Color is not the only indicator of state (status badges use both color + text)
- Focus ring must be visible in keyboard nav (handled by Cmx theme tokens)

Stories that intentionally test accessibility edge cases:

```tsx
export const A11yMinimal: Story = {
  name: 'A11y: icon-only button',
  args: { children: <SearchIcon />, 'aria-label': 'Search orders' },
}
```

---

## Story Generation Workflow (for the agent)

When generating stories for a component, follow this sequence:

1. **Read the component file** — extract props interface, variant values, default props
2. **Identify story set** — use the per-component checklist above; add extras if component has unique behavior
3. **Write the `meta` block** — correct `title` category, full `argTypes`, shared `args`
4. **Write each story** — one export per variant, use real-world content (not "foo", "test")
5. **Add RTL story** — always, for any component with visible text
6. **Verify imports** — use `@ui/*` paths, never `@/components/ui` or `@ui/compat`
7. **Check `play` functions** — add for interactive stories (form submit, dialog open/close, etc.)

---

## Commands

```bash
cd web-admin

npm run storybook          # Dev server → localhost:6006 (hot reload)
npm run docs:storybook     # Static build → docs/storybook/
npm run docs:generate      # TypeDoc + Storybook static build together
```

---

## File Placement

```
src/ui/primitives/
  cmx-button.tsx
  CmxButton.stories.tsx    ← story lives next to component

src/ui/feedback/
  cmx-status-badge.tsx
  CmxStatusBadge.stories.tsx

src/features/orders/
  OrderCard.tsx
  OrderCard.stories.tsx    ← feature stories: optional but encouraged
```

Stories in `src/stories/` are Storybook init samples — they can be deleted once real stories exist.

---

## app/ Components — Eligibility Rules

`app/` is **not scanned** by Storybook (`.storybook/main.ts` only scans `src/`). However, some files in `app/` are eligible for stories — they must be extracted to `src/features/` first.

### Eligible — extract and story

These file patterns in `app/` contain presentational Client Components that benefit from story coverage:

| Pattern | Example | Action |
|---|---|---|
| `*-client.tsx` | `order-detail-client.tsx` | Extract to `src/features/<domain>/` → add story |
| `*-form.tsx` | `create-payment-form.tsx` | Extract to `src/features/<domain>/` → add story |
| `components/*.tsx` | `overdue-orders-widget.tsx` | Extract to `src/features/<domain>/` → add story |

### Not eligible — never story

| Pattern | Reason |
|---|---|
| `page.tsx` | Next.js Server Component, requires routing context |
| `layout.tsx` | App shell, requires routing + auth |
| `loading.tsx` | Next.js streaming skeleton — no props to story |
| `error.tsx` | Next.js error boundary — not a UI component |

### Extraction workflow (agent must follow)

When asked to generate stories for an `app/` component:

1. **Check eligibility** — is it a `-client.tsx`, `-form.tsx`, or `components/*.tsx`?
2. **Search all importers** — grep for the component name across `app/` and `src/` before proposing. Update ALL matched files, not just the parent `page.tsx`.
3. **Copy to new path + backup original** — write content to `src/features/<domain>/ComponentName.tsx`, copy original to `app/_backup/` (mirroring its path). Do NOT delete the original. User deletes `app/_backup/` manually after confirming build and stories work.
4. **Import path after move** — use `@features/<domain>/ComponentName` (alias defined in `tsconfig.json`), never relative paths.
5. **Update barrel file** — if `src/features/<domain>/ui/index.ts` or `index.ts` exists, add the export. If neither exists, ask the user whether to create one.
6. **Verify `'use client'`** — must remain on line 1 if it was there before.
7. **Run `npm run build`** — validate TypeScript resolves all imports before generating the story.
8. **Generate story** at `src/features/<domain>/ComponentName.stories.tsx`
9. **If user declines extraction** — write the story to `src/stories/ComponentName.stories.tsx` as a fallback (Storybook scans `src/` fully)

### Mock auth/tenant for app/ component stories

`app/` client components often use `useAuth()` or call server actions. Mock these with a decorator:

```tsx
import React from 'react'

// Mock auth context for feature component stories
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
  // Provide static mock values — never real Supabase calls in stories
  <div data-mock-tenant="org_demo_001">{children}</div>
)

export const Default: Story = {
  decorators: [
    (StoryComponent) => (
      <MockAuthProvider>
        <StoryComponent />
      </MockAuthProvider>
    ),
  ],
}
```

> If the component calls `useAuth()` directly, it will throw in Storybook. Suggest the user pass auth values as props instead (more testable), or wrap with a mock context provider.
