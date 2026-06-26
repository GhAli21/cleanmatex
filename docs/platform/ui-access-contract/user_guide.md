---
version: v1.0.0
last_updated: 2026-06-26
audience: developers
---

# UI Access Contract — User Guide

Command-line workflow for **authoring, validating, and wiring** dashboard page access contracts in CleanMateX.

Use this when you:

- Add or change a `web-admin/app/dashboard/**/page.tsx` route
- Declare who can open a page, use an action, or call a linked API
- Want a **status report** before opening a PR
- Need to scaffold contracts, register modules, or audit runtime gates

**Script:** `scripts/docs/rebuild-ui-access-contract.ts`  
**Agent skill:** `/rebuild-ui-access-contract`

---

## What this tool does (and does not do)

| Does | Does not |
|------|----------|
| Validate every dashboard route has a contract | Apply database migrations |
| Add contract stubs to `*-access.ts` | Edit `navigation.ts` or `sys_components_cd` |
| Register `*-access.ts` in `page-access-registry.ts` | Replace careful manual UI wiring on complex pages |
| Audit / partially fix `RequireAnyPermission` and API `requirePermission` | Run Supabase migrations |
| Refresh **generated** platform inventories (`sync` / `full`) | Change RBAC role assignments |

### Source of truth (you edit)

| Artifact | Path |
|----------|------|
| Contract types | `web-admin/lib/auth/access-contracts.ts` |
| Feature contracts | `web-admin/src/features/*/access/*-access.ts` |
| Route registry | `web-admin/src/features/access/page-access-registry.ts` |
| Permission constants | `web-admin/lib/constants/permissions/{domain}-perm.ts` — see [Constants layout](#constants-layout) |
| Permission DB seeds | `supabase/migrations/*_permissions_*.sql` |

### Constants layout

| Layer | Path |
|-------|------|
| **RBAC codes** | `lib/constants/permissions/{domain}-perm.ts` → `{DOMAIN}_PERMISSIONS` |
| **Other constants** | `lib/constants/{domain}.ts` (statuses, enums — not RBAC) |
| Contract types | `lib/auth/access-contracts.ts` |
| Route contracts | `src/features/*/access/*-access.ts` |

- **Use** `lib/constants/permissions/` for new permission codes (no mix with `inventory.ts`, etc.).
- **Do not** use `src/features/*/access/*-permissions.ts` for codes — APIs import from `lib/`, codes are global RBAC.
- **Do not** put route contracts under `lib/constants/`.

Full rule: `.cursor/rules/ui-access-contract-pattern.mdc` (Constants layout section).

### Generated (script only — never hand-edit)

| Artifact | Refreshed by |
|----------|--------------|
| `docs/platform/inventories/platform-info-inventory.json` | `npm run sync:ui-access-contract` |
| `docs/platform/inventories/GENERATED_*.md` | same |
| `web-admin/data/platform/platform-info-inventory.json` | same (Help UI runtime copy) |

For **read-only review** of gates in the app, see [Platform Inventories User Guide](../inventories/user_guide.md) (`/dashboard/help/platform-inventories`).

---

## Quick start

From repo root:

```bash
# 1. Full health check (coverage + registry)
npm run check:ui-access-contract

# 2. After editing *-access.ts — refresh inventories
npm run sync:ui-access-contract

# 3. Before PR (full platform rebuild)
npm run rebuild:ui-access-contract
```

---

## Scope: full, feature, or route

Almost every command accepts **one** scope modifier. If you omit both, scope is **full** (all dashboard routes).

| Scope | Flag | Example |
|-------|------|---------|
| **Full** | *(none)* | All `app/dashboard/**/page.tsx` routes |
| **Feature** | `--feature=NAME` | Routes owned by a feature access module |
| **Route / page** | `--route=/dashboard/...` | One route and its children |

```bash
# Full
npm run check:ui-access-contract

# Feature
npm run check:ui-access-contract -- --feature=marketing --wire

# Single route tree
npm run check:ui-access-contract -- --route=/dashboard/help --wire --verbose
```

**List valid feature keys:**

```bash
npm run features:ui-access-contract
```

Typical values: `marketing`, `settings`, `orders`, `catalog`, `b2b`, `billing`, `core`, `customers`, `dashboard`, `help`, `inventory`, `reports`, `tenant-admin`, `users`, `finance-vouchers`, `erp-lite`, …

> **Note:** Some routes map to a different feature file than the URL segment (e.g. workflow screens → `orders-access.ts`, legacy `/dashboard/subscription` → `tenant-admin-access.ts`). See [Route → contract file resolver](#route--contract-file-resolver).

**Do not combine** `--route` and `--feature` on the same command.

---

## Route → contract file resolver

`scaffold`, `derive`, and `wire` resolve which `*-access.ts` owns a dashboard route via `scripts/docs/ui-access-contract/access-contract-files.ts`.

| Route | Contract module |
|-------|-----------------|
| `/dashboard` | `dashboard/access/dashboard-access.ts` |
| `/dashboard/help/*` | `help/access/help-access.ts` |
| `/dashboard/tenant-admin/*` | `tenant-admin/access/tenant-admin-access.ts` |
| `/dashboard/subscription` (legacy tooling) | `tenant-admin/access/tenant-admin-access.ts` |
| `/dashboard/jhtestui` | `core/access/core-access.ts` (debug only) |
| Workflow segments (`preparation`, `processing`, `qa`, `ready`, …) | `orders/access/orders-access.ts` |
| `/dashboard/internal_fin/vouchers/*` | `finance/vouchers/access/vouchers-access.ts` |
| `/dashboard/{segment}/*` (default) | `{segment}/access/{segment}-access.ts` |

Tests: `npx tsx --test scripts/docs/ui-access-contract/access-contract-files.test.ts`

---

## npm scripts reference

| npm script | Command | Typical use |
|------------|---------|-------------|
| `check:ui-access-contract` | `check` | Status report |
| `features:ui-access-contract` | `features` | List `--feature=` keys |
| `scaffold:ui-access-contract` | `scaffold` | Add contract stub(s) |
| `register:ui-access-contract` | `register` | Fix `page-access-registry.ts` |
| `audit-wire:ui-access-contract` | `audit-wire` | Gate gap report |
| `wire:ui-access-contract` | `wire` | Audit or `--fix` page/API gates |
| `refresh:ui-access-contract` | `refresh` | scaffold + register + wire |
| `derive:ui-access-contract` | `derive` | reverse-engineer contract from code (`--apply`, `--prune-stale`, `--force`) |
| `sync:ui-access-contract` | `sync` | check → refresh inventories |
| `rebuild:ui-access-contract` | `full` | sync + extract + full CI |

Direct invocation (all subcommands):

```bash
npx tsx scripts/docs/rebuild-ui-access-contract.ts <command> [flags]
npx tsx scripts/docs/rebuild-ui-access-contract.ts --help
```

---

## Commands in detail

### `check` — status report

Default command. Prints a structured report:

- **Coverage** — routes with / without contracts, duplicates, orphans
- **Registry** — whether every `*-access.ts` is imported in `page-access-registry.ts`
- **Wire** *(optional)* — page and API runtime gates vs contract

```bash
npm run check:ui-access-contract
npm run check:ui-access-contract -- --feature=settings --wire
npm run check:ui-access-contract -- --route=/dashboard/help/platform-inventories --wire --verbose
npm run check:ui-access-contract -- --feature=marketing --wire --json
```

| Flag | Effect |
|------|--------|
| `--wire` | Include runtime gate audit (page + local API) |
| `--verbose` | Show **all** routes in the table, not only issues |
| `--json` | Machine-readable report (CI / tooling) |

**Exit code:** `1` if overall status is `FAIL`; `0` for `PASS` or `WARN`.

#### Reading the report

```
════════════════════════════════════════════════════════════════════════
 UI Access Contract — Check Report
════════════════════════════════════════════════════════════════════════
 Scope:        feature "marketing" (...)
 Routes:       9
 Access files: src/features/marketing/access/marketing-access.ts

 Coverage
   Contracts OK:       9
   Missing contract:   0

 Registry
   Status:             OK — all in-scope *-access.ts modules registered

 Wire (runtime gates)          ← only with --wire
   Page gate OK:        0
   Page gate missing:   9  ← FAIL
   ...

 Route details (issues only)
 ROUTE                                      CONTRACT   PAGE     API
 /dashboard/marketing/promos                OK         FAIL     —
   ↳ Expected page gate for [promotions:read] — no RequireAnyPermission ...

────────────────────────────────────────────────────────────────────────
 Overall: FAIL
────────────────────────────────────────────────────────────────────────
```

| Column | Meaning |
|--------|---------|
| `CONTRACT` | Declarative entry exists in `*-access.ts` and is reachable via registry |
| `PAGE` | `RequireAnyPermission`, `RequirePermission`, `useHasPermissionCode`, `useHasPermission`, or `.page.permissions` matches contract `page.permissions` (includes one-hop feature UI imports from `page.tsx`) |
| `API` | Local `/api/*` routes in `apiDependencies` use `requirePermission` |
| `—` | Not applicable (no permissions or no API deps declared) |

Statuses: `OK` · `FAIL` · `WARN` · `—`

---

### `features` — list feature keys

```bash
npm run features:ui-access-contract
```

Prints every `--feature=` value derived from `web-admin/src/features/**/-access.ts`.

---

### `scaffold` — add contract stub(s)

Adds a `routePattern` block to the resolved `*-access.ts`, or creates a new access file if needed.

```bash
# Single route
npm run scaffold:ui-access-contract -- \
  --route=/dashboard/marketing/my-page \
  --label="My Page" \
  --permissions=promotions:read

# All missing contracts in a feature
npm run scaffold:ui-access-contract -- --feature=marketing --dry-run
```

| Flag | Effect |
|------|--------|
| `--label` | Human label in contract (default: derived from URL segment) |
| `--permissions=code:read,...` | `page.permissions` in stub |
| `--dry-run` | Print what would change; do not write files |

After scaffold, fill in `actions`, `apiDependencies`, and `notes` by hand.

---

### `register` — update `page-access-registry.ts`

Ensures every `*-access.ts` under `src/features/` is imported and spread into `PAGE_ACCESS_CONTRACTS`.

```bash
npm run register:ui-access-contract          # report only
npm run register:ui-access-contract -- --fix # apply
npm run register:ui-access-contract -- --fix --dry-run
```

Scoped register only **reports** in-scope missing imports; `--fix` still updates the full registry file (imports are global).

---

### `audit-wire` — runtime gate report

Compares contracts to actual code:

- **Page:** `RequireAnyPermission`, `RequirePermission`, `useHasPermissionCode`, `useHasPermission` (`resource`+`action` or full code), `useHasAnyPermission` / `useHasAllPermissions`, or `.page.permissions` reference — scanned on `page.tsx`, route siblings, and feature UI files directly imported by the page
- **API (3 tiers):** each `apiDependency` is checked by `enforcement` (explicit field on the dependency object, or inferred):

| Tier | Inferred when | Wire expects in local `route.ts` |
|------|---------------|----------------------------------|
| **`permission`** | `requirement.permissions` is set | `requirePermission` |
| **`auth_only`** | No `requirement.permissions` (default) | Session + tenant: `getUser` + 401/`Unauthorized`, `getAuthContext`, `getTenantIdFromSession`, `requireAuth`, or `validateCSRF` |
| **`external`** | Path is `/tenant-api/*` or `/app/actions/*`, or notes say platform/manual | WARN only — verify upstream RBAC manually |

**Inference rules** (`scripts/docs/ui-access-contract/resolve-api-enforcement.ts`):

1. Explicit `enforcement: 'permission' \| 'auth_only' \| 'external'` wins.
2. `/tenant-api/*` and server-action paths → `external`.
3. `requirement.permissions` present → `permission`.
4. Notes containing “auth-only” / “auth only” → `auth_only`.
5. Otherwise → `auth_only`.

**Path normalization:** strip query strings when resolving route files (`/api/v1/categories?enabled=true` → `/api/v1/categories`; document filters in `notes`).

```ts
// permission tier
{
  path: '/api/dev/platform-inventories',
  requirement: { permissions: ['help:platform_inventories'] },
}

// auth_only tier (explicit or default)
{
  path: '/api/v1/subscriptions/plans',
  enforcement: 'auth_only',
  notes: ['Session + tenant_org_id; no granular permission yet.'],
}

// external tier
{
  path: '/tenant-api/roles',
  enforcement: 'external',
  notes: ['Platform API — verify RBAC manually.'],
}
```

Strip query strings from `path` when resolving route files (e.g. `/api/v1/categories?enabled=true` → `/api/v1/categories`).

```bash
npm run audit-wire:ui-access-contract -- --feature=marketing
npm run audit-wire:ui-access-contract -- --route=/dashboard/help/platform-inventories
npm run audit-wire:ui-access-contract    # all dashboard contracts
```

External paths (`/tenant-api/*`) are reported as manual verification — not auto-fixed.

---

### `wire` — audit or apply safe fixes

Without `--fix`, same as `audit-wire` for the scope.

With `--fix`:

1. Adds a single-route export constant to `*-access.ts` (e.g. `MARKETING_PROMOS_ACCESS`)
2. Wraps simple `page.tsx` default exports with `RequireAnyPermission`
3. Inserts `requirePermission` into local API route handlers (**permission tier only** — `auth_only` routes are not auto-patched)

Prefer scoped fixes: `npm run wire:ui-access-contract -- --route=/dashboard/foo --fix` — avoid repo-wide `--fix`.

```bash
# Preview fixes
npm run wire:ui-access-contract -- --route=/dashboard/foo --fix --dry-run

# Apply for all fixable routes in a feature
npm run wire:ui-access-contract -- --feature=marketing --fix
```

Equivalent direct invocation: `npx tsx scripts/docs/rebuild-ui-access-contract.ts wire ...`

**Always review** `--dry-run` output before applying on non-trivial pages.

---

### `refresh` — all-in-one for a scope

Runs: **scaffold** (missing contracts) → **register --fix** → **wire --fix**

```bash
# New single page
npm run refresh:ui-access-contract -- \
  --route=/dashboard/foo/bar \
  --permissions=foo:read \
  --fix

# Entire feature (dry-run first)
npm run refresh:ui-access-contract -- --feature=marketing --fix --dry-run

# Also refresh inventories after success
npm run refresh:ui-access-contract -- --route=/dashboard/foo --fix --sync
```

Requires `--route` or `--feature`.

---

### `show` — print one contract as JSON

```bash
npx tsx scripts/docs/rebuild-ui-access-contract.ts show \
  --route=/dashboard/help/platform-inventories
```

---

### `sync` and `full` — refresh inventories

| Command | Pipeline |
|---------|----------|
| `sync` | full `check` → ingest → reconcile → `GENERATED_*.md` |
| `full` | `sync` + permission/flag extract scans + `check:platform-info-inventories` |

```bash
npm run sync:ui-access-contract      # after contract-only edits
npm run rebuild:ui-access-contract   # before PR / after extract scans changed
```

---

## Common workflows

### A. New dashboard page

1. Add `web-admin/app/dashboard/.../page.tsx`
2. Create DB migration if new permission codes are needed
3. Run refresh (or hand-edit contract):

   ```bash
   npm run refresh:ui-access-contract -- \
     --route=/dashboard/my-feature/my-page \
     --permissions=my_feature:read \
     --fix --dry-run
   ```

4. Refine `actions` / `apiDependencies` in `*-access.ts`
5. Verify:

   ```bash
   npm run check:ui-access-contract -- --route=/dashboard/my-feature/my-page --wire --verbose
   npm run sync:ui-access-contract
   ```

### B. Contract-only change (same route)

1. Edit `*-access.ts`
2. `npm run check:ui-access-contract -- --route=... --wire`
3. `npm run sync:ui-access-contract`

### B2. Permission hook rename only (no contract change)

When swapping `useHasPermission` ↔ `useHasPermissionCode` with the **same** permission string (e.g. `customers:receipt_allocate`):

1. Edit the UI file only — no `*-access.ts` change unless the code string changed
2. Refresh extracted permission metadata:

   ```bash
   npm run docs:extract-permissions
   npm run rebuild:platform-info-inventories
   npm run check:platform-info-inventories
   ```

3. Optional wire check (thin pages that import a feature client are scanned one hop):

   ```bash
   npm run check:ui-access-contract -- --route=/dashboard/customers/account-receipt --wire
   ```

Inventory entry ids stay `file:line:permission`; only `component` metadata updates.

### B3. Legacy route — derive contract from code (reverse-engineer)

When a route has gates in UI but an incomplete or missing `*-access.ts` block:

```bash
# Preview inferred page.permissions (wire scan + extracted-permissions.json)
npm run derive:ui-access-contract -- --route=/dashboard/marketing/promos --verbose

# Feature-wide dry-run
npm run derive:ui-access-contract -- --feature=marketing --dry-run

# Merge-safe apply: create stub, fill empty page.permissions, or append missing codes
npm run derive:ui-access-contract -- --feature=marketing --apply

# Comment stale actions/apiDependencies not found in scanned code; append conflict notes
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --prune-stale

# Refresh extract JSON first; replace page.permissions on conflict (review diff!)
npm run derive:ui-access-contract -- --route=/dashboard/foo --apply --refresh-extract --force
```

| `applyAction` | Meaning |
|---------------|---------|
| `create` | No contract — would add `routePattern` block |
| `fill_empty` | Contract exists but `page.permissions` is empty |
| `merge_missing` | Adds codes found in code, keeps existing contract codes |
| `conflict` | Contract and code disagree — use `--force` or edit manually; `--apply` adds a `notes` entry |
| `noop` | Already aligned |

Does **not** overwrite existing `actions` / `apiDependencies` keys — only **adds missing** entries. Use `--prune-stale` with `--apply` to **comment out** contract entries whose permissions/paths no longer appear in scanned code (never auto-deletes). Review `action (new)` / `server-action (new)` lines; use `--force` only for `page.permissions` conflicts.

**Infers:**

| Field | Source |
|-------|--------|
| `page.permissions` | Page boundary gates (`page.tsx`, route siblings) |
| `actions.*` | Permission hooks in `src/features/**` UI (one-hop + feature import walk) |
| `apiDependencies` | `/api/*` literals + `submitJson` paths; permissions from `extracted-permissions.json` |
| `apiDependencies` (server actions) | `@/app/actions/*` imports → `/app/actions/...` path with note (not HTTP); `hasPermissionServer` in action file |

**Skipped on purpose:** `/api/auth/*` (login, CSRF, logout) — shared auth plumbing imported across the app, not page-specific APIs.

### C. Audit an entire feature before wiring sprint

```bash
npm run check:ui-access-contract -- --feature=marketing --wire --verbose
npm run audit-wire:ui-access-contract -- --feature=marketing
```

### D. New `*-access.ts` module

1. Create `web-admin/src/features/foo/access/foo-access.ts`
2. `npm run register:ui-access-contract -- --fix`
3. `npm run check:ui-access-contract -- --feature=foo`

### E. Before PR

```bash
npm run check:ui-access-contract
npm run rebuild:ui-access-contract
cd web-admin && npm run check:access-contracts
```

Review `docs/platform/inventories/DRIFT_REPORT.md` for new drift.

---

## Auto-fix limitations

| Area | Auto-fix | Manual follow-up |
|------|----------|------------------|
| Contract stub in `*-access.ts` | Yes (`scaffold`) | Add `actions`, `apiDependencies`, notes |
| Registry import | Yes (`register --fix`) | — |
| Simple client `page.tsx` gate | Sometimes (`wire --fix`) | Complex layouts, server components, nested gates; prefer `RequireAnyPermission` on `page.tsx` over deep feature-only hooks |
| Local `/api/*` routes | Sometimes (`wire --fix`) | Verify correct permission constant |
| `/tenant-api/*` platform APIs | No | Wire in platform / `rbacFetch` layer |
| Navigation sidebar | No | Dual-write: `navigation.ts` + DB migration |
| New permission codes | No | `supabase/migrations/*_permissions_*.sql` |

---

## Relationship to other tools

```
┌─────────────────────────────────────────────────────────────┐
│  Authoring (this guide)                                      │
│  *-access.ts · page-access-registry.ts · UI/API gates        │
│  npm run check|sync|refresh:ui-access-contract               │
└──────────────────────────┬──────────────────────────────────┘
                           │ ingest
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Generated inventories                                       │
│  platform-info-inventory.json · GENERATED_*.md · DRIFT       │
│  npm run sync|rebuild:ui-access-contract                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ read-only
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Help UI + permissions inspector                             │
│  /dashboard/help/platform-inventories · shield icon            │
└─────────────────────────────────────────────────────────────┘
```

| Tool | When to use |
|------|-------------|
| **UI access contract CLI** | Writing / validating contracts and gates |
| **Platform Inventories Help UI** | Reviewing merged state as an admin |
| **Permissions inspector (shield)** | Live view for the current route |
| **`/rebuild-platform-info-inventories`** | Deep inventory / drift CI details |

---

## Troubleshooting

| Symptom | Action |
|---------|--------|
| Not following project pattern | Read `.cursor/rules/ui-access-contract-pattern.mdc` |
| `Missing contract` for a route | `scaffold --route=...` or add block manually |
| `*-access.ts not imported` | `register --fix` |
| `PAGE FAIL` with permissions declared | Add `RequireAnyPermission` or run `wire --fix --dry-run` |
| `API FAIL` on local route | Check tier: `permission` → add `requirePermission`; `auth_only` → add session auth (`getAuthContext`, `getTenantIdFromSession`, or `getUser` + 401); `external` → WARN only |
| Inspector shows wrong permissions | Registry reads live TS — fix `*-access.ts`; no sync needed for inspector |
| Help inventories tab stale | `npm run sync:ui-access-contract` |
| Unknown `--feature=` | `npm run features:ui-access-contract` |
| `Use only one of --route or --feature` | Pass a single scope flag |

---

## See also

- [Access contract rollout checklist](../../../.claude/skills/rebuild-ui-access-contract/references/access-contract-rollout.md)
- [Platform inventories README](../inventories/README.md) — authority ladder
- [Platform Inventories User Guide](../inventories/user_guide.md) — admin Help UI
- `web-admin/lib/auth/access-contracts.ts` — type definitions
- `web-admin/src/features/access/page-access-registry.ts` — runtime registry
