# 08 — UI/UX Screens

**Status:** P6 tenant profile + public tracking refresh · **Date:** 2026-07-25

## 1. Floor UX

- One primary CTA from `listAvailableActions`; show `blockedReasons` clearly (Cmx + `cmxMessage`)
- No transition graphs; no raw status pickers on happy path
- Ready: **Mark ready** vs **Release** separated
- Delivery: finalize via **Confirm delivery** (POD collected in same flow / attached evidence) — not a separate “POD saves status” control
- EN/AR + RTL

## 2. Per-screen integration (V1.0)

| Feature | Screen | Workflow |
|---------|--------|----------|
| New Order | `new_order` | InitialStatusResolver; intake/send actions |
| Preparation | `preparation` | `COMPLETE_PREPARATION` |
| Processing | `processing` | leave actions |
| Assembly / QA / Packing | profile-gated | actions + gates |
| Ready | `ready_release` | `MARK_READY` / `RELEASE_*` |
| Pickup | `pickup_counter` | Fin + release + engine |
| Delivery | `driver_delivery` | Target: atomic `CONFIRM_DELIVERY`; staff writes currently fail-closed pending hardening |
| Cancel/Return | | Fin then engine |

## 3. Tenant settings (not a Studio graph editor)

- View **effective HQ profile** (stages enabled, labels)
- Optional: choose among **HQ-approved** profiles
- **No** tenant CRUD for statuses, transitions, gates, initial rules

## 4. Public order tracking page

- Canonical customer link is opaque: `/track/{token}`
- Legacy readable route remains as a compatibility shim and redirects when a token exists
- Public page shows current status plus remaining amount when `payment_type_code = PAY_ON_COLLECTION` and balance remains
- Confirm-received CTA disables when the order is already `delivered` or after the public confirm succeeds
- Delivered confirmation uses the same V2 engine contract (`CONFIRM_DELIVERY`) when canary is enabled

## 5. HQ configuration UX

- Lives in Platform HQ (cleanmatexsaas): draft → validate → publish → assign
- Tenant app consumes published assignments via HQ API

## 6. Related

- [01_PRD.md](01_PRD.md)
- [07_Permissions_RBAC_Nav.md](07_Permissions_RBAC_Nav.md)
