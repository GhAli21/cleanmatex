# CleanMateX Frontend Coding Standards

This document defines how frontend code should be written after the architecture boundaries are respected.

## 1. Technology defaults

- TypeScript only for app code.
- React functional components only.
- Next.js App Router.
- TailwindCSS for layout and spacing.
- Cmx Design System for reusable UI.
- TanStack Query for interactive async client workflows.
- React Hook Form + Zod for non-trivial forms.
- next-intl / approved i18n helper for translations.
- **Mandatory:** `cmxMessage` / `useMessage()` from `@ui/feedback` for all applicable user-facing operational feedback (`docs/dev/rules/cmx-message.md`). No new legacy toast helpers.

## 2. TypeScript rules

- Prefer explicit domain types from `src/features/<feature>/model`.
- Avoid `any`. If unavoidable, isolate it and explain why.
- Use discriminated unions for statuses, modes, and variant-heavy UI.
- Keep mappers separate from UI when transforming API records.
- Do not duplicate backend enums manually unless there is no generated/shared source.

## 3. Component rules

A component should be small and focused.

Use this split:

- Screen component: orchestration, hooks, layout composition.
- View component: presentational domain UI.
- Form component: one bounded form flow.
- Dialog/drawer component: one bounded overlay flow.
- Table component: columns, filters, actions for one list.
- Cmx component: generic reusable UI, no domain assumptions.

Avoid components that mix:

- data fetching,
- mutation logic,
- form validation,
- table columns,
- permissions,
- dialog state,
- layout,
- formatting.

Split when the component becomes hard to test or reason about.

## 4. Data-fetching rules

### 4.1 Server Components

Use Server Components for:

- route-level read-only composition,
- static metadata,
- initial shell data that does not need client-side refresh,
- authenticated server-side checks when already established in the app.

Do not put interactive table/filter mutation logic in Server Components.

### 4.2 TanStack Query

Use TanStack Query for:

- interactive lists,
- server-side pagination,
- filtering and sorting,
- mutations,
- optimistic or invalidated refresh,
- dialogs that create/update/delete data,
- workflows that need retry/loading/error states.

Query keys must be stable and include tenant/filters/page where relevant.

```ts
const ordersQueryKey = ['orders', tenantId, filters, page, pageSize]
```

### 4.3 Feature API clients

Feature-owned API calls belong under:

```txt
src/features/<feature>/api/<feature>-api.ts
```

The UI should call hooks, and hooks should call feature API clients.

Preferred flow:

```txt
UI screen -> feature hook -> feature API client -> lib/api base client
```

### 4.4 Supabase direct access

Use Supabase direct access only when:

- the existing feature already uses Supabase direct access,
- the project decision for that module is Supabase-only,
- the access pattern is simple and RLS-safe,
- no custom business transaction is required.

Do not mix Supabase direct calls and REST/Nest API calls randomly in the same feature.

### 4.5 Mutations

Every mutation must provide:

- disabled/loading state,
- success feedback through `cmxMessage`,
- error feedback through `cmxMessage`,
- permission/feature-flag guard,
- cache invalidation or refresh,
- controlled validation errors.

## 5. Forms

Use React Hook Form + Zod for non-trivial forms.

Rules:

- Use `zodResolver`.
- Infer form type from Zod schema.
- Use `useWatch`; do not use `form.watch()` in render-heavy components.
- Avoid `setState` in `useEffect` for derived form values.
- Use Cmx form components from `@ui/forms`.
- Show inline validation messages.
- Submit buttons must show loading state.
- Cancel/close behavior must be explicit and safe.

Pattern:

```tsx
const schema = z.object({
  name: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: '' },
})
```

## 6. Tables and lists

Pagination is always server-side/API-driven.

Do not load all records and paginate in the browser except for tiny static lookup lists.

### 6.1 Non-editable tables

Use `CmxDataTable` with server-side contract:

- `rows`
- `columns`
- `page`
- `pageSize`
- `totalRows`
- `sort`
- `filters`
- `onPageChange`
- `onPageSizeChange`
- `onSortChange`
- `loading`
- `error`
- `emptyState`
- `rowActions`

### 6.2 Editable tables

Use `CmxEditableDataTable`.

Required behavior:

- row-level validation,
- dirty state,
- save/cancel controls,
- loading/error states,
- keyboard-safe editing,
- clear conflict handling,
- no silent data loss.

### 6.3 Empty states

Every list/table must have a meaningful empty state:

- what is missing,
- why it matters,
- primary action if allowed,
- no action if permission is missing.

## 7. Messages and errors

**Mandatory** — use `cmxMessage` or `useMessage()` from `@ui/feedback` for:

- success toasts,
- error toasts,
- warnings,
- info / loading feedback,
- imperative destructive confirmations (when not using `CmxConfirmDialog`),
- permission denial toasts,
- validation summaries shown as global feedback,
- async operation feedback (`cmxMessage.promise`).

Canonical rule: `docs/dev/rules/cmx-message.md`.

Do **not** call raw `toast()`, Sonner, `alert()`, `window.confirm`, or legacy `showSuccessToast` / `showErrorToast` / `showInfoToast` / `cmxToast` from new or edited feature code.

Field-level RHF/Zod errors stay on the field. Persistent banners use `CmxSummaryMessage`. Dedicated dialog confirms use `CmxConfirmDialog`.

Errors must be user-safe:

- no stack traces,
- no SQL details,
- no provider secrets,
- no raw backend exception dump.

## 8. Internationalization

Rules:

- All user-facing text uses i18n keys.
- Search existing keys first.
- Common actions use `common` namespace, such as save/cancel/delete/search/filter.
- Feature-specific labels use the feature namespace.
- Add keys to both English and Arabic message files.
- Keep key names semantic, not visual.

Example:

```tsx
const t = useTranslations('orders')
const tCommon = useTranslations('common')

<CmxButton>{tCommon('save')}</CmxButton>
<h1>{t('list.title')}</h1>
```

Bad:

```tsx
<CmxButton>Save</CmxButton>
```

## 9. RTL rules

Use logical or RTL-aware classes.

Correct:

```tsx
<div className="ms-4">...</div>
<ChevronRight className="rtl:rotate-180" />
<div className="text-left rtl:text-right">...</div>
```

Avoid direction-specific layout unless paired:

```tsx
<div className="ml-4 rtl:ml-0 rtl:mr-4">...</div>
```

## 10. Styling rules

Do:

- use Tailwind for layout,
- use CSS variables and Cmx tokens for colors,
- use Cmx variants for semantic actions,
- support dark mode, density, radius, and accent themes.

Do not:

- hardcode hex colors,
- hardcode brand colors like `text-blue-500`,
- duplicate shadcn variants in features,
- use inline styles for theme values,
- create one-off CSS unless there is no tokenized alternative.

## 11. Permissions and feature flags

Frontend permission checks improve UX only. They are not security enforcement.

For restricted actions:

1. Read permissions/feature flags using the approved app hook or context.
2. Hide or disable action with a reason.
3. Backend/API/server action must enforce again.
4. Use `cmxMessage` for denied actions.
5. Keep audit-relevant reasons in the payload where required.

Do not rely on CSS hiding as permission enforcement.

## 12. Reports

Reports must be:

- named with `-rprt.tsx`,
- feature-owned unless generic,
- bilingual,
- RTL-safe,
- print/PDF aware,
- token-styled,
- permission-gated,
- server-paginated when browsing large report datasets,
- export-safe with clear loading/error states.

## 13. Accessibility

Required:

- semantic HTML,
- keyboard navigation,
- visible focus state,
- labels for inputs,
- `aria-*` only when semantic HTML is insufficient,
- non-color-only status indicators,
- WCAG 2.1 AA contrast.

## 14. React lint rules

Mandatory patterns:

- no `setState` in `useEffect` for values that can be derived,
- no `form.watch()` for reactive rendering; use `useWatch`,
- internal links use `next/link`,
- no missing dependency hacks,
- no random `use client` unless the component needs client behavior,
- no browser APIs in Server Components.

Before done, read and follow if present:

```txt
docs/dev/rules/react-lint-verification-checklist.md
docs/dev/rules/react-effects-patterns.md
docs/dev/rules/react-rhf-and-table-lint.md
```

## 15. Mandatory verification

Run from `web-admin`:

```bash
npx eslint . --quiet
npm run typecheck
npm run build
```

If a script does not exist, run:

```bash
npm run
```

Then report the closest available checks and their result.

Do not claim checks passed unless they actually ran and exited successfully.
