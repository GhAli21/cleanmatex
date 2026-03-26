# Access Contract Rollout Reference

## Source Of Truth

- Contract primitives: `web-admin/lib/auth/access-contracts.ts`
- Route registry: `web-admin/src/features/access/page-access-registry.ts`
- Feature-local contracts: `web-admin/src/features/*/access/`
- Inspector popup: `web-admin/src/ui/navigation/cmx-top-bar.tsx`

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

## Documentation Rules

Always update both:
- `docs/platform/permissions/PERMISSIONS_BY_SCREEN.md`
- `docs/platform/permissions/all_contract-aligned_UI_Permissions.md`

The master inventory should list:
- route
- page label
- page permissions
- feature flags
- workflow roles
- action labels and action gates
- notes for intentionally open pages

## Migration Notes

- Do not change backend authorization semantics
- Prefer replacing hardcoded frontend permission literals with contract reads
- Keep notes on routes that intentionally rely on shell context, navigation visibility, or backend enforcement
