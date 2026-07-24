# 07 — Permissions, RBAC, Navigation

**Status:** P0 correction pass · **Date:** 2026-07-24

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

## 4. Related

- [08_UI_UX_Screens.md](08_UI_UX_Screens.md)
- [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)
