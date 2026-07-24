# CleanMateX Order Workflow V1 — Fulfilment and Partial Release Specification

**Document ID:** CMX-OW-V1-PACK-011  
**Version:** 1.0  
**Status:** Implementation specification

## 1. Goal

Allow one commercial order to be fulfilled through one or more safe, auditable releases.

## 2. Release types

- Customer collection
- Laundry delivery
- B2B handover

Pickup is inbound custody.

## 3. Release unit

Support piece-level release, quantity-level release when pieces are not tracked, and optional package reference. Packages are optional unless HQ profile requires them.

## 4. Lifecycle

Collection:

```text
draft → eligibility_pending → ready_for_verification → verified → released
```

Delivery:

```text
draft → eligibility_pending → ready_for_verification → verified
→ dispatched → out_for_delivery → delivered
```

Failure:

```text
out_for_delivery → failed → returned_to_branch
```

## 5. Eligibility

Selected content must be ready, unreleased, not in another active release, not vendor-held, not held, correctly scanned when required, financially releasable, allowed for the method, and tenant/order-consistent.

## 6. Partial fulfilment

```text
10 required
7 collected
3 remaining
fulfilment_status = partially_fulfilled
```

Final release changes to fully fulfilled. Commercial status remains in progress until completion policy passes.

## 7. Mixed methods

HQ profile may allow some pieces collected and remaining pieces delivered. Each release has its own method/evidence.

## 8. Verification

Collection may require identity, representative authorization, OTP/PIN, signature, scans, and payment.

Delivery may require driver, load scan, OTP, signature, photo, GPS/time, and payment.

## 9. Finance

Workflow requests release decision from Order Fin. Release stores value snapshot, currency, decision reference, and payment reference where applicable. Allocation authority remains in Order Fin.

## 10. Immutability

Verified releases cannot be freely edited. Correct through cancel/recreate before handover when allowed. Released/delivered history is immutable; returns use separate flows.

## 11. Failed delivery

Record attempt, reason, evidence, contact result, content, payment result, driver, location, and time; then reschedule or return/reconcile at branch.

## 12. Completion

- fully_fulfilled: all required obligations released/resolved
- completed: operational + fulfilment complete
- closed: financial/issues/returns also closed

## 13. UI

Ready screen groups eligible, blocked, not ready, and already released. Show selected and remaining counts before confirmation.

## 14. Constraints

No overlapping piece release, over-release, vendor-held release, delivery without required evidence, or full fulfilment with outstanding required quantity.

## 15. Tests

Partial collection/delivery, mixed methods, duplicate release, stale release, payment block, B2B, failed delivery, return to branch, idempotent POD, concurrency, and RLS.

## 16. Acceptance criteria

- Multiple releases are safe.
- Same piece cannot be released twice.
- Remaining content stays visible.
- Collection and delivery are distinct.
- Fulfilment can be rebuilt.
