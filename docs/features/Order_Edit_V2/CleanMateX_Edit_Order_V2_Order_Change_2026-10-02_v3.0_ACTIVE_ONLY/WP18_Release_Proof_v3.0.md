# WP18 Release proof

**Date:** 2026-10-17 (Asia/Muscat)
**Status:** CODE PROOF COMPLETE 2026-11-07 — only the UI retest (OC-UI-001–012, manual / Playwright) is open. Not a pilot approval.
**Authority:** Living plan WP18.

## What passed on local Postgres

| Scenario | Result |
|---|---|
| OC-CON-001 / OC-CON-007 | Same key and same note, including two overlapping Applies, stored one Change and replayed the second. |
| OC-CON-002 | Same key and a different note returned `IDEMPOTENCY_CONFLICT`. One Change remained. |
| OC-CON-003 | Two editors with the same revision: one commit, one `VERSION_CONFLICT`. |
| OC-CON-004 | A workflow version move after Review returns `WORKFLOW_VERSION_CONFLICT` under the order lock. No Change row. |
| OC-SEC-001 | Apply with another organization's id left the order note and revision unchanged. |
| OC-SEC-004 | 2026-11-07: migration 0702 applied; `order-committed-column-guard.db.test.ts` 4/4 — `authenticated` cannot change a committed order's money or lines, workflow writes and server writers unaffected. See [WP17 column-guard note](WP17_Postponed_Committed_Column_Guard_v3.0.md). |
| OC-SEC-002 | An item id that is not on the order returns `REMOVAL_NOT_ACTIVE` before a Change row is inserted. |
| OC-CON-005 | 2026-11-07. Review signs a digest of every settlement fact (`readSettlementFingerprint`: payments with status, amount and change returned; credit applications; refunds; overpayment dispositions — all tenant-filtered). Apply re-reads it **after taking the order lock** and returns `REVIEW_CHANGED` before any write when it moved (it compared payments only, outside the lock, before). The shared snapshot writer `recalculateOrderFinancialSnapshotTx` now takes the order lock before reading, so every settlement writer (collect, transition, refund, credit, disposition) and Apply recompute one at a time instead of writing totals from stale rows. Proof: `order-change-settlement-race.db.test.ts` 2/2 on PostgreSQL (fingerprint moves on a payment; the writer waits on a held order lock, `55P03` with a 1.5 s lock timeout); `order-change-apply.service.test.ts` (refund after Review → `REVIEW_CHANGED`, no write). |
| OC-CON-006 | 2026-11-07, verified in code (no separate race test). Split now locks the parent order `FOR UPDATE` (and the moved lines) in its transaction, the same lock Apply takes, so a split and an Apply run one after the other. A split that lands between Review and Apply changes the facts Apply re-reads under the lock: a touched line's before values (signed operation digest → `REVIEW_CHANGED`) or the rolled-up total (`assertCommercialSnapshot` → rollback). Neither can apply over a split silently. |
| OC-SEC-003 | 2026-11-07. The request schemas are strict: a body with `tenantId`, `actorUserId`, `tenantOrgId` or `createdBy` returns 400 `VALIDATION_ERROR` before the order is read; context, preview and Apply always get the session's organization and user (`order-change-apply.route.test.ts`). |
| OC-SEC-005 | 2026-11-07. Static scan `__tests__/tenant-isolation/order-edit-tenant-predicate-scan.test.ts` over `lib/services/order-change`, `lib/services/commercial` and `lib/services/order-fin-view`: every Prisma call and raw SQL block on an `org_*` table must carry `tenant_org_id` (a shared `scope` object counts; `org_tenants_mst` has no such column). Passes; it fails on any new unscoped query. These folders use Prisma as `postgres`, not the Supabase service-role client. |
| OC-SEC-006 | Missing `orders:edit`: preview and Apply routes return 403 before loading facts (`order-change-preview.route.test.ts`, `order-change-apply.route.test.ts`). |
| OC-SEC-007 | Missing override permission: the capability evaluator denies `REQUIRE_OVERRIDE` with `OVERRIDE_FORBIDDEN` (`order-change-capability.service.test.ts`); Apply re-runs it through the fresh preview with the real permission check. |

Command, from `web-admin`:

```text
npx jest --config jest.db.config.js __tests__/db-integration/order-change-concurrency.db.test.ts __tests__/db-integration/order-change-tenant-isolation.db.test.ts --watchman=false --forceExit
```

6 tests passed. The mutation unit suite passed, including the workflow-version case.

Applied Change history and a committed order cannot be deleted. The local proof rows use the `WP18-` order-number prefix and remain in the local database.

## Still open

| Scenario | Why it is not passed |
|---|---|
| OC-UI-001–012 | Playwright was not run. The manual UI retest is still open. |
| Backfill | WP02 already recorded no remaining historical cohort. No new backfill migration was created. |

## Not started

WP19 pilot and default cutover stay not started. WP20 cleanup stays not started until a rollback window has closed.
