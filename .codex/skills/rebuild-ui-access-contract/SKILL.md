---
name: rebuild-ui-access-contract
description: Build or repair contract-first UI access control for web-admin dashboard routes and gated actions. Use when adding or changing permission-gated buttons, page access, workflow-role gates, feature-flag gates, the permissions inspector popup, or the contract-aligned UI permissions documentation.
user-invocable: true
---

# Rebuild UI Access Contract

Use this skill for `web-admin` dashboard route access work.

## Use It When

- A dashboard page is added, renamed, or removed
- A page gets a permission gate, feature flag, workflow-role gate, or tenant-role gate
- A button, row action, modal, field, column, or tab becomes access-controlled
- The shield permissions inspector changes
- Permissions/access docs need to reflect current UI behavior

## Required Outcomes

1. Every active `web-admin/app/dashboard/**/page.tsx` route has a page access contract
2. Every currently gated UI action on those routes is represented in a contract
3. The route registry resolves the current page contract
4. The shield popup reads contracts first
5. Docs are updated:
   - `docs/platform/permissions/PERMISSIONS_BY_SCREEN.md`
   - `docs/platform/permissions/all_contract-aligned_UI_Permissions.md`

## Workflow

1. Discover existing access checks
   - Search `web-admin/app/dashboard/**` and `web-admin/src/features/**`
   - Inventory `RequirePermission`, `RequireAnyPermission`, `RequireAllPermissions`, `useHasPermission`, `useHasAnyPermission`, direct permission array checks, workflow-role checks, and feature-flag guards
2. Derive the contract from existing code in this order
   - explicit page/action permission checks
   - workflow-role guards
   - feature-flag guards
   - navigation metadata only if no stronger page gate exists
3. Add or repair feature-local contracts under `web-admin/src/features/<feature>/access/`
4. Register route contracts in `web-admin/src/features/access/page-access-registry.ts`
5. Replace inline UI gate literals with contract reads where practical
6. Update the shield popup to show page and action access from the contract
7. Update the contract-aligned permission docs
8. Run validation

## Contract Rules

- Shared primitives live in `web-admin/lib/auth/access-contracts.ts`
- Registry lives in `web-admin/src/features/access/page-access-registry.ts`
- Feature contracts live in `web-admin/src/features/*/access/`
- A page with no explicit permission gate still needs a contract
- For intentionally open pages, use an empty `page` requirement and note that there is no explicit UI permission gate
- Missing contract coverage for an active route is a defect

## Validation

- Coverage check for all active dashboard routes
- Contract evaluation tests for permissions, wildcards, feature flags, workflow roles, and empty permission contracts
- Relevant frontend tests for changed pages/actions
- `npm run build` in `web-admin`

## References

- For the rollout checklist and documentation expectations, read `references/access-contract-rollout.md`
