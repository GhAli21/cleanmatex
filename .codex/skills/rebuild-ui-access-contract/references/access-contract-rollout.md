# Access Contract Rollout Reference

## Source Of Truth

- Contract primitives: `web-admin/lib/auth/access-contracts.ts`
- Route registry: `web-admin/src/features/access/page-access-registry.ts`
- Feature-local contracts: `web-admin/src/features/*/access/`
- Inspector popup: `web-admin/src/ui/navigation/cmx-top-bar.tsx`
- API permission enforcement: `web-admin/app/api/**` and `web-admin/app/actions/**`

## In-Scope Routes

Cover all active `web-admin/app/dashboard/**/page.tsx` routes.

Exclude only:
- disabled routes such as `*.disabled`
- non-route files like `loading.tsx` and `error.tsx`

## In-Scope Action Gates

Capture every currently gated UI action on in-scope pages, including:
- toolbar buttons
- row actions
- modal launchers
- gated fields and sections
- gated columns
- gated tabs

## In-Scope API Dependencies

Capture page-linked APIs from:
- direct page fetches
- feature hooks and API client modules used by the page
- server actions invoked by the page
- auth-only endpoints used by the page when no explicit permission exists
- platform APIs called through `rbacFetch` or `lib/api/*` wrappers

Use this precedence:
1. direct page calls and imports
2. feature hooks and client modules
3. backend/server permission checks
4. auth-only notes when no explicit permission exists
5. upstream/platform API notes when local enforcement is outside `web-admin`

## Documentation Rules

Always update both:
- `docs/platform/permissions/PERMISSIONS_BY_SCREEN.md`
- `docs/platform/permissions/all_contract-aligned_UI_Permissions.md`
- `docs/platform/permissions/PERMISSIONS_BY_API.md`

The master inventory should list:
- route
- page label
- page permissions
- feature flags
- workflow roles
- action labels and action gates
- page-linked APIs should stay on the page contract and be documented in `PERMISSIONS_BY_API.md`
- notes for intentionally open pages

For page-scoped runs:
- update only the selected page rows in the UI inventory
- update only the linked API rows in `PERMISSIONS_BY_API.md`

For full runs:
- rebuild all active page contracts
- rebuild all linked API documentation rows

## Migration Notes

- Do not change backend authorization semantics
- Prefer replacing hardcoded frontend permission literals with contract reads
- Prefer keeping API dependency entries explicit on the page contract
- Keep notes on routes that intentionally rely on shell context, navigation visibility, or backend enforcement
