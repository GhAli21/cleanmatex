---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Plan Limits Usage

Where plan limits are enforced in the codebase.

**Source:** `web-admin/lib/services/usage-tracking.service.ts`, `web-admin/lib/middleware/plan-limits.middleware.ts`

## Usage Tracking Service

**File:** `web-admin/lib/services/usage-tracking.service.ts`

| Function | Purpose |
|----------|---------|
| calculateUsage | Count orders, users, branches for period; upsert org_usage_tracking |
| getUsageMetrics | Get usage + limits + warnings (80%, 90%, 100% thresholds) |
| canCreateOrder | Check orders_count < orders_limit |
| canAddUser | Check users_count < users_limit |
| canAddBranch | Check branches_count < branches_limit |
| incrementOrderCount | Increment orders_used after order creation |
| resetMonthlyUsage | Reset on billing cycle start |
| getUsageHistory | Historical usage records |

## Limit Check Functions

| Function | Limit Type | Returns |
|----------|------------|---------|
| canCreateOrder(tenantId) | orders | LimitCheckResult { canProceed, current, limit, message? } |
| canAddUser(tenantId) | users | LimitCheckResult |
| canAddBranch(tenantId) | branches | LimitCheckResult |

**Unlimited:** If plan limit is -1, returns `{ canProceed: true, limit: -1 }`.

## Plan Limits Middleware

**File:** `web-admin/lib/middleware/plan-limits.middleware.ts`

| Function | Purpose |
|----------|---------|
| checkOrderLimit(request, tenantId) | Calls canCreateOrder; returns 402 if exceeded |
| checkUserLimit(request, tenantId) | Calls canAddUser |
| checkBranchLimit(request, tenantId) | Calls canAddBranch |
| checkLimit(request, tenantId, limitType) | Generic dispatcher |
| withLimitCheck(limitType, handler) | HOF to wrap API routes with limit check |

**402 Response:** `{ error: 'LIMIT_EXCEEDED', message, details: { limitType, current, limit, upgradeUrl } }`

## Where Limit Checks Are Called

| Location | Limit | Usage |
|----------|-------|-------|
| workflow-service-enhanced.ts | orders | `canCreateOrder(tenantId)` before creating order |
| plan-limits.middleware.ts | order, user, branch | checkOrderLimit, checkUserLimit, checkBranchLimit (for use in API routes) |

**Note:** Middleware `withLimitCheck` is provided but not yet applied to order/user/branch creation API routes. Order creation uses `canCreateOrder` directly in workflow-service-enhanced.

## See Also

- [PLAN_LIMITS_REFERENCE](PLAN_LIMITS_REFERENCE.md)
- [PLAN_CONSTRAINTS](PLAN_CONSTRAINTS.md)
- [SUBSCRIPTION_UI](SUBSCRIPTION_UI.md)
