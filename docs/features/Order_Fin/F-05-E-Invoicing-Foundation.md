# F-05 — E-Invoicing Foundation (ADR-052 / D-02)

**Status:** 🟡 Foundation SHIPPED (2026-06-20) — **NOT complete** per ADR-052 honesty guardrail (real per-category tax decomposition + jurisdiction adapters are tracked follow-ups).
**Scope decision:** tenant-flag placement = **dedicated typed columns on `org_tenants_mst`** (Approved_By_Jh). See [ADR-052](./ADR/ADR-052-E-Invoicing-Launch-Scope.md).

## What shipped (foundation)

The activation primitive + scaffolding so e-invoicing can be switched on per tenant without changing behavior for anyone else. Disabled tenants and pre-start-date orders keep the existing flat-VAT flow unchanged.

### Activation rule
```
e-invoice active for an order ⇔
  org_tenants_mst.is_e_invoice_enabled = true
  AND order_date >= org_tenants_mst.e_invoice_enabled_start_date   (calendar-date granularity)
```

## Implementation map

| Concern | Where |
|---|---|
| **Migration** | `supabase/migrations/0383_einvoice_tenant_enablement.sql` — adds `is_e_invoice_enabled` (bool, default false) + `e_invoice_enabled_start_date` (date) + CHECK `chk_org_tnt_einv_start` (start date required when enabled). Additive; applied local + remote. |
| **Prisma schema** | `web-admin/prisma/schema.prisma` — `org_tenants_mst` gains the two fields. |
| **Constants** | `web-admin/lib/constants/e-invoice.ts` — `TAX_CATEGORY` (STANDARD/EXEMPT/ZERO_RATED/OUT_OF_SCOPE), `E_INVOICE_STATUS` (scaffolding, not yet persisted). |
| **Types** | `web-admin/lib/types/e-invoice.ts` — `EInvoiceEnablement`, `EInvoiceActivation`, `TaxCategoryDecomposition`, `FiscalTotalCheck`, `EMPTY_TAX_DECOMPOSITION`. |
| **Pure logic** | `web-admin/lib/payments/e-invoice.ts` — `isEInvoiceActive`, `validateFiscalTotal`, `buildFoundationTaxDecomposition` (V1 STANDARD passthrough). No `server-only` → unit-testable. |
| **Server reader** | `web-admin/lib/services/e-invoice.service.ts` — `resolveEInvoiceActivation(client, tenantId, orderDate)` reads the tenant columns and applies the rule (mirrors `resolveTaxPricingMode`). |
| **Tests** | `web-admin/__tests__/services/e-invoice.foundation.test.ts` — 12 pure tests: disabled / before-start / on-or-after-start / date-granularity / bad-date / fiscal-total / decomposition shape. |

## Feature inventory (per /documentation)

- **Permissions:** none added in cleanmatex. The flag is **read-only** here; writes belong to HQ tenant management. (No `*:*` permission needed for the read path.)
- **Navigation / screens:** none in cleanmatex. The enablement toggle + start-date picker is an **HQ (cleanmatexsaas)** tenant-management UI.
- **Settings / feature flags:** none. Enablement is **dedicated `org_tenants_mst` columns**, deliberately NOT a `sys_stng_*` / `sys_feature_flags_*` entry (so no HQ-API consumption path; it is tenant master data read directly).
- **Plan limits:** none.
- **i18n keys:** none yet (no UI in this phase).
- **API routes:** none added.
- **Migrations:** `0383` (above).
- **RBAC changes:** none.
- **Env vars:** none.

## Cross-project follow-up (cleanmatexsaas)

The columns are defined here (migration ownership), but the **write path is HQ's**: cleanmatexsaas tenant-management must expose an enablement toggle + start-date picker that writes `org_tenants_mst.is_e_invoice_enabled` and `e_invoice_enabled_start_date`. Until then the flags default to `false` (no-op).

## Explicit follow-ups (F-05 NOT complete until these land)

1. **Real per-category tax decomposition** — the tax engine must emit EXEMPT/ZERO_RATED/OUT_OF_SCOPE bases per line; replace `buildFoundationTaxDecomposition` (STANDARD-only passthrough). *This is the blocker for marking F-05 complete (ADR-052).*
2. **Wire activation + fiscal-total validation** into the order/tax-document creation path (`order-financial-write.service.ts`, tax-document issuance).
3. **E-invoice status persistence** — add a status/audit/error column or table; `E_INVOICE_STATUS` is currently TS-only scaffolding.
4. **Jurisdiction adapter(s)** — e.g. Saudi ZATCA — pluggable, GA-blocking only for launch jurisdictions.
5. **HQ toggle UI** (cross-project, above).

## Validation

- F-05 unit tests: **12/12 pass**. Typecheck: **0 new errors** (project total unchanged). Migration verified live on local (columns + CHECK).
