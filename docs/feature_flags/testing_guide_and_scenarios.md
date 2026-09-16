---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# Testing Guide

Automated coverage: `web-admin/__tests__/hooks/use-feature-flags.test.tsx`

```bash
cd web-admin
npx jest __tests__/hooks/use-feature-flags.test.tsx --runInBand
```

## Scenarios

| # | Scenario | Expected |
|---|---------|----------|
| 1 | Many `RequireFeature` + `useFeature` + sidebar | **1** `GET /api/feature-flags` |
| 2 | Re-render / navigate while fresh (5 min) | **0** extra requests |
| 3 | Inspector open with warm cache | **0** extra requests |
| 4 | Inspector refresh | **1** refetch |
| 5 | Tenant switch A → B | **1** request for B; A map never rendered |
| 6 | `useFeatureOptional(undefined)` only | **0** requests |
| 7 | Failed GET | Gates closed / `useFeature` false |
| 8 | First load | Skeleton until success, then children |
| 9 | Logout then new session | No leftover Tenant A data |
| 10 | Subscription upgrade | Cache invalidated |

## Manual DevTools

Filter Network for `feature-flags` on a dashboard page with ERP layout + sidebar. First load = 1. Click around = 0 until stale or refresh.
