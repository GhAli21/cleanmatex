---
name: rebuild-ui-access-contract
description: Edit and validate page access contracts (*-access.ts, page-access-registry), then sync platform inventories. Use when adding dashboard routes, page/action gates, apiDependencies, or permissions inspector behavior.
user-invocable: true
version: 2.0.0
deprecated: false
effort: medium
references:
  - references/access-contract-rollout.md
  - ../rebuild-platform-info-inventories/SKILL.md
---

# Rebuild UI Access Contract

**Declarative source of truth (you edit):**

| Artifact | Path |
|----------|------|
| Contract primitives | `web-admin/lib/auth/access-contracts.ts` |
| **RBAC permission codes** | `web-admin/lib/constants/permissions/{domain}-perm.ts` |
| Feature contracts | `web-admin/src/features/*/access/*-access.ts` |
| Route registry | `web-admin/src/features/access/page-access-registry.ts` |
| Permissions inspector | `web-admin/src/ui/navigation/permissions-inspector/` |
| New permission DB seeds | `supabase/migrations/*_permissions_*.sql` |
| Other domain constants | `web-admin/lib/constants/{domain}.ts` (statuses/enums — **not** RBAC) |

**Generated (script only — never hand-edit):**

| Artifact | Path |
|----------|------|
| Merged inventory | `docs/platform/inventories/platform-info-inventory.json` |
| Help UI runtime copy | `web-admin/data/platform/platform-info-inventory.json` |
| Human views | `docs/platform/inventories/GENERATED_*.md` |
| Drift report | `docs/platform/inventories/DRIFT_REPORT.md` |

> `npm run rebuild:platform-info-inventories` **reads** `*-access.ts` — it does **not** update `core-access.ts` or `page-access-registry.ts`.

## When to use

- New / renamed / removed `web-admin/app/dashboard/**/page.tsx` route
- Page, action, or API dependency gates on a contract
- Shield permissions inspector / platform inventories Help UI
- After permission DB migration (seed + assign roles)

## Agent workflow

**Golden path (no gaps):** migration → `lib/constants/permissions/{domain}-perm.ts` → [nav dual-write if menu] → **scaffold → derive `--apply` → wire `--fix`** → `check --wire` → `sync`

**Authoring `*-access.ts`:** use `scaffold` + `derive --apply` — not hand-written blocks. Hand-edit only `notes`, corrections derive cannot infer, or post-`--prune-stale` cleanup.

**Mandatory rule:** `.cursor/rules/ui-access-contract-pattern.mdc` (also applies in Codex/Cursor agents).

| Do | Don't |
|----|-------|
| RBAC codes in `lib/constants/permissions/{domain}-perm.ts` | RBAC codes in `lib/constants/inventory.ts` or mixed enum files |
| Route contracts in `*-access.ts` | `src/features/*/access/*-permissions.ts` for codes |
| Page gate on `app/dashboard/**/page.tsx` | Gate only in unimported `features/**/ui/*.tsx` |
| `useHasPermissionCode` for full DB codes (preferred for `_` in action) | Replacing contract when only hook name changed |

### Hook swap vs contract change

| Change | Edit `*-access.ts`? | Refresh inventories |
|--------|---------------------|-------------------|
| `useHasPermission` → `useHasPermissionCode` (same permission string) | No | `npm run docs:extract-permissions` → `npm run rebuild:platform-info-inventories` |
| New / renamed permission code | Yes + migration + `lib/constants/permissions/` | `sync:ui-access-contract` or full rebuild |
| Move gate to `page.tsx` `RequireAnyPermission` | Optional notes only | `check --wire` then `sync` |
| Legacy route, incomplete contract | `derive --route=...` then `--apply` | `derive` dry-run → review → `--apply` → `sync` |

Wire audit recognizes both hooks plus `RequirePermission` JSX; thin pages that import a feature client are scanned one import hop deep.

### `derive` — reverse-engineer contract from code

Dry-run by default. Infers `page.permissions`, `actions`, and `apiDependencies` from wire scan + `extracted-permissions.json`.

```bash
npm run derive:ui-access-contract -- --route=/dashboard/foo --verbose
npm run derive:ui-access-contract -- --feature=marketing --apply --dry-run
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --prune-stale
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --refresh-extract --force
```

| Flag | Effect |
|------|--------|
| `--apply` | Merge into `*-access.ts` (requires `--route` or `--feature`) |
| `--prune-stale` | Comment stale `actions` / `apiDependencies` not found in scanned code |
| `--force` | Replace `page.permissions` on conflict |
| `--refresh-extract` | Run `docs:extract-permissions` before derive |
| `--dry-run` | Preview patches without writing |

**Infers:** page boundary gates; **`config/navigation.ts`** when page has no gates (dual-write); feature UI permission hooks → `actions`; server-action `hasPermissionServer` → `actions`; `/api/*` literals; `@/app/actions/*` → `/app/actions/...` (server action, not HTTP). Skips `/api/auth/*`. Does not overwrite existing action/API blocks — only adds missing; use `--prune-stale` to comment orphans.

Full reference: `docs/platform/ui-access-contract/user_guide.md` § B3.

### 1. Edit declarative sources

1. New permission code → DB migration + `lib/constants/permissions/{domain}-perm.ts` (`{DOMAIN}_PERMISSIONS`)
2. **Contract file** — prefer scripts over manual authoring:

```bash
npm run scaffold:ui-access-contract -- --feature=<feature>   # or --route=...
npm run derive:ui-access-contract -- --feature=<feature> --apply --refresh-extract
npm run register:ui-access-contract -- --fix                 # if new module not in registry
```

Then hand-tune `notes` / gaps derive cannot see. Import permission constants in `*-access.ts`; define `page`, `actions`, `apiDependencies`.
3. Register module in `page-access-registry.ts` if scaffold/register did not
4. Wire gates on **`page.tsx`** (`wire --fix` + manual async/redirect) + `app/api/**/route.ts` ( **`permission` tier:** `requirePermission`; **`auth_only` tier:** session helpers — see 3-tier table in user guide)

### API wire enforcement (3 tiers)

| Tier | Wire expects |
|------|----------------|
| `permission` | `requirePermission` when `requirement.permissions` is set |
| `auth_only` | `getUser`+401, `getAuthContext`, `getTenantIdFromSession`, `requireAuth` (default when no RBAC requirement) |
| `external` | WARN only — `/tenant-api/*`, server actions |

Full detail: `docs/platform/ui-access-contract/user_guide.md` § `audit-wire` · `scripts/docs/ui-access-contract/resolve-api-enforcement.ts`

### 2. Run the orchestrator script

**Scope** — pick one:
- *(none)* — all dashboard routes (full)
- `--feature=marketing` — feature module
- `--route=/dashboard/help` — single route tree

```bash
# Full check (coverage + registry summary)
npm run check:ui-access-contract

# Feature or page — detailed status report
npm run check:ui-access-contract -- --feature=marketing --wire
npm run check:ui-access-contract -- --route=/dashboard/help/platform-inventories --wire --verbose
npm run check:ui-access-contract -- --feature=settings --wire --json

# List valid --feature= keys
npm run features:ui-access-contract

# Scaffold / register / wire (scoped)
npm run refresh:ui-access-contract -- --route=/dashboard/foo --permissions=foo:read --fix
npm run derive:ui-access-contract -- --feature=marketing --verbose
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --dry-run
npm run refresh:ui-access-contract -- --feature=marketing --fix --dry-run
npm run scaffold:ui-access-contract -- --route=/dashboard/foo --permissions=foo:read
npm run register:ui-access-contract -- --fix
npm run audit-wire:ui-access-contract -- --feature=marketing
npm run wire:ui-access-contract -- --feature=marketing --fix --dry-run

# Inventories
npm run sync:ui-access-contract
npm run rebuild:ui-access-contract
```

| Command | What it does |
|---------|----------------|
| `check` | **Detailed report**: coverage, registry, optional wire per route |
| `features` | List known `--feature=` keys |
| `scaffold` | Add contract stub(s) for `--route` or missing routes in `--feature` |
| `register --fix` | `npm run register:ui-access-contract -- --fix` |
| `audit-wire` | `npm run audit-wire:ui-access-contract` |
| `wire --fix` | `npm run wire:ui-access-contract -- --fix` |
| `derive` | Reverse-engineer `page.permissions`, `actions`, `apiDependencies` from code; `--apply` merge-safe; `--prune-stale` comments orphans |
| `refresh` | `scaffold` → `register --fix` → `wire --fix` for `--route` or `--feature` |
| `sync` | `check` (full) → ingest → reconcile → `GENERATED_*.md` |
| `full` | `check` → extract scans → full platform rebuild |
| `show --route=...` | Print parsed contract JSON from `*-access.ts` |

**Check flags:** `--wire` (include gate audit), `--verbose` (all routes, not only issues), `--json`

> Wire audit on **full** check is opt-in (`--wire`) — many legacy pages may lack page gates until migrated.

### 3. Read drift

```bash
# After sync/full
cat docs/platform/inventories/DRIFT_REPORT.md
```

Fix **new** drift; shrink `KNOWN_EXCEPTIONS.json` over time.

## Relationship to `/rebuild-platform-info-inventories`

| Skill | Focus |
|-------|--------|
| **This skill** | *Authoring* contracts + registry + wiring UI/API gates |
| **`/rebuild-platform-info-inventories`** | *Refreshing* merged inventories, drift, GENERATED docs |

Use **`sync:ui-access-contract`** for typical contract edits.  
Use **`rebuild:ui-access-contract`** (full) when permission/flag scans also changed.

## Validation

```bash
npm run check:ui-access-contract
npm run sync:ui-access-contract          # or rebuild:ui-access-contract
cd web-admin && npm run check:access-contracts
```

## References

- **Cursor rule:** `.cursor/rules/ui-access-contract-pattern.mdc` — mandatory 4-layer pattern
- [UI Access Contract User Guide](../../../docs/platform/ui-access-contract/user_guide.md) — CLI commands, scope, check report
- `references/access-contract-rollout.md` — rollout checklist
- `docs/platform/inventories/README.md` — authority ladder
- `docs/platform/inventories/user_guide.md` — Help UI for admins
