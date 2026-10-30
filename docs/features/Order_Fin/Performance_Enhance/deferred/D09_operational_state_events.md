# D09: optional operational-state invalidation events

Status: **deferred design; not implemented**. This item concerns cross-cashier/tab invalidation after the correctness path is complete. It does not introduce a Realtime channel, subscription, event broker, migration, permission, polling service, or operational guarantee.

Related: [developer guide](../developer_guide.md), [financial snapshot contract](../technical_docs/financial_snapshot_contract.md), and [testing guide](../testing_guide_and_scenarios.md).

## Purpose

Active drawer/POS sessions and available stored value can change from another cashier, tab, administrator, or background process. Optional invalidation hints can reduce the time a client displays obsolete operational information. They are a UX/freshness improvement, not the source of financial correctness.

The baseline must already have scoped caches, bounded freshness, explicit failure recovery, invalidation after local successful writes, and server validation at the financial write boundary. Do not delay those controls while waiting for an event system.

## Current-source facts

`web-admin/src/features/orders/hooks/use-cash-drawer.ts` loads drawer configuration/current sessions with a 30-second stale time and the cashier's active POS context with a 15-second stale time. The payment engine applies drawer requirements only to methods that require them.

`web-admin/lib/services/order-credit-application.service.ts` emits `OUTBOX_EVENT_TYPES.STORED_VALUE_CHANGED` in an existing credit-application path. That source observation does not prove that every balance/session mutation emits a suitable event, that a tenant browser receives it, or that a deployed real-time invalidation path exists. Inventory relevant producers and consumers before proposing new transport.

## Proposed design constraints

- Prefer existing authorized event/outbox infrastructure if it supplies the required guarantees. New infrastructure needs a separate justified decision.
- Emit only after the relevant transaction commits. Never signal an uncommitted balance/session as usable.
- Route hints by explicit tenant and necessary subject scope, such as branch, cashier, drawer/session, or customer. A browser must never subscribe to another tenant's data or infer another customer's private balance from an event.
- Carry minimal identifiers and an optional source sequence/version. Do not broadcast amounts, PINs, gift numbers, tokens, or unnecessary customer details.
- Treat every event as an invalidation hint. Refetch through the authorized API; never apply an event payload as financial authority.
- Deduplicate, coalesce bursts, and bound refresh work. One drawer lifecycle operation should not trigger uncontrolled quote requests in every cashier tab.
- Handle out-of-order/duplicate/missed messages, disconnects, reconnects, and expiry. Reconnect performs a scoped refresh; conservative time-based revalidation and server checks remain available when events are unavailable.
- On logout/tenant/cashier switch, unsubscribe and clear relevant client data. A late callback must not invalidate or populate the next identity's cache with old subject data.
- A quote refresh caused by an event preserves typed amounts/legs and invalidates stale confirmation; it never silently reallocates money.

Potential subjects include drawer-session open/close/relink, POS lifecycle changes, and relevant stored-value mutations. These are candidate behaviors, not newly registered event codes. Catalog names, payload contracts, and permission changes must follow the established ownership and migration protocol if implementation is approved.

## Suggested acceptance sequence

1. Verify existing event producers, transaction boundaries, delivery semantics, and authorized consumers.
2. Prove correct behavior with events disabled: stale operational state fails closed at submit, local transitions invalidate, and retries recover.
3. Prototype one minimal scoped invalidation path, measuring event-to-refresh delay and extra API load.
4. Test two cashiers, two tenants, two tabs, lost/duplicate/out-of-order events, reconnect, logout, and a close/relink racing with submission.
5. Review production telemetry and operational rollback before broadening coverage.

Rollout and rollback remain independent of payment acceptance: disabling optional event hints must preserve the safe baseline and cannot make a stale session financially valid.
