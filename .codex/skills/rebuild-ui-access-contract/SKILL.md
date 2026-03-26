---
name: rebuild-ui-access-contract
description: Build or repair contract-first UI and page-linked API access control for web-admin dashboard routes. Use when adding or changing permission-gated buttons, page access, workflow-role gates, feature-flag gates, linked API dependencies, the permissions inspector popup, or the contract-aligned UI/API permissions documentation.
user-invocable: true
---

# Rebuild UI Access Contract

Use this skill for `web-admin` dashboard route access work.

## Inputs

- Specific page mode: pass a concrete dashboard route path such as `/dashboard/b2b/contracts`
- Full rebuild mode: omit the route path to rebuild all active `web-admin/app/dashboard/**/page.tsx` routes

## Use It When

- A dashboard page is added, renamed, or removed
- A page gets a permission gate, feature flag, workflow-role gate, or tenant-role gate
- A button, row action, modal, field, column, or tab becomes access-controlled
- A page needs linked API dependency coverage or API permission documentation
- The shield permissions inspector changes
- Permissions/access docs need to reflect current UI behavior

## Required Outcomes

1. Every active `web-admin/app/dashboard/**/page.tsx` route has a page access contract
2. Every currently gated UI action on those routes is represented in a contract
3. Page-linked APIs are represented via `apiDependencies` when the page uses explicit permission-gated APIs or server actions
4. The route registry resolves the current page contract
5. The shield popup reads contracts first for both `UI Access` and `API Access`
6. Docs are updated:
   - `docs/platform/permissions/PERMISSIONS_BY_SCREEN.md`
   - `docs/platform/permissions/all_contract-aligned_UI_Permissions.md`
   - `docs/platform/permissions/PERMISSIONS_BY_API.md`

## Workflow

1. Pick the rebuild mode
   - page mode for one concrete dashboard route
   - full mode for all active dashboard pages
2. Discover existing access checks
   - Search `web-admin/app/dashboard/**` and `web-admin/src/features/**`
   - Inventory `RequirePermission`, `RequireAnyPermission`, `RequireAllPermissions`, `useHasPermission`, `useHasAnyPermission`, direct permission array checks, workflow-role checks, and feature-flag guards
3. Discover page-linked APIs
   - inspect direct page fetch calls and server actions
   - inspect feature hooks and API client modules used by that page
   - map them to explicit backend/server permission checks such as `requirePermission(...)` and `hasPermissionServer(...)`
   - record auth-only APIs with no explicit permission requirement as notes
   - when a page uses platform APIs through `rbacFetch` or `lib/api/*`, record them as linked dependencies with notes when permission enforcement is upstream and not visible in local `web-admin/app/api/**`
4. Derive the page contract from existing code in this order
   - explicit page/action permission checks
   - workflow-role guards
   - feature-flag guards
   - navigation metadata only if no stronger page gate exists
5. Add or repair feature-local contracts under `web-admin/src/features/<feature>/access/`
   - keep `page`, `actions`, and `apiDependencies` on the page contract
6. Register route contracts in `web-admin/src/features/access/page-access-registry.ts`
7. Replace inline UI gate literals with contract reads where practical
8. Keep the shield popup aligned with the selected page contract
   - `UI Access` for page/actions
   - `API Access` for linked APIs
9. Update documentation for the chosen mode
   - page mode updates the selected page rows and only its linked APIs
   - full mode rebuilds the complete UI/API permissions inventories
10. Run validation

## Contract Rules

- Shared primitives live in `web-admin/lib/auth/access-contracts.ts`
- Registry lives in `web-admin/src/features/access/page-access-registry.ts`
- Feature contracts live in `web-admin/src/features/*/access/`
- Linked APIs live in `PageAccessContract.apiDependencies`
- A page with no explicit permission gate still needs a contract
- For intentionally open pages, use an empty `page` requirement and note that there is no explicit UI permission gate
- A page can have linked APIs even when the page itself has no explicit UI permission requirement
- API dependency entries must be explicit; do not rely on route-name guessing alone
- Pages that use platform APIs may still declare `apiDependencies`; if local permission enforcement is not discoverable, leave `requirement` empty and explain that enforcement is upstream
- Missing contract coverage for an active route is a defect

## Validation

- Coverage check for all active dashboard routes
- Contract evaluation tests for permissions, wildcards, feature flags, workflow roles, empty permission contracts, and linked API dependencies where applicable
- Search-based verification of linked API permission sources
- Relevant frontend tests for changed pages/actions
- `npm run build` in `web-admin`

## References

- For the rollout checklist and documentation expectations, read `references/access-contract-rollout.md`
