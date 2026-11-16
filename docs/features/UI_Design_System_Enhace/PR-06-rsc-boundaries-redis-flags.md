# PR-06: Optimize React Server Component Boundaries & Fault-Tolerant 3-Tier Caching
**Branch:** `refactor/pr-06-rsc-boundaries-redis-flags`
**Depends On:** nothing in this program. It is a performance track, independent of theming; PR-07 does not wait for it.
**Scope:** `web-admin/app/dashboard/**/page.tsx`, `web-admin/src/features/**/ui/`, feature-flag consumption code

> Reviewed 2026-11-16. Two parts of the original text conflicted with repository rules and are corrected below.

## Objective
Reduce client JS bundle size by pushing `'use client'` down from `page.tsx` entrypoints to screen components, consolidate the 4 overlapping branding feature flags down to 2 (`custom_branding`, `white_label`), and implement fault-tolerant 3-tier caching with graceful PostgreSQL fallback.

## Tasks

### 1. Push `'use client'` Down on Route Entrypoints
- Refactor `web-admin/app/**/page.tsx` routes declaring `'use client'` at the top to follow `app/dashboard/drivers/page.tsx` -> `DriversListScreen`:
  - Keep `page.tsx` as an async React Server Component handling metadata, `getTranslations()`, and server-side RBAC checks.
  - Move client state and TanStack Query hooks into `src/features/<feature>/ui/<feature>-<screen>-screen.tsx`. There is no `screens/` folder in this codebase; all 36 features use `ui/`.
- 74 `page.tsx` files declare `'use client'` today. Measure bundle size before and after on the first few routes and continue only where it pays; this is a performance change, so the one-measured-change-at-a-time rule applies.
- Pages must keep their existing access gates exactly as they are.

### 2. Consolidate Branding Feature Flags & Implement Fault-Tolerant 3-Tier Cache
- Consolidate the 4 overlapping branding flags (`white_label_enabled`, `tenant_white_label`, `custom_branding`, `white_label`) down to 2. Feature flags are owned by HQ and seeded by migration, so this is done with the `/create-feature-flag` workflow and a migration, not by editing `feature-flags.ts` alone. First find which of the four are actually read anywhere and which plans map to them. This task belongs with PR-07 and is tracked there.
- **Caching — corrected.** A Redis client already exists (`web-admin/lib/cache/redis.ts`). Before building anything, read how feature flags are cached today and measure whether flag or theme reads are a real cost. Build the cache below only if the measurement says so, and reuse the existing module rather than adding `tenant-config-cache.ts` beside it.
- **Rule conflict in the original text:** feature flags must be read through the HQ API, never by querying the flag tables from this app. So tier 3 for flags is the HQ API, not PostgreSQL. The theme row is this app's own table and may be read directly, scoped by `tenant_org_id`.
- If measurement justifies it, a **3-tier read-through cache** keyed by tenant (`cmx:flags:${tenantOrgId}`, `cmx:tenant-theme:${tenantOrgId}`):
  1. **Tier 1 — L1 In-Memory LRU Map (20s TTL):** Zero network overhead for burst requests.
  2. **Tier 2 — L2 Redis (5m TTL):** Reuse existing Redis client wrapped in `try/catch` with a strict **75ms timeout** (`Promise.race`) so a slow or unreachable Redis instance never stalls a request.
  3. **Tier 3 — source of truth:** On Redis miss, timeout, or error, log a non-blocking warning and read the source (HQ API for flags; the theme table, explicitly scoped by `tenant_org_id`, for themes), then backfill L1 memory.
- A plan or flag change must take effect promptly: a cached flag must never keep a paid feature open after a downgrade longer than the stated TTL, and the TTL is agreed with the owner.
- Invalidate Redis keys inside a non-throwing `try/catch` after DB commits.

## Verification Gate
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- Simulate Redis downtime and verify zero 500 errors or latency spikes.