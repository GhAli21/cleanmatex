# WP18 Release proof

**Date:** 2026-10-17 (Asia/Muscat)
**Status:** PARTIAL. Not a pilot approval.
**Authority:** Living plan WP18.

## What passed on local Postgres

| Scenario | Result |
|---|---|
| OC-CON-001 / OC-CON-007 | Same key and same note, including two overlapping Applies, stored one Change and replayed the second. |
| OC-CON-002 | Same key and a different note returned `IDEMPOTENCY_CONFLICT`. One Change remained. |
| OC-CON-003 | Two editors with the same revision: one commit, one `VERSION_CONFLICT`. |
| OC-CON-004 | A workflow version move after Review returns `WORKFLOW_VERSION_CONFLICT` under the order lock. No Change row. |
| OC-SEC-001 | Apply with another organization's id left the order note and revision unchanged. |
| OC-SEC-002 | An item id that is not on the order returns `REMOVAL_NOT_ACTIVE` before a Change row is inserted. |

Command, from `web-admin`:

```text
npx jest --config jest.db.config.js __tests__/db-integration/order-change-concurrency.db.test.ts __tests__/db-integration/order-change-tenant-isolation.db.test.ts --watchman=false --forceExit
```

6 tests passed. The mutation unit suite passed, including the workflow-version case.

Applied Change history and a committed order cannot be deleted. The local proof rows use the `WP18-` order-number prefix and remain in the local database.

## Still open

| Scenario | Why it is not passed |
|---|---|
| OC-CON-005 | Apply does not reload a payment, refund, or credit that arrives after Review. |
| OC-CON-006 | Split is not a locked transaction, so a Change/split race is not proven. |
| OC-SEC-003, 006, 007 | Forged actor, missing `orders:edit`, and missing override are route and permission checks, not this database run. |
| OC-SEC-004 | Direct table grants are still postponed in the WP17 column-guard note. This package does not revoke them. |
| OC-SEC-005 | Service-role queries in this path filter `tenant_org_id`. A repository-wide scan was not run. |
| OC-UI-001–012 | Playwright was not run. The manual UI retest is still open. |
| Backfill | WP02 already recorded no remaining historical cohort. No new backfill migration was created. |

## Not started

WP19 pilot and default cutover stay not started. WP20 cleanup stays not started until a rollback window has closed.
