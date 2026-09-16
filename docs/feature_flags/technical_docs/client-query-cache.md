---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# Technical: Client Query Cache

## Why not localStorage

`getCachedFeatureFlags` / `setCachedFeatureFlags` painted UI then still called the API (`cache: 'no-store'`). Login also stored `featureFlags: {}` (fetchAuthData disabled), which is a truthy empty map. TanStack Query is the source of truth; those helpers are unused cleanup candidates.

## Why not HTTP cache

The endpoint is cookie-authenticated and tenant-specific. Public/CDN caching would leak Tenant A flags. Keep `force-dynamic` on the route.

## Server Map cache

`feature-flags.service.ts` still has a 5-minute in-process Map. That does **not** reduce Vercel invocations; each client HTTP call still runs the function. Unchanged in this task.

## Query defaults

- `staleTime`: 5 minutes (hook)
- `refetchOnWindowFocus`: false (hook + AppProviders default)
- No polling
- Prefix `['feature-flags']` so `removeQueries({ queryKey: featureFlagKeys.all })` clears every tenant
