# 07 — Permissions, RBAC, Navigation

**Status:** P7R Delivery floor + access-contract refresh · **Date:** 2026-08-27

## 1. Permission model

- Floor: `orders:transition` + optional per-action codes (valid `resource:action`)
- Stage-owned Processing, Assembly, QA, Packing, Ready/Release, and Pickup adapters reuse `orders:transition`; they do not introduce a new permission code.
- Tenant profile view / approved-list pick: limited settings permission (e.g. `settings:workflow` read)
- HQ author/publish/assign: HQ Platform permissions (saas) — not tenant cashier roles
- Remap invalid multi-segment codes in one migration

## 2. Access contracts

Golden path for tenant routes that call available-actions / execute / effective-profile.  
HQ routes live in cleanmatexsaas contracts.

## 3. Navigation

| Surface | Who |
|---------|-----|
| Ops screens | Existing nav; align permissions |
| Tenant “Workflow” settings | Effective profile viewer + approved picker only |
| HQ Workflow Studio | Platform console (saas) |

No tenant nav entry for editing transitions/gates/initial rules.

## 4. Delivery floor and proof/audit access

| Surface | Permission contract | Notes |
|---------|---------------------|-------|
| `/dashboard/delivery` | `orders:read` page gate (contract also records `drivers:read`) | Delivery worklist. Open goes to `/dashboard/delivery/{id}`. |
| `/dashboard/delivery/[id]` | `orders:read` | Floor detail: ActionBar + stage-owned Confirm Delivery. |
| `GET /api/v1/delivery/orders/{orderId}/active-stop` | `orders:read` | Chooses stop-owned vs order-keyed writer. |
| `POST /api/v1/delivery/orders/{orderId}/complete` | `delivery:pod` + `orders:transition` | Order-keyed `CONFIRM_DELIVERY` when no active stop. |
| `POST /api/v1/delivery/stops/{stopId}/complete` | `delivery:pod` + `orders:transition` | Stop-owned POD + route + `CONFIRM_DELIVERY`. |
| `GET /api/v1/delivery/orders/{orderId}/proof` | `orders:read` | Tenant-scoped read of proof/audit data. No new permission code. |
| Order Details → **Delivery Proof** | Order Details page contract plus `orders:read` API dependency | The tab is read-only and cannot complete delivery or mutate financial data. |
| Delivery Stop Detail → proof/audit card | `drivers:read` + `orders:read` page gate; `orders:read` audit API dependency | The stricter stop-detail page gate remains in force even though the shared audit endpoint itself needs only order read access. |

No new permission code or permission-seed migration is required for the floor screen. No extra navigation entry was added; Delivery remains the existing `orders_delivery` item. Workboard is a separate dual-written nav change (`0455`).

## 5. Workboard access

| Surface | Permission contract | Notes |
|---------|---------------------|-------|
| `/dashboard/workboard` | `workboard:read` | Page gate via `WORKBOARD_ACCESS`; supervisor read-only surface. |
| `GET /api/v1/workboard/orders` | `workboard:read` | API independently enforces the same permission and authenticated tenant context. |
| Orders navigation → Workboard | `workboard:read` | Roles: `super_admin`, `tenant_admin`, `admin`, `branch_manager`, `supervisor`. |

Migration `0455_workboard_permission_navigation.sql` dual-writes the permission
and `orders_workboard` navigation component. It must be reviewed and applied
before assigning the new permission in a promoted environment.

## 6. Related

- [08_UI_UX_Screens.md](08_UI_UX_Screens.md)
- [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)
