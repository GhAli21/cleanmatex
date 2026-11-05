# API Route Auth Hardening (BF-23 / BF-24 / BF-25) — QA Test Guide

**Status:** [STATUS.md](STATUS.md)
**Plan:** [PLAN.md](PLAN.md)

Owner-runnable scenarios for the session/permission guards added across BF-23 (30+1 routes), BF-24 (45 legacy routes), and BF-25 (shadowed `getAuthContext()` fixes). Each row names the sidebar path and/or URL, what to do, and what should happen.

| # | Who | Steps | Expected |
|---|---|---|---|
| 1 | `viewer` | Catalog → Services (`/dashboard/catalog/services`) | New product, Import and Export buttons are not shown |
| 2 | `viewer` (API) | Call `POST /api/v1/products` from the browser console | 403 `Permission denied: products:create` |
| 3 | `laundry_worker` | Processing (`/dashboard/processing`) → open an order → advance a step, report an issue | Both work; Split controls are hidden |
| 4 | `operator` | Same order with split enabled in tenant settings | Split controls shown and split works |
| 5 | `cashier` | Issues (`/dashboard/issues`) | Issues listed with Solve; resolving works |
| 6 | `admin` (not tenant_admin) | Catalog → Categories | Switches read-only, no Save button |
| 7 | `tenant_admin` | Catalog → Categories → toggle → Save | Saves (previously always failed with 404) |
| 8 | `tenant_admin` | Settings → Workflow Roles (`/dashboard/settings/workflow-roles`) | **Retired 2026-10-30** — menu item and route are gone (see STATUS.md log); skip this scenario |
| 9 | `tenant_admin` | Settings menu | No "Navigation" item; `/dashboard/settings/navigation` returns 404 |
| 10 | any user | Admin revokes the user's session (Users → Sessions), then the user opens a Ready order (`/dashboard/ready/[id]`) | Redirected to login; `GET /api/v1/orders/[id]/state` answers 401 `SESSION_ENDED` |
| 11 | any authenticated user | Catalog → Settings (`/dashboard/settings/catalog` or `/dashboard/settings/categories`), check network tab for `/api/settings/catalog` and `/api/settings/categories` | Request succeeds for a logged-in session; the same request with the session cookie cleared returns 401 (previously it would have silently succeeded via the shared `HQ_SERVICE_TOKEN`) |
| 12 | `admin`/`owner` | Customers (`/dashboard/customers`) → Export, and → merge two duplicate customers | Both work as before; confirm a non-admin role gets 403 on `POST /api/v1/customers/merge` and `GET /api/v1/customers/export` |
| 13 | any tenant user | Create/update a customer address (`/dashboard/customers/[id]` → Addresses tab), and run the customer profile upgrade flow | Both work as before; confirm an unauthenticated request to any `/api/v1/customers/[id]/addresses*` or `/api/v1/customers/[id]/upgrade` route returns 401 |
| 14 | `tenant_admin` on a plan with ERP-Lite enabled | Open any `/dashboard/erp-lite/*` page | Pages gate correctly by the tenant's real feature-flag entitlement (session-derived), not a forgeable claim |

## Notes

- Scenarios 1–10 are from the original BF-23 implementation; 11 covers the BF-24 `settings/catalog`/`categories` session-check fix; 12–14 cover BF-25 (shadowed `getAuthContext()` in customers routes + `feature-flags.service.ts`).
- None of these require a DB migration beyond the already-applied `0660` (BF-23) and `0663` (workflow-roles retirement, owner-applied).
