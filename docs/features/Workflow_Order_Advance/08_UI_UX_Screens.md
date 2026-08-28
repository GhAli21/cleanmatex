# 08 — UI/UX Screens

**Status:** P7R Delivery floor matches Ready · **Date:** 2026-08-27

## 1. Floor UX

- One primary CTA from `listAvailableActions`; show `blockedReasons` clearly (Cmx + `cmxMessage`)
- No transition graphs; no raw status pickers on happy path
- Ready: **Mark ready** vs **Release** separated. Ready **list** desk filters use `?focus=` on the same page (`counter` = Pickup desk / waiting at counter). Confirm pickup remains Ready Details only.
- Delivery: list opens `/dashboard/delivery/{id}`. **Confirm delivery** is a stage-owned card (same pattern as Ready pickup). Generic ActionBar `CONFIRM_DELIVERY` is hidden. An active stop shows the existing proof panel; otherwise staff confirm from the order with optional notes. No dummy route is created.
- EN/AR + RTL

## 2. Per-screen integration (V1.0)

| Feature | Screen | Workflow |
|---------|--------|----------|
| New Order | `new_order` | InitialStatusResolver; intake/send actions |
| Preparation | `preparation` | `COMPLETE_PREPARATION` |
| Processing | `processing` | leave actions |
| Assembly / QA / Packing | profile-gated | actions + gates |
| Ready | `ready_release` | `MARK_READY` / `RELEASE_*`; stage-owned pickup panel |
| Pickup | `pickup_handover` | Fin + release + engine; embedded on Ready Details |
| Delivery | `driver_delivery` | `/dashboard/delivery/[id]`: ActionBar + stage-owned complete; stop panel when a stop exists |
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

- Lives in Platform HQ (cleanmatexsaas): draft → validate → compile → publish → assign
- Tenant app consumes published assignments via HQ API
- Simple vs routed delivery is authored here: bind `delivery_stop_active` (and POD evidence) on `CONFIRM_DELIVERY` only for routed profiles. Do not add that gate to catalog `TR_OFD_DELIV`. Preset screens already include `driver_delivery`; the published artifact must still declare the execution edge.

## 6. Delivery proof and handover audit

- The Delivery stop detail and Order Details **Delivery Proof** tab use one reusable audit card and one API contract.
- The card shows workflow outcome, payment state, completed handover time, authenticated staff member, proof method, notes, and available signature/photo links.
- Private links are deliberately time-limited. The card provides **Refresh links** rather than persisting a storage URL in browser or database state.
- No evidence file is displayed to unauthorised users; the Order Details API requires `orders:read`, while the Delivery stop screen also requires `drivers:read`.
- A completed Delivery command invalidates the shared audit query so the committed POD appears without a manual page reload.

## 7. Related

- [01_PRD.md](01_PRD.md)
- [07_Permissions_RBAC_Nav.md](07_Permissions_RBAC_Nav.md)
- [future_work_in_wf/00_WF_ENTITY_GLOSSARY.md](future_work_in_wf/00_WF_ENTITY_GLOSSARY.md) — page vs module vs `screen_key`

## 8. Workboard

- `/dashboard/workboard` is a supervisor queue, not a new workflow stage.
- The top overview cards act as quick-focus segments for **All**, each owner stage, **Blocked**, and **Overdue**.
- Server-side filters cover bounded search, branch, assignee, priority, blocker state, SLA, owner-stage focus, and server-owned pagination.
- The filter toolbar shows the current result count, active filter chips, and a clear-filters action.
- **Open stage** links to the current owner screen. The Workboard contains no action buttons, status selector, payment mutation, or evidence mutation.
- A visible warning lists configured Workboard statuses with no active stage owner so supervisors do not silently lose work due to configuration drift.
