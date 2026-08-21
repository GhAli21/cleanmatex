# P7R Delivery Risks and Rollout

**Status:** Proof/audit read surface implemented; staff delivery completion remains blocked.  
**Last updated:** 2026-08-21  
**Scope:** Delivery proof/audit only. This document does not approve staff delivery completion.

## What may be released now

The authenticated proof/audit read surface may be deployed after its code and storage
prerequisites are present. It is available from Delivery Stop Detail and the Order
Details **Delivery Proof** tab through `GET /api/v1/delivery/orders/{orderId}/proof`.
It requires `orders:read`; the Delivery page also requires `drivers:read`.

## Preconditions

1. `0451_delivery_pod_private_evidence.sql` and
   `0452_delivery_evidence_upload_receipts.sql` are present in the target environment.
2. The `delivery-pod-evidence` bucket remains private.
3. The deployed build includes `DeliveryProofAuditService`, its API route, and the two
   focused proof/audit test suites.
4. The pilot operator has the documented page/API permissions.

## Pilot checks

1. Use one delivered order owned by the pilot tenant.
2. Compare Delivery Stop Detail and Order Details **Delivery Proof**: workflow outcome,
   payment state, proof method, operator, time, notes, and evidence count must agree.
3. Confirm a returned evidence URL is short-lived, opens only for the authorized user,
   and can be refreshed without changing the order.
4. Attempt a different tenant's order ID with an authorized session. The response must
   be `404 ORDER_NOT_FOUND` and reveal no delivery metadata.
5. Inspect browser/API payloads and logs for accidental object-key or permanent URL
   exposure. Treat any exposure as a security incident.

## Staff delivery completion: explicit NO-GO

Do not enable or bypass staff delivery completion until database-backed rollback,
tenant-isolation, concurrency, payment, POD-method, route-counter, RBAC, idempotency,
pilot, monitoring, and rollback acceptance evidence is signed. OTP is deferred to a
future version and is not an acceptable substitute for the configured proof methods.

## Workboard rollout boundary

Workboard is safe to release only as a read-only surface after migration `0455` and
the corresponding app build are deployed. It does not lower any stage, payment, or
POD permission. A configuration gap is intentionally visible and fail-closed: a
status without an owner-stage mapping is not rendered as an actionable queue row.
Rollback is an application/navigation rollback or removal of the `workboard:read`
assignment; do not add a direct status writer as an operational workaround.

## Rollback

For a proof/audit defect, roll back the application release or remove the deployed API/UI
surface through the normal release process. Keep the evidence bucket private, retain the
audit data for investigation, and do not persist signed URLs or expose storage object
keys to restore access. Record the tenant, order, actor, timestamps, and request ID in
the incident record.

## Canonical references

- [06_API_Contracts.md](06_API_Contracts.md)
- [07_Permissions_RBAC_Nav.md](07_Permissions_RBAC_Nav.md)
- [10_Edge_Cases_and_Risks.md](10_Edge_Cases_and_Risks.md)
- [13_Production_Readiness_Checklist.md](13_Production_Readiness_Checklist.md)
- [testing_guide_and_scenarios.md](testing_guide_and_scenarios.md)
