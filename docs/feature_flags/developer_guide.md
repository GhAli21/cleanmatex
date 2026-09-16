---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# Developer Guide — Feature Flags Client Cache

## Tenant scope (confirmed)

`GET /api/feature-flags` resolves `tenantId` from session (`getAuthContext`) and calls `getFeatureFlags(tenantId)` → `hq_ff_get_effective_values_batch(p_tenant_id, p_flag_keys)`.

Flags do **not** vary by user, role, branch, or impersonation. Query key `['feature-flags', tenantId]` is sufficient.

## Architecture

```
useFeatureFlagsQuery()
  queryKey: featureFlagKeys.tenant(tenantId)
  queryFn:  fetchTenantFeatureFlags()  // GET /api/feature-flags
  staleTime: 5 minutes
  refetchOnWindowFocus: false
        │
        ├─ RequireFeature
        ├─ useFeature / useFeatureOptional
        ├─ CmxSidebar
        └─ permissions inspector
```

TanStack Query owns remote flag state. Do not add a FeatureFlags React Context.

## Files

| Path | Role |
|------|------|
| `web-admin/lib/query/feature-flag-keys.ts` | Canonical key factory + invalidate/remove helpers |
| `web-admin/lib/api/feature-flags-client.ts` | Only client `fetch` of `/api/feature-flags` |
| `web-admin/lib/hooks/use-feature-flags.ts` | Shared `useQuery` + `useFeature` / `useFeatureOptional` |
| `web-admin/src/features/auth/ui/RequireFeature.tsx` | Gate UI; re-exports hooks |

## Query keys

```ts
featureFlagKeys.all              // ['feature-flags']
featureFlagKeys.tenant(tenantId) // ['feature-flags', tenantId]
```

Use the factory for `useQuery`, `invalidateQueries`, and `removeQueries`. Never scatter literals.

## `useFeatureOptional(undefined)`

Returns `true` and sets `enabled: false` on the shared query so this observer does not start a network request. If another consumer already fetched, cache is still shared.

## Invalidation

Call `invalidateTenantFeatureFlags(queryClient, tenantId)` after anything that changes **effective** tenant flags:

| Path | Wired |
|------|-------|
| Inspector refresh | Yes |
| Subscription upgrade / cancel | Yes |
| Logout / `SIGNED_OUT` / tenant switch | `removeAllFeatureFlagQueries` |
| `updateFeatureFlags` / `resetToDefaults` | No tenant-app UI route today; if wired later, invalidate |

## Tenant isolation

- Key includes `tenantId`
- `enabled` requires a tenant id
- No `placeholderData` from the previous tenant
- Logout removes all `feature-flags` queries

## Fail-closed UX

Missing data or a failed request → treat the flag as off (`RequireFeature` fallback, `useFeature` false). Sidebar still treats unknown keys as visible (`!(flag in map)`).

## Security

Do not trust client flags for authorization. Server routes must keep `canAccess` / `requireFeature` / permission checks.
