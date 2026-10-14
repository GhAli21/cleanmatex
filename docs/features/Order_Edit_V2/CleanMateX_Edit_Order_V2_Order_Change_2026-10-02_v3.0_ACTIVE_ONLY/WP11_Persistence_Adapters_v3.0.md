# WP11 Persistence Adapters, Idempotency and Outbox

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for the caller-transaction adapter. Apply, real PostgreSQL rollback, and finance lock coordination remain later packages.
**Authority:** Living plan WP11, foundation tables from `0547`/`0548`, and the existing idempotency hash and outbox contracts.

## Scope delivered

`persistOrderChangeTx` accepts a caller transaction and does not import the global Prisma client.

- The idempotency key is claimed inside that transaction. The same payload replays the stored Change and does not increment the commercial revision. A different payload is a conflict. A key whose row is not yet visible is in flight.
- The order row is locked, and `edit_state_version` advances by one only when it still matches the expected revision.
- The next `change_no` is one greater than the current maximum for that tenant and order.
- The Change row stores both financial snapshots, the request hash from `hashPayload`, and the final response.
- Operation rows use the frozen catalog and the caller's persisted target ids. A client reference maps to that target id.
- Caller-supplied item, piece, and preference inserts and updates keep the command's `tenant_org_id` and `order_id`. Identity, tenant, order, and removal-lineage fields cannot be supplied by the row payload.
- Removing an item also retires that item's active pieces and the active preferences under the item or those pieces. Historical inactive rows are not given a new removal origin.
- `ORDER_CHANGE_APPLIED` is inserted on the same transaction. Its registered handler confirms the Change row and does not collect or refund. An unregistered event is not used, because the processor would otherwise mark it processed with no consumer.
- `mapPersistedFinancialOutcome` turns a settled preview into `NONE` and an overpayment into `OVERPAYMENT`. An outstanding preview without an explicit collection policy is not stored.

## Files

- `web-admin/lib/services/order-change/order-change-mutation.service.ts`
- `web-admin/lib/services/order-change/order-change-applied.handler.ts`
- `web-admin/lib/utils/idempotency.ts`
- `web-admin/lib/services/outbox-processor.service.ts`
- `web-admin/lib/constants/order-financial.ts`
- `web-admin/__tests__/services/order-change/order-change-mutation.service.test.ts`

No migration, permission, feature flag, route, or screen was added. Existing global idempotency helpers are unchanged.

## Verification

Commands, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-mutation.service.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-mutation.service.ts lib/services/order-change/order-change-applied.handler.ts lib/services/outbox-processor.service.ts lib/utils/idempotency.ts lib/constants/order-financial.ts __tests__/services/order-change/order-change-mutation.service.test.ts --quiet
```

Results: 8 tests passed. ESLint exited 0. Covered cases: one transaction for the Change, operation, forced tenant insert, descendant retirement, and outbox; stale revision; replay; in-flight key; payload conflict; protected field; empty snapshot; outcome mapping; missing-row handler retry; handler registration. No production build, database test, or browser test is claimed.

## Existing code reuse and domain ownership

| Requirement | Existing code found | Canonical domain | Classification | Reused or changed files | Reason |
|---|---|---|---|---|---|
| Payload hash | `hashPayload` | Idempotency | REUSE_AS_IS | `idempotency.ts` | The Change stores the same canonical hash. |
| Key claim | Global `claimIdempotencyKey` | Idempotency | REUSE_WITH_EXTENSION | `claimIdempotencyKeyTx` | The new helper takes the caller transaction. The global helper is unchanged. A hidden row is in flight. |
| Outbox insert shape | `emitEventTx` | Outbox | REUSE_WITH_EXTENSION | mutation service writes the same pending row on the caller transaction | Importing `outbox.service.ts` would load the global Prisma client. The event type is still the shared catalog. |
| Applied-event consumer | Processor marks an event with no handler as processed | Outbox | NEW_REQUIRED | `order-change-applied.handler.ts` | The handler only confirms the row. It does not become a finance writer. |
| Commercial inserts | Create item and preference services open their own clients | Orders | NEW_REQUIRED orchestration | caller-supplied row bags | The adapter forces tenant and order. It does not price the row. |
| Logical removal | Preference services hard-delete | Orders | NEW_REQUIRED | mutation service | Removal lineage uses the foundation columns. Hard-delete services are not called. |

### Component record

| Field | Value |
|---|---|
| Component | `persistOrderChangeTx` |
| Domain owner | Order Change orchestration; hash owned by idempotency; event name owned by the outbox catalog |
| Responsibility | Persist one Change and its row effects inside the caller transaction |
| Should be domain-agnostic | No |
| Existing equivalents reviewed | Idempotency helpers, outbox writer, preference hard-delete services, foundation Change tables |
| Canonical dependencies | `hashPayload`, foundation tables, `OUTBOX_EVENT_TYPES.ORDER_CHANGE_APPLIED` |
| Legacy Edit behavior reviewed | Current preference writes are not a Change transaction |
| Classification | NEW_REQUIRED adapter over reused hash, tables, and outbox vocabulary |
| Why new code is required | No caller-transaction Change writer existed |
| How duplication is prevented | Pricing, tax, settlement, and workflow are not recalculated here |
| Architecture verdict | Pass for the adapter. Real database rollback is still unproven |

### Legacy behavior

| Legacy behavior | Keep behavior? | V2 destination | Legacy status |
|---|---|---|---|
| Preference hard delete | No, for committed Edit | Logical removal in `persistOrderChangeTx` | TEMPORARY_COMPATIBILITY while legacy Edit remains the live path |

## Dependencies

- Uses the WP02 Change tables and removal columns.
- Uses the WP09 classification only through `mapPersistedFinancialOutcome`. The caller must already have calculated the snapshots and delta.
- WP12 Apply must call this function inside its transaction and roll back when it throws.

## Gaps left to later packages

- No Apply route exists. This function is not exposed over HTTP.
- PostgreSQL rollback, lock waits, and two concurrent Applies are not executed here. The unit test uses stand-ins for the transaction.
- The adapter does not build item, piece, or preference commercial columns. The caller supplies them.
- Outstanding collection required versus optional is not inferred.
- Finance source locks are unchanged.

## Database, API, and UI

No new database object. `ORDER_CHANGE_APPLIED` is a new outbox event name on the existing text column, with a registered handler. No new endpoint and no Edit screen.
