# ADR-052 — E-Invoicing Foundation in Launch Scope

**Date:** 2026-06-18 · **Status:** Accepted (Approved_By_Jh) · **Decision ID:** D-02
**Ref:** [Opus_Validation_Report_18_06_2026/23_DECISIONS_ADDENDUM.md](../Opus_Validation_Report_18_06_2026/23_DECISIONS_ADDENDUM.md) · relates to [ADR-007](./ADR-007-tax-documents-separate.md), [ADR-043](./ADR-043-Tax-Document-and-Voucher-Receipt-Bridge.md)

## Context
The forensic validation (F-05) found tax-base decomposition stubbed: `order-financial-write.service.ts` hardcodes `non_taxable/exempt/zero_rated/out_of_scope = 0`, and the tax engine emits only a single `taxable_amount`. Tax documents exist (`org_tax_documents_mst`, `0341`) but no fiscal-total reconciliation or category breakdown. Flat single-rate VAT works today; e-invoicing / multi-category tax does not.

## Decision
**E-invoicing foundation is in launch scope → F-05 is a GA gate**, delivered as its **own phase** (not bundled into the tight Phase-1 idempotency/RLS batch).

### Tenant activation (runtime rule)
E-invoice flow is active for an order only when:
```
tenant.is_e_invoice_enabled = true
AND order_date >= tenant.e_invoice_enabled_start_date
```
- Add tenant enablement: `is_e_invoice_enabled` (bool, default false) + `e_invoice_enabled_start_date` (date), with a constraint that the start date is non-null when enabled.
- **Open placement decision (must resolve before the e-invoicing phase):** dedicated columns on `org_tenants_mst` vs the existing `org_tenants_mst.feature_flags` jsonb vs an HQ-managed setting (cleanmatexsaas owns tenant management; settings/feature-flags are HQ-managed per CLAUDE.md). See [23 §Open implementation decisions](../Opus_Validation_Report_18_06_2026/23_DECISIONS_ADDENDUM.md).

### Foundation scope (this e-invoicing phase)
- tenant flag + activation helper (`is e-invoice active for (tenant, orderDate)`)
- tax-category decomposition foundation: `STANDARD`, `EXEMPT`, `ZERO_RATED`, `OUT_OF_SCOPE`
- fiscal-total validation foundation (tax-document total reconciles to order total)
- e-invoice status/audit/error scaffolding (where existing tables allow)
- tests: disabled tenant; enabled-before-start-date; enabled-on/after-start-date; decomposition; fiscal-total validation

### Jurisdiction adapters
Country-specific adapters (e.g. Saudi **ZATCA**) are **separate jurisdiction adapters**, GA-blocking **only** for the tenants/jurisdictions included in launch. Not all-country in this phase.

## Consequences / honesty guardrail
- The tax engine currently emits only one `taxable_amount`; **real per-category decomposition is greenfield**. The foundation phase delivers the tenant flag + activation + status/audit scaffolding; **F-05 must NOT be marked complete until decomposition is real** (engine emits per-category buckets and they reconcile).
- Disabled tenants and pre-start-date orders follow the existing flat-VAT flow unchanged (no behavior change for current tenants).

## Alternatives considered
- **Defer e-invoicing post-launch:** rejected by D-02 — launch scope includes it.
- **Implement all country adapters now:** rejected — only launch jurisdictions are GA-blocking; adapters are pluggable.

## Implementation status
- **2026-06-20 — Foundation SHIPPED (NOT complete).** Placement decision resolved: **dedicated typed columns on `org_tenants_mst`** (`is_e_invoice_enabled`, `e_invoice_enabled_start_date`) via migration `0383_einvoice_tenant_enablement.sql` (applied local + remote), with CHECK `chk_org_tnt_einv_start`. Delivered: activation rule + helpers (`lib/payments/e-invoice.ts`), server reader (`lib/services/e-invoice.service.ts`), `TAX_CATEGORY`/`E_INVOICE_STATUS` constants, decomposition + fiscal-total foundations, 12 unit tests. See [F-05-E-Invoicing-Foundation.md](../F-05-E-Invoicing-Foundation.md).
- **Still open before F-05 is "complete":** real per-category tax decomposition (engine emits EXEMPT/ZERO_RATED/OUT_OF_SCOPE and reconciles), wiring into the order/tax-document path, e-invoice status persistence, jurisdiction adapter(s), and the HQ enablement-toggle UI (cleanmatexsaas).
