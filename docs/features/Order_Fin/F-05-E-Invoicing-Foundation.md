# F-05 — E-Invoicing Foundation (ADR-052 / D-02)

**Status:** 🟢 **COMPLETE in cleanmatex (2026-06-25)** — real per-category decomposition + e-invoice status persistence (mig 0386) + ZATCA adapter all shipped. **HQ toggle UI shipped in cleanmatexsaas (2026-06-25).** Live ZATCA submission remains a tracked follow-up (see "F-05 COMPLETION" below).
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
- **Navigation / screens:** none in cleanmatex. Enablement UI is **HQ (cleanmatexsaas)** at `/tenants/[id]/order-fin-settings` (E-invoice tab).
- **Settings / feature flags:** none. Enablement is **dedicated `org_tenants_mst` columns**, deliberately NOT a `sys_stng_*` / `sys_feature_flags_*` entry (so no HQ-API consumption path; it is tenant master data read directly).
- **Plan limits:** none.
- **i18n keys:** none yet (no UI in this phase).
- **API routes:** none added.
- **Migrations:** `0383` (above).
- **RBAC changes:** none.
- **Env vars:** none.

## Cross-project follow-up (cleanmatexsaas)

✅ **DONE 2026-06-25** — HQ tenant-management UI: **Tenant order fin settings** → **E-invoice settings** tab writes `org_tenants_mst.is_e_invoice_enabled` and `e_invoice_enabled_start_date`. See `cleanmatexsaas/docs/features/Order_Fin/e-invoice-hq-tenant-settings.md`.

## Follow-ups (status)

1. ✅ **DONE 2026-06-25** — **Real per-category tax decomposition** — `buildTaxDecomposition(bases)` + `reconcileTaxDecomposition` emit EXEMPT/ZERO_RATED/OUT_OF_SCOPE distinctly; `buildFoundationTaxDecomposition` now delegates.
2. ✅ **DONE 2026-06-25** — **Wire activation + decomposition** — `resolveOrderTaxDecomposition` reads the order's per-category bases from `org_orders_mst` gated by activation.
3. ✅ **DONE 2026-06-25** — **E-invoice status persistence** — migration `0386` adds `org_tax_documents_mst.e_invoice_status` (+ CHECK); `createTaxDocumentTx` stamps PENDING/NOT_APPLICABLE via `resolveInitialEInvoiceStatus`.
4. ✅ **DONE 2026-06-25** — **ZATCA jurisdiction adapter** — `lib/payments/adapters/zatca.adapter.ts` maps the decomposition → ZATCA S/E/Z/O lines + reconciled totals (document SHAPE; live submission/clearance is a tracked follow-up).
5. ✅ **DONE 2026-06-25 (cross-project)** — **HQ toggle UI** in cleanmatexsaas (`/tenants/[id]/order-fin-settings`).

## F-05 COMPLETION (2026-06-25)

| Area | Artifact |
|---|---|
| **Real decomposition (pure)** | `web-admin/lib/payments/e-invoice.ts` — `buildTaxDecomposition`, `reconcileTaxDecomposition`, `resolveInitialEInvoiceStatus` |
| **Order decomposition reader** | `web-admin/lib/services/e-invoice.service.ts` — `resolveOrderTaxDecomposition` |
| **Status persistence** | migration `0386_einvoice_status_column.sql`; `prisma/schema.prisma` field; `createTaxDocumentTx` wiring |
| **ZATCA adapter** | `web-admin/lib/payments/adapters/zatca.adapter.ts` |
| **Tests** | `e-invoice.foundation.test.ts` (20), `zatca.adapter.test.ts` (7); DB-integration `e-invoice-decomposition.db.test.ts` (2), `tax-document-einvoice-status.db.test.ts` (3) |

**Migrations:** `0383` (tenant enablement) + `0386` (e_invoice_status, applied L+R 2026-06-25). **Next free seq = 0387.**

## Validation

- Full `npm test` **1464 / 145 suites**; `npm run test:db-integration` **24 / 7 suites**; eslint 0; tsc 0; i18n parity ✅. Migration `0386` applied to local + remote.
