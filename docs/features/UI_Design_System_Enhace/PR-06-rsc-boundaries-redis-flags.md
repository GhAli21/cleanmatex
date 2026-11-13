# PR-06: Optimize React Server Component Boundaries & Fault-Tolerant Redis Feature-Flag Caching
**Branch:** `refactor/pr-06-rsc-boundaries-redis-flags`
**Depends On:** `PR-05`
**Scope:** `web-admin/app/dashboard/**/page.tsx`, `web-admin/src/features/**/screens/`, `web-admin/src/lib/feature-flags/**`

## Objective
Reduce client JavaScript bundle size and improve Time-to-First-Byte (TTFB) by pushing `'use client'` down from `page.tsx` routes to screen components, and upgrade tenant feature-flag caching to a fault-tolerant 3-tier cache (L1 Memory -> L2 Redis with fast timeout -> L3 PostgreSQL fallback).

## Tasks

### 1. Push `'use client'` Down on Route Entrypoints
- Scan all `web-admin/app/**/page.tsx` files currently declaring `'use client'` at the top of the file (~60% of routes).
- Refactor them to match CleanMateX's reference pattern (`app/dashboard/drivers/page.tsx` -> `DriversListScreen`):
  - Keep `page.tsx` as an async React Server Component handling route metadata, `getTranslations()` server i18n, and server-side permission checks.
  - Move client state, TanStack Query hooks, and interactive UI into `<FeatureName>Screen.tsx` inside `src/features/<domain>/screens/`.
- Execute in clean domain batches (Orders/POS -> Customers -> Catalog -> ERP/Finance -> Settings).

### 2. Implement Fault-Tolerant 3-Tier Feature-Flag Caching (With Graceful DB Fallback)
- Locate the existing in-memory 5-minute TTL `Map` cache used for tenant feature flags.
- Replace it with a resilient **3-tier read-through cache** (`src/lib/feature-flags/feature-flag-cache.ts`) strictly namespaced by `tenant_org_id`:
  1. **Tier 1 — L1 In-Memory LRU Map (20s TTL):** Absorbs burst requests within the same Node process with zero network overhead.
  2. **Tier 2 — L2 Redis (`cmx:flags:${tenantOrgId}`, 5m TTL):** Reuse the existing Redis client already wired for permissions/sessions. Wrap all Redis `GET`/`SET`/`DEL` calls in `try/catch` with a strict **75ms timeout** (`Promise.race`) so a slow, restarting, or unreachable Redis instance never stalls or crashes a request.
  3. **Tier 3 — L3 PostgreSQL Fallback:** On Redis miss, timeout, or connection error, log a non-blocking warning, query PostgreSQL directly (explicitly scoped by `tenant_org_id`), and backfill L1 memory (and L2 Redis best-effort) so the database is protected during a Redis outage.
- **Safe Invalidation:** When an admin updates a tenant's plan or toggles a flag, delete `cmx:flags:${tenantOrgId}` from Redis inside a non-throwing `try/catch` after the DB commit succeeds.

## Verification Gate
- Run `npm run typecheck`, `npm run lint`, and `npm run build` to verify route bundle reductions and clean RSC serialization.
- Simulate Redis failure (invalid URL / stopped container) and verify feature flags transparently fall back to PostgreSQL with zero 500 errors or latency spikes.