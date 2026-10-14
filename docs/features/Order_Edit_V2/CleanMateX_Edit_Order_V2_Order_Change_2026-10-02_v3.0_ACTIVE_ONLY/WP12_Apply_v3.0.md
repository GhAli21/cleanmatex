# WP12 Atomic Apply API

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for an order-field Change that does not alter the commercial total. Item, piece, preference, and removal writes stay closed. Concurrent finance races are not proven.
**Authority:** Living plan WP12. Persistence stays in `persistOrderChangeTx`. Preview stays in `previewOrderChange`.

## Scope delivered

`POST /api/v1/orders/[id]/changes` commits one reviewed Change or nothing.

- CSRF, `orders:edit`, a bounded body, and a valid `Idempotency-Key` are required before any read.
- The route loads current facts and runs Preview before opening the transaction. Pricing and tax are not called inside the transaction.
- Apply accepts the request only when that fresh Preview is `READY`, the calculation fingerprint matches, and the review proof matches.
- A commercial line operation returns `COMMERCIAL_LINE_UNSUPPORTED`. A projected total that differs from the current total returns `COMMERCIAL_TOTAL_CHANGED`. An outstanding result without an explicit collection policy returns `COLLECTION_POLICY_UNRESOLVED`.
- A settled, total-preserving order-field Change calls `persistOrderChangeTx` once. The order field update uses the same transaction and the revision produced by that call. `CHANGE_ORDER_NOTES` writes `internal_notes` and `customer_notes`. Priority, service speed, ready-by, and the customer snapshot use their existing order columns.
- A replay returns the stored Change and does not write the order fields again. A thrown persistence error aborts the transaction.
- No payment, refund, invoice, fiscal document, or workflow status is written. `state_version` is not incremented.

## Reuse

| Piece | Classification | Boundary |
|---|---|---|
| `previewOrderChange` | REUSE_AS_IS | Called before the transaction. Apply does not reimplement capability, tax, or outstanding. |
| `persistOrderChangeTx` | REUSE_AS_IS | Sole Change writer. Apply does not increment `edit_state_version` itself. |
| `mapPersistedFinancialOutcome` | REUSE_AS_IS | `SETTLED` becomes `NONE`. Outstanding is not guessed. |
| Order column update | NEW_REQUIRED | Only the columns that already exist on `org_orders_mst`. |
| Commercial item/piece/preference writer | Not built | Fail closed. Create's writer is not called and is not copied. |

## Files

- `web-admin/lib/services/order-change/order-change-apply.service.ts`
- `web-admin/app/api/v1/orders/[id]/changes/route.ts`
- `web-admin/src/features/orders/access/orders-access.ts`
- `web-admin/__tests__/services/order-change/order-change-apply.service.test.ts`
- `web-admin/__tests__/api/v1/orders/order-change-apply.route.test.ts`
- `web-admin/__tests__/db-integration/order-change-apply.db.test.ts`

No migration, permission, feature flag, or screen was added.

## Verification

Commands, from `web-admin` unless noted:

```text
npx jest __tests__/services/order-change/order-change-apply.service.test.ts __tests__/api/v1/orders/order-change-apply.route.test.ts --runInBand --forceExit --watchman=false
npx jest --config jest.db.config.js __tests__/db-integration/order-change-apply.db.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-apply.service.ts app/api/v1/orders/[id]/changes/route.ts __tests__/services/order-change/order-change-apply.service.test.ts __tests__/api/v1/orders/order-change-apply.route.test.ts __tests__/db-integration/order-change-apply.db.test.ts src/features/orders/access/orders-access.ts --quiet
```

Results: 12 unit/route tests passed. The database test passed. It inserts a temporary order inside one transaction, applies a note Change, throws, and then finds no Change row for that idempotency key. A follow-up count found no `WP12-` order, no rollback customer, and no `wp12-rollback-` Change. ESLint exited 0.

## Gaps

- Adding, changing, or removing an item, piece, or preference is rejected. Those writes need the canonical commercial row owner, not a second pricing path.
- A note on an order whose preview is outstanding is rejected until collection policy is explicit.
- Two editors, a concurrent payment or refund, same-key parallel requests, and a retained successful commit were not executed. The database proof is rollback of one successful in-transaction Apply.
- Distributed Apply rate limiting is not wired.
- No Edit screen calls this route.
