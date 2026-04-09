---
version: v2.0.0
last_updated: 2026-04-01
author: CleanMateX Team
---

# Permissions by Screen

This document is now contract-aligned.

## Source Of Truth

Frontend route and action access is defined in:

- `web-admin/lib/auth/access-contracts.ts`
- `web-admin/src/features/access/page-access-registry.ts`
- `web-admin/src/features/*/access/*.ts`

The complete UI inventory lives in:

- [all_contract-aligned_UI_Permissions.md](./all_contract-aligned_UI_Permissions.md)

Page-linked backend permissions are documented separately in:

- [PERMISSIONS_BY_API.md](./PERMISSIONS_BY_API.md)

## What This Covers

- Active `web-admin/app/dashboard/**/page.tsx` routes
- Page-level UI access gates
- Action-level UI access gates
- Feature-flag gates
- Workflow-role and tenant-role gates
- Intentionally open pages with no explicit UI permission requirement

## Contract Notes

- A page can intentionally have no explicit UI permission gate. That is valid and must still be represented by a contract.
- Backend authorization remains the final authority.
- Navigation metadata is not the primary source of truth once a route has an explicit contract.
- Linked APIs may be declared on the page contract through `apiDependencies`, but their required permissions still come from backend route or server-action enforcement.

## Representative Explicit UI Gates

| Route | Page Gate | Action Gates | Notes |
|---|---|---|---|
| `/dashboard/b2b/contracts` | `b2b_contracts:view` + feature flag `b2b_contracts` | `Create contract` → `b2b_contracts:create` | Contract-first page and action gate |
| `/dashboard/catalog/preferences` | any of `orders:service_prefs_view`, `orders:read`, `config:preferences_manage` | manage preferences actions → `config:preferences_manage` | Page gate allows viewers; actions stay admin-only |
| `/dashboard/catalog/customer-categories` | `config:preferences_manage` | manage categories → `config:preferences_manage` | Page and actions aligned |
| `/dashboard/billing/payments` | no explicit page permission | `Cancel payment` → `payments:cancel`, `Refund payment` → `payments:refund` | Open page, gated row actions |
| `/dashboard/settings/workflow-roles` | `settings:workflow_roles:view` | none | Explicit page gate |
| `/dashboard/settings/roles` | wildcard/settings/role-prefix/tenant-role contract | none | Page gate is declarative in the contract |
| `/dashboard/settings/permissions` | wildcard/settings/permission-prefix/tenant-role contract | none | Page gate is declarative in the contract |
| `/dashboard/orders/new` | no explicit page permission | `Use price override controls` → `pricing:override` | Action-only gate |
| `/dashboard/reports/*` | feature flag `advanced_analytics` | none | Feature-flag page gate |
| `/dashboard/erp-lite/*` | route-specific `erp_lite_*:view` + ERP-Lite feature flags | page-linked ERP-Lite server actions inherit the same route permission unless a stricter action gate is declared | Finance routes are contract-backed and now include live runtime coverage for COA, reports, expenses, treasury, AP/PO, and profitability screens |
| `/dashboard/erp-lite` | `erp_lite:view` + `erp_lite_enabled` | none (read-only cockpit) | ERP-Lite home cockpit; shortcuts respect sub-route permissions/flags server-side |
| `/dashboard/erp-lite/journals` | `erp_lite_gl:view` + `erp_lite_enabled`, `erp_lite_gl_enabled` | none | Journal register links into GL with `journalId` query |
| `/dashboard/erp-lite/setup` | `erp_lite:view` + `erp_lite_enabled` | none | Local-only setup checklist (localStorage) |
| `/dashboard/erp-lite/finance-actions` | `erp_lite_periods:view` + `erp_lite_enabled`, `erp_lite_periods_enabled` | none | Read-only `org_fin_post_action_tr` audit list |
| `/dashboard/erp-lite/exceptions` | `erp_lite_exceptions:view` + `erp_lite_enabled`, `erp_lite_exceptions_enabled` | `Resolve exception` → `erp_lite_post_audit:view` (contract) | Exception workbench |
| `/dashboard/erp-lite/usage-maps` | `erp_lite_usage_map:view` + `erp_lite_enabled`, `erp_lite_usage_map_enabled` | usage-map server actions per contract | Usage mapping console |
| `/dashboard/erp-lite/periods` | `erp_lite:view` + `erp_lite_enabled`, `erp_lite_periods_enabled` | period server actions per contract | Period close precheck links to GL (`dateFrom`/`dateTo`) and exceptions |
| `/dashboard/erp-lite/posting-audit` | `erp_lite_post_audit:view` + `erp_lite_enabled`, `erp_lite_post_audit_enabled` | none | Posting audit viewer |
| `/dashboard/erp-lite/readiness` | `erp_lite:view` + `erp_lite_enabled`, `erp_lite_readiness_enabled` | none | Finance readiness |
| `/dashboard/erp-lite/reports` | `erp_lite_reports:view` + `erp_lite_enabled`, `erp_lite_reports_enabled` | none | Trial balance / P&L / balance sheet rows link to GL via `?accountCode=` (same param family as GL inquiry) |
| `/dashboard/erp-lite/branch-pl` | `erp_lite_branch_pl:view` + `erp_lite_enabled`, `erp_lite_branch_pl_enabled` | create/post allocation and cost runs inherit `erp_lite_branch_pl:view` | Branch profitability now includes audited allocation and costing controls with linked server actions |

## Related Docs

- [all_contract-aligned_UI_Permissions.md](./all_contract-aligned_UI_Permissions.md)
- [PERMISSIONS_REFERENCE.md](./PERMISSIONS_REFERENCE.md)
- [PERMISSIONS_BY_MODULE.md](./PERMISSIONS_BY_MODULE.md)
- [PERMISSIONS_BY_API.md](./PERMISSIONS_BY_API.md)
- [NAVIGATION_PERMISSIONS.md](./NAVIGATION_PERMISSIONS.md)
