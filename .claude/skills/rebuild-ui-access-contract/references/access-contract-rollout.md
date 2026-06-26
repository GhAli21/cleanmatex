# Access Contract Rollout Reference

## Source of truth (edit manually)

| Layer | Path |
|-------|------|
| Primitives | `web-admin/lib/auth/access-contracts.ts` |
| Feature contracts | `web-admin/src/features/*/access/*-access.ts` |
| Registry | `web-admin/src/features/access/page-access-registry.ts` |
| Inspector | `web-admin/src/ui/navigation/permissions-inspector/` |
| API enforcement | `web-admin/app/api/**`, `web-admin/app/actions/**` |
| Permission seeds | `supabase/migrations/*_permissions_*.sql` |

## Generated (run script — do not hand-edit)

| Artifact | Refresh command |
|----------|-----------------|
| `platform-info-inventory.json` | `npm run sync:ui-access-contract` |
| `GENERATED_*.md`, `DRIFT_REPORT.md` | same |
| `web-admin/data/platform/platform-info-inventory.json` | same (ingest sync) |

Legacy hand tables under `docs/platform/permissions/PERMISSIONS_BY_SCREEN.md` are **deprecated**. Use `docs/platform/inventories/GENERATED_PERMISSIONS.md` and the Help Platform Inventories UI.

## Orchestrator script

See **[UI Access Contract User Guide](../../../docs/platform/ui-access-contract/user_guide.md)** for full command reference, scope, and check report details.

```bash
npm run check:ui-access-contract [-- --route=/dashboard/help] [-- --wire]
npm run derive:ui-access-contract -- --route=/dashboard/foo --verbose
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --prune-stale
npm run refresh:ui-access-contract -- --route=/dashboard/foo --permissions=foo:read --fix
npm run scaffold:ui-access-contract -- --route=/dashboard/foo --dry-run
npm run register:ui-access-contract -- --fix
npm run audit-wire:ui-access-contract -- --route=/dashboard/foo
npm run wire:ui-access-contract -- --route=/dashboard/foo --fix --dry-run
npm run sync:ui-access-contract
npm run rebuild:ui-access-contract
npx tsx scripts/docs/rebuild-ui-access-contract.ts show --route=/dashboard/help/platform-inventories
```

### Automated steps (script)

| Step | Command | Notes |
|------|---------|-------|
| Contract stub | `scaffold --route=...` | Resolves feature `*-access.ts` by route prefix; creates file if needed |
| Registry | `register --fix` | Adds import + spread for any unregistered `*-access.ts` |
| Wire audit | `audit-wire` | Page `RequireAnyPermission` / `useHasPermissionCode` / `useHasPermission` / imported feature UI vs contract |
| Wire fix | `wire --fix` | Wraps simple `page.tsx`; adds API guard for `/api/*` only |
| Derive | `derive --route=...` | Reverse-engineer contract from code; `--apply` merge; `--prune-stale` comment orphans |
| All-in-one | `refresh --route=... --fix` | scaffold → register → wire; add `--sync` to refresh inventories |

> Review `--dry-run` output before applying `wire --fix` on complex pages.

## Rollout checklist

### A. New or changed dashboard route

1. [ ] Add/update `page.tsx` under `web-admin/app/dashboard/`
2. [ ] New permission → migration + `lib/constants/permissions/{domain}-perm.ts`
3. [ ] Contract in correct `*-access.ts` (import from `permissions/` — not `*-permissions.ts` in features)
4. [ ] `npm run register:ui-access-contract -- --fix` if new access module
4. [ ] New permission codes → DB migration
5. [ ] `npm run audit-wire:ui-access-contract -- --route=...` — fix remaining gaps manually if needed
6. [ ] `npm run check:ui-access-contract -- --route=... --wire`
7. [ ] `npm run sync:ui-access-contract`
8. [ ] Review `DRIFT_REPORT.md`

### B. Legacy route — contract missing or incomplete

1. [ ] `npm run derive:ui-access-contract -- --route=... --verbose` (dry-run)
2. [ ] `npm run derive:ui-access-contract -- --route=... --apply` (optional `--prune-stale`)
3. [ ] Manual review: server actions (`/app/actions/...`), auth-only gaps, permission conflicts
4. [ ] `npm run check:ui-access-contract -- --route=... --wire`
5. [ ] `npm run sync:ui-access-contract`

### C. Action gate only (same route)

1. [ ] Add `actions.{key}` on page contract
2. [ ] `npm run sync:ui-access-contract`

### D. Before PR (gating-heavy)

1. [ ] `npm run rebuild:ui-access-contract`
2. [ ] `cd web-admin && npm run check:access-contracts`

## In-scope routes

All active `web-admin/app/dashboard/**/page.tsx` (exclude `*.disabled`, `loading.tsx`, `error.tsx`).

## Contract rules

- Every active dashboard route needs a contract (empty `page: {}` allowed with notes)
- **Mandatory 4-layer pattern:** constant → `*-access.ts` → `page.tsx` gate → API `requirePermission` — see `.cursor/rules/ui-access-contract-pattern.mdc`
- Feature UI (`src/features/**/ui/*.tsx`) is **not** the contract source; page gate lives on `app/dashboard/**/page.tsx`
- Gated UI actions → `actions` on the page contract **and** `RequireAnyPermission` on the parent page
- Linked APIs → `apiDependencies` with explicit `requirement` or auth-only notes
- Page-level gates → `page.permissions` / `page.featureFlags`
- Inspector evaluates **live registry** — no inventory rebuild required for inspector-only reads
- Help Platform Inventories browser reads **merged JSON** — run `sync` after contract edits

## API dependency precedence

1. Direct page fetches / server actions
2. Feature hooks and client modules
3. `requirePermission` / `hasPermissionServer` in API routes
4. Auth-only notes when no explicit permission
5. Upstream/platform API notes when enforcement is outside `web-admin`

## Related skills

- `/rebuild-platform-info-inventories` — inventory pipeline details, drift CI, authority ladder
- `/create-update-rbac-permission` — new permission codes + migration
- `/navigation` — sidebar + `sys_components_cd` dual-write when menu-visible routes change
