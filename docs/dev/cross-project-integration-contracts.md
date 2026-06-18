# Cross-Project Integration Contracts

## Tenant App Rule

Do not copy implementation code between `cleanmatex` and `cleanmatexsaas`.

For cross-project work, document what the sibling project should build, expose, call, consume, regenerate, or document. Do not copy DTOs, enums, constants, utilities, validation schemas, UI components, API clients, or source files between repositories.

## Tenant-Side Responsibilities

`cleanmatex` is the tenant-facing application. Its implementation must stay tenant-scoped:

- Use RLS-aware access patterns.
- Always filter tenant data by `tenant_org_id`.
- Never use platform service-role patterns.
- Never query platform-managed settings or feature-flag tables directly.
- Consume platform-managed settings and feature flags through documented HQ APIs.

## Contract-First Coordination

Use one of these contracts instead of copied code:

- HTTP API contract
- Event payload contract
- Database schema and generated type contract
- UI behavior/token/accessibility contract
- ADR proposal for user decision on a package, generated artifact, or UI coordination

For ADRs created for package, generated artifact, strict-identical implementation, or UI coordination decisions, the ADR is approved only when the ADR file contains the exact marker `Approved_By_Jh`. Until the user writes `Approved_By_Jh` inside the ADR file, treat it as not approved and do not implement.

## Database Coordination

Database migrations are created in `cleanmatex` only. Agents must not apply migrations.

After the user applies a migration, regenerate types in the consuming project as needed. Do not manually copy generated or handwritten types between repos.

## Financial Catalogs & Feature Flags (added 2026-06-18)

HQ now owns and exposes the 14 `sys_fin_*` catalog tables (settlement, BVM, payment config)
through the `fin-settlement-catalogs` NestJS module.

**cleanmatex must:**
- Call `GET /api/hq/v1/fin-catalogs/*` to read catalog data — never query `sys_fin_*` directly
- Evaluate financial feature flags via `GET /api/hq/v1/feature-flags/tenants/:id/evaluate/...`
- Never query `sys_feature_flags_mst` or `sys_feature_flags_*` tables directly
- Fall back to `false` for feature flag evaluation if HQ is unavailable (fail-closed)

**Active feature flags:**

| Flag key | Default | Purpose |
|---|---|---|
| `customer_receipt_allocation_v1` | false | Gates allocation preview/post + account receipts |
| `overpayment_disposition_v1` | false | Gates overpayment disposition UI |

**BVM line_role / target_type constraint:** Adding new codes to `sys_fin_vch_line_role_cd` or
`sys_fin_vch_target_type_cd` requires a cleanmatex migration to extend the CHECK constraint on
`org_fin_voucher_trx_lines_dtl`. Coordinate with the HQ team before adding rows.

Full contract details: `F:/jhapp/cleanmatexsaas/docs/dev/rules/integration-contracts.md` §15

---

## Reference

Primary guide: `F:/jhapp/cleanmatexsaas/docs/dev/cross-project-integration-contracts/developer_guide.md`  
Integration contracts (detailed, numbered): `F:/jhapp/cleanmatexsaas/docs/dev/rules/integration-contracts.md`
