---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# Feature Flags — Client Query Cache

Tenant-level feature flags for web-admin UX gating.

**Canonical client architecture:** one TanStack Query keyed by tenant, one `GET /api/feature-flags` implementation.

Server resolution (HQ RPC, plan mappings, overrides) remains documented in [docs/platform/feature_flags](../platform/feature_flags/README.md).

## Scope

In scope:

- Shared client query/cache
- `RequireFeature`, `useFeature`, `useFeatureOptional`, sidebar, permissions inspector
- Explicit invalidation on plan change, inspector refresh, logout, tenant switch

Out of scope:

- Server `getAuthContext()` / `get_user_tenants` optimization
- CDN/HTTP caching of authenticated flags
- Changing backend entitlement checks

## Security

Client flags are **UX gating only**. APIs, RLS, and `canAccess` / `requireFeature` on the server remain authoritative.

## Pack

- [developer_guide.md](developer_guide.md)
- [user_guide.md](user_guide.md)
- [testing_guide_and_scenarios.md](testing_guide_and_scenarios.md)
- [deploy_guide.md](deploy_guide.md)
- [current_status.md](current_status.md)
- [technical_docs/client-query-cache.md](technical_docs/client-query-cache.md)
