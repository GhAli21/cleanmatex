# Delivery Proof and Handover Audit

**Status:** Implemented read surface; not a staff delivery-completion approval.  
**Last updated:** 2026-08-27

## Responsibility

`DeliveryProofAuditService` is the single server-side read model for completed delivery
proof and handover information. It is consumed by the Delivery Stop Detail and the Order
Details **Delivery Proof** tab. Neither UI surface queries delivery, POD, user, or
storage records directly.

## Contract

`GET /api/v1/delivery/orders/{orderId}/proof`

- Requires authenticated `orders:read` access.
- Resolves the tenant from the authenticated request, then applies `tenant_org_id` to
  the order, stop, POD, and operator queries.
- Returns the workflow outcome, settlement state, completed delivery stops, proof
  method, time, operator display name, notes, and authorized evidence links.
- Returns `404 ORDER_NOT_FOUND` for an unknown or cross-tenant order.
- Never mutates workflow, money, POD, release, stop, route, history, or outbox state.

The Delivery Stop Detail page continues to require `drivers:read` and `orders:read`.
The shared audit endpoint remains `orders:read` because it is also used by Order Details.

## Evidence boundary

Evidence objects belong to the private `delivery-pod-evidence` bucket. The service
accepts a private object key only when it starts with
`{tenantId}/delivery/{stopId}/`; it then creates a five-minute signed URL at read time.
Object keys, signed URLs, and receipt records are never written back to the database by
the audit read. Failed signing omits only that evidence item and logs the failure.

Existing validated HTTP(S) legacy proof URLs are preserved as a temporary compatibility
fallback. They must not be used as a reason to make the private bucket public.

## Client flow

1. `DeliveryProofAuditCard` calls `useDeliveryProofAudit(orderId)`.
2. The hook calls `delivery-proof-audit-api.ts`, which requests the authenticated API.
3. The card renders the read model and allows an explicit refresh after link expiry.
4. A delivery-completion mutation invalidates the audit query so committed proof can be
   read immediately after the command succeeds.

## Dependencies and tests

- Storage and receipt prerequisites: migrations `0451` and `0452`.
- Service coverage: `__tests__/services/delivery-proof-audit.service.test.ts`.
- API coverage: `__tests__/api/v1/delivery-proof-audit.route.test.ts`.
- Route/access contracts: `src/features/orders/access/orders-access.ts`.

## Release boundary

This surface may be verified independently as a read-only operational aid. It does not
enable staff delivery completion. Floor confirm uses
`POST /api/v1/delivery/orders/{orderId}/complete` or
`POST /api/v1/delivery/stops/{stopId}/complete`; this audit card remains read-only.
