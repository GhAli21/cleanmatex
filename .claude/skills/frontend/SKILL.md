---
name: frontend
description: CleanMateX web-admin frontend standards for Next.js App Router, React, TypeScript, TailwindCSS, next-intl, and Cmx Design System. Use when creating or editing pages, screens, forms, tables, dialogs, reports, route UI, feature UI, reusable UI, or frontend i18n.
user-invocable: true
effort: medium
agents:
---

# CleanMateX Frontend Skill

This skill is authoritative for `web-admin` frontend work.

CleanMateX uses:

- Next.js App Router
- React + TypeScript
- TailwindCSS
- next-intl / i18n
- Cmx Design System
- TanStack Query
- React Hook Form + Zod
- Supabase / API clients depending on feature context

## 1. Load order

When working on frontend code, apply these files in this order:

1. `SKILL.md` — hard gates and workflow.
2. `architecture.md` — folder boundaries, imports, route/menu rules.
3. `standards.md` — coding, forms, data, permissions, lint rules.
4. `ui-blueprint.md` — Cmx component contracts.
5. `uiux-rules.md` — UX, accessibility, RTL, states.

For menu-visible routes, load the `/navigation` skill before writing route code.

## 2. Hard gates

1. Never create a root `components/` folder.
2. Never create `components/ui`.
3. `app/` is routing and composition only.
4. Reusable UI lives in `src/ui/` and must use the `Cmx` prefix.
5. Feature UI lives in `src/features/<feature>/ui/`.
6. Feature API clients live in `src/features/<feature>/api/`.
7. Feature hooks live in `src/features/<feature>/hooks/`.
8. Feature types/mappers live in `src/features/<feature>/model/`.
9. Shared infrastructure lives in root `lib/`.
10. Use only these project aliases: `@ui/*`, `@features/*`, `@lib/*`.
11. Do not invent aliases such as `@/components`, `@/core`, or `@ui/compat`.
12. Do not import raw shadcn/ui or Radix primitives directly inside feature code. Wrap them in Cmx components first.
13. **Mandatory:** all applicable user-facing messages, alerts, errors, confirmations, and toasts must use `cmxMessage` or `useMessage()` from `@ui/feedback` (`docs/dev/rules/cmx-message.md`). Do not add new legacy `showSuccessToast` / raw `toast()` / `alert()` call sites. Not for field validation, `CmxSummaryMessage`, `CmxConfirmDialog`, or static labels.
14. All user-facing text must use i18n keys.
15. Search existing locale keys before adding new keys.
16. When adding keys, update matching English and Arabic files under `web-admin/messages/en/**` and `web-admin/messages/ar/**`.
17. Pagination must be server-side/API-driven.
18. Editable grids must use `CmxEditableDataTable`.
19. Non-editable large lists must use a server-side `CmxDataTable` contract.
20. Async actions must have loading, success, error, and empty states as applicable.
21. Arabic RTL must be supported for layout, icons, alignment, and text direction.
22. Do not hardcode brand colors or hex values in feature UI.
23. Use design tokens and CSS variables.
24. Menu-visible routes require the `/navigation` dual-write workflow.
25. Do not hand-edit generated files, inventories, access contracts, or generated route/permission outputs unless the file explicitly says it is manually maintained.
26. Before finishing, run the mandatory frontend verification commands listed in `standards.md`.
27. No silent money mutation: apply `docs/dev/rules/no-silent-money-mutation.md`. Prevent invalid entry first, explain unavoidable adjustments inline at the moment they occur, and never rewrite user-entered money as a side effect of a toggle, mode switch, or dialog close.

## 3. Canonical folder structure

```txt
web-admin/
  app/                    # routing only
  src/
    ui/                   # global reusable Cmx Design System
      foundations/
      primitives/
      forms/
      data-display/
      navigation/
      layouts/
      patterns/
      charts/
      feedback/
      overlays/
    features/             # domain modules
      orders/
        ui/
        reports/
        api/
        hooks/
        model/
  lib/                    # shared infrastructure
    api/
    supabase/
    hooks/
    utils/
    config/
  messages/
    en/
    ar/
```

## 4. App Router rule

`app/**/page.tsx` should compose feature screens only.

```tsx
import { OrderListScreen } from '@features/orders/ui/order-list-screen'

export default function OrdersPage() {
  return <OrderListScreen />
}
```

Do not put domain logic, reusable components, feature hooks, or design-system primitives in `app/`.

## 5. Naming rules

- Screens: `<feature>-<screen>-screen.tsx`
- Reports: `<feature>-<report-name>-rprt.tsx`
- Reusable UI: `cmx-<component>.tsx`, exported as `Cmx<Component>`
- Hooks: `use-<feature-or-purpose>.ts`
- API client: `<feature>-api.ts`
- Model/types: `<feature>-types.ts`, `<feature>-mapper.ts`

Examples:

```txt
src/features/orders/ui/order-list-screen.tsx
src/features/orders/reports/orders-payments-print-rprt.tsx
src/features/orders/api/orders-api.ts
src/features/orders/hooks/use-orders.ts
src/features/orders/model/order-types.ts
src/ui/primitives/cmx-button.tsx
```

## 6. Route and navigation hard gate

Any route that appears, should appear, or previously appeared in the sidebar/system menu must use the `/navigation` workflow.

Required artifacts must stay synchronized:

1. `app/<segment>/page.tsx`
2. `web-admin/config/navigation.ts`
3. `supabase/migrations/{seq}_nav_*.sql` for `sys_components_cd`

Do not create, rename, move, or remove a menu-visible page without updating both navigation config and DB navigation/RBAC migration.

## 7. Data-fetching decision rule

Use this default decision tree:

- Server Component: initial read-only route composition or static page data.
- TanStack Query: interactive lists, filters, pagination, refresh, mutations, dialogs, and client-side workflows.
- Feature API client: all feature-owned API calls.
- `lib/api`: base HTTP client, interceptors, auth headers, shared errors.
- Supabase client: only where the existing feature architecture already uses it or the project decision says this module is Supabase-direct.
- Server Action: only for small, controlled mutations where the current app architecture already uses Server Actions.

Never scatter API calls directly inside complex UI components.

## 8. Permission and feature gate rule

Frontend gates are UX only. Backend/API/RLS must enforce security again.

For restricted actions:

1. Check permission/feature flag before rendering the action.
2. Keep action unavailable or disabled with a clear reason.
3. Enforce again in backend/API/server action.
4. Use `cmxMessage` for controlled denial messages.

## 9. Required verification before done

Run from `web-admin`:

```bash
npx eslint . --quiet
npm run typecheck
npm run build
```

If the repo does not have `typecheck` or build scripts, report that honestly and run the closest available scripts from `package.json`.

## 10. Stop conditions

Stop and ask for review before applying migrations or changing generated artifacts.

Stop and report clearly if:

- navigation and route contracts conflict,
- a reusable Cmx component does not exist and must be created,
- locale key ownership is unclear,
- the requested UI violates established Cmx design-system contracts,
- permission or feature flag ownership is unknown.
