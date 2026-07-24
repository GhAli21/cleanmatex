# 08 — UI/UX Screens

**Status:** P0 correction pass · **Date:** 2026-07-24

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
| Delivery | `driver_delivery` | `CONFIRM_DELIVERY` atomic |
| Cancel/Return | | Fin then engine |

## 3. Tenant settings (not a Studio graph editor)

- View **effective HQ profile** (stages enabled, labels)
- Optional: choose among **HQ-approved** profiles
- **No** tenant CRUD for statuses, transitions, gates, initial rules

## 4. HQ configuration UX

- Lives in Platform HQ (cleanmatexsaas): draft → validate → publish → assign
- Tenant app consumes published assignments via HQ API

## 5. Related

- [01_PRD.md](01_PRD.md)
- [07_Permissions_RBAC_Nav.md](07_Permissions_RBAC_Nav.md)
