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

## 6. Delivery proof and handover audit

- The Delivery stop detail and Order Details **Delivery Proof** tab use one reusable audit card and one API contract.
- The card shows workflow outcome, payment state, completed handover time, authenticated staff member, proof method, notes, and available signature/photo links.
- Private links are deliberately time-limited. The card provides **Refresh links** rather than persisting a storage URL in browser or database state.
- No evidence file is displayed to unauthorised users; the Order Details API requires `orders:read`, while the Delivery stop screen also requires `drivers:read`.
- A completed Delivery command invalidates the shared audit query so the committed POD appears without a manual page reload.

## 7. Related

- [01_PRD.md](01_PRD.md)
- [07_Permissions_RBAC_Nav.md](07_Permissions_RBAC_Nav.md)

## 8. Workboard

- `/dashboard/workboard` is a supervisor queue, not a new workflow stage.
- Cmx KPI cards show in-flight, blocked, and overdue counts for the active filter set.
- Server-side filters cover branch, assignee, priority, blocker state, SLA, and bounded search; pagination is server-owned.
- **Open stage** links to the current owner screen. The Workboard contains no action buttons, status selector, payment mutation, or evidence mutation.
- A visible warning lists configured Workboard statuses with no active stage owner so supervisors do not silently lose work due to configuration drift.
