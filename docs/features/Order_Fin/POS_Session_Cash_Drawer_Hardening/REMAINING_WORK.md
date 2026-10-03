# Remaining work register — POS_Session_Cash_Drawer_Hardening

**Refreshed 2026-10-03 — the program is COMPLETE.** Every open box of the plan is delivered or explicitly superseded with its reason (see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) and STATUS D65–D67). Nothing below blocks release.

## Optional follow-ups

1. `(tenant_org_id, closed_at)` index on `org_cash_drawer_sessions_mst` when a tenant exceeds ~100k drawer sessions (variance report date filter).
2. `PATCH /api/v1/branches/[id]` pricing-mode fields have no permission check (pre-existing; only `timezone_code` is gated).
3. Human-sequential POS `session_no` (needs a per-tenant per-day counter) — deliberately not built.
4. Partial receipt of an in-transit transfer — deliberately out of scope (a shortage is a destination variance).
5. Global date display now follows the tenant timezone; any remaining hard-coded `Asia/Muscat` strings are sample data in registration/settings forms and Storybook.

## Owner-only

Commit; restart the dev server; run QA guide §13–§17; force-close the two historical CLOSING sessions.
