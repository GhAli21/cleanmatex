# CleanMateX Order Workflow V1 — Testing and QA Master Plan

**Document ID:** CMX-OW-V1-PACK-014  
**Version:** 1.0  
**Status:** Test specification

## 1. Quality objectives

Prevent invalid transitions, cross-tenant access, duplicate effects, double release, custody loss, incorrect fulfilment, release bypass, projection drift, broken RTL, and migration failure.

## 2. Layers

Static analysis, unit, policy, database, RLS, API integration, contract, UI component, Playwright, Flutter, performance, security, migration, backup/restore.

## 3. Unit tests

Status aggregation, rule evaluation, assignment resolution, actions, gates, custody, exception priority, closure, milestones, reasons, approvals.

## 4. Property tests

Conditional rules are deterministic and always produce one route/default. Release quantity never exceeds obligation. Piece cannot be in overlapping release/outsource assignments.

## 5. Database tests

Migration replay, constraints, partial indexes, published immutability, state versions, history/outbox atomicity, projection rebuild, tenant FKs, RLS, contract migration.

## 6. API tests

Every command tests success, permission, invalid state, stale version, duplicate, mismatched payload, missing reason, override, cross-tenant, and structured error.

## 7. Required E2E journeys

1. Simple walk-in
2. Quick Drop
3. Mixed service
4. QA pass
5. QA fail/rework
6. Outsourced carpet
7. Vendor discrepancy
8. Ready but unpaid
9. Partial collection
10. Mixed collection/delivery
11. Partial delivery
12. Failed delivery/return
13. B2B invoiced release
14. Cancel before processing
15. Cancel after work starts
16. Customer return/rework child
17. HQ draft/review/publish/assign
18. Tenant read-only view
19. Arabic RTL
20. Idempotent retry
21. Stale concurrency
22. Legacy endpoint rejection

## 8. UI tests

Primary action, blocker, required fields, loading/empty/error, stale refresh, partial selection, keyboard, screen reader, RTL, responsive.

## 9. Flutter tests

Driver assignment, pickup, load/dispatch, out for delivery, OTP/POD, failure, offline queue, idempotent sync, stale conflict.

## 10. Performance

k6 targets:

- Available actions p95 < 500 ms
- Normal command p50 < 300 ms
- Normal command p95 < 800 ms
- Queue search < 1 s at 100k orders
- No duplicate effect under retry/concurrency

## 11. Security

Cross tenant, HQ API from tenant, escalation, replay, same key/different payload, signed URL, webhook signature, direct RPC, legacy bypass, malicious upload.

## 12. Migration pipeline

```text
empty DB → 0001–0405 → 0406–0420 → seeds
→ schema/RLS → generated types → builds → integration → E2E
```

## 13. Fixtures

Stable IDs, controlled clock, deterministic tenants/branches/users/services/customers/vendors/orders/workflows/delivery/payment states.

## 14. Severity

Critical: data loss, cross tenant, money duplication, double release, custody loss, security bypass.

High: invalid transition, wrong fulfilment, broken rollback, critical RTL flow, migration failure.

No critical/high open at release.

## 15. Exit criteria

All critical suites green, migration replay green, RLS green, E2E green, performance met or approved exception, no critical/high defects, rollback rehearsal passed.
