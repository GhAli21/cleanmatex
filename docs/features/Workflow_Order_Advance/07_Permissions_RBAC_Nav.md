# 07 — Permissions, RBAC, Navigation

**Status:** P7R access-contract refresh · **Date:** 2026-08-21

## 1. Permission model

- Floor: `orders:transition` + optional per-action codes (valid `resource:action`)
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

## 4. Delivery proof/audit access

| Surface | Permission contract | Notes |
|---------|---------------------|-------|
| `GET /api/v1/delivery/orders/{orderId}/proof` | `orders:read` | Tenant-scoped read of proof/audit data. No new permission code or permission-seed migration is required because it reuses the existing order read permission. |
| Order Details → **Delivery Proof** | Order Details page contract plus `orders:read` API dependency | The tab is read-only and cannot complete delivery or mutate financial data. |
| Delivery Stop Detail → proof/audit card | `drivers:read` + `orders:read` page gate; `orders:read` audit API dependency | The stricter Delivery page gate remains in force even though the shared audit endpoint itself needs only order read access. |

No navigation entry was added for proof/audit; it is intentionally embedded in the existing Delivery and Order Details surfaces. The planned Workboard will require its own RBAC, access contract, and dual-written navigation change before it is introduced.

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
