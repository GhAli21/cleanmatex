# Phase 2 — Tax-Base Decomposition Columns

**Status:** Done
**Date:** 2026-06-04
**Plan ref:** [order-fin-v1_1-full-alignment-implementation-plan.md](order-fin-v1_1-full-alignment-implementation-plan.md) §Phase 2
**Spec ref:** Order Fin v1.1 §8.11 — Tax bases

---

## Problem

Order Fin v1.1 §8.11 requires `org_orders_mst` to carry a five-bucket tax-base decomposition so jurisdiction-grade reporting (ZATCA / UAE / Oman VAT) can describe how the order's commercial base splits across tax treatments:

| Bucket | Meaning |
|---|---|
| `taxable_amount` (already existed) | Standard taxable base |
| `non_taxable_amount` (added) | Excluded from tax base by tenant policy (tips, certain fees) |
| `exempt_amount` (added) | Legally exempt from tax |
| `zero_rated_amount` (added) | Taxed at 0% but reportable as zero-rated |
| `out_of_scope_amount` (added) | Outside the local VAT/GST regime |

Before Phase 2 only `taxable_amount` existed; the other four buckets had no schema, no read contract, and no UI surface — blocking compliance-grade reporting and forming the P1 gap flagged in the June 2 comparison audit.

---

## Schema change

### Migration

[`supabase/migrations/0336_order_fin_tax_base_decomposition.sql`](../../../supabase/migrations/0336_order_fin_tax_base_decomposition.sql) **— applied 2026-06-04**

`ALTER TABLE public.org_orders_mst ADD COLUMN IF NOT EXISTS`:

- `non_taxable_amount DECIMAL(19,4) NOT NULL DEFAULT 0`
- `exempt_amount DECIMAL(19,4) NOT NULL DEFAULT 0`
- `zero_rated_amount DECIMAL(19,4) NOT NULL DEFAULT 0`
- `out_of_scope_amount DECIMAL(19,4) NOT NULL DEFAULT 0`

Column comments cite spec §8.11 and explain each bucket's meaning. RLS unchanged (table already tenant-isolated). No CHECK constraint added — the plan defers strict bucket-sum reconciliation until Phase 5 wires bucket classification; adding it now would either reject every legacy row (all four buckets are 0) or require a backfill we can't honestly perform.

A reconciliation check name `TAX_BASE_BUCKETS_SUM` is reserved in [`lib/constants/order-financial.ts`](../../../web-admin/lib/constants/order-financial.ts); the actual check function in `voucher-checks.ts` lands when Phase 5 begins emitting non-zero buckets.

---

## Files modified

### Prisma + types
- [`web-admin/prisma/schema.prisma`](../../../web-admin/prisma/schema.prisma) — added 4 fields on `org_orders_mst` directly below `taxable_amount`. `npx prisma generate` ran clean.
- [`web-admin/lib/types/order-financial.ts`](../../../web-admin/lib/types/order-financial.ts) — added new `OrderFinancialTaxBaseDecomposition` exported type; extended `CanonicalOrderFinancialSnapshot` with the four bucket fields.

### Constants
- [`web-admin/lib/constants/order-financial.ts`](../../../web-admin/lib/constants/order-financial.ts) — added `TAX_BASE_BUCKETS_SUM` to `RECONCILIATION_CHECK_NAMES` with a comment explaining the advisory-until-Phase-5 status.

### Write service
- [`web-admin/lib/services/order-financial-write.service.ts`](../../../web-admin/lib/services/order-financial-write.service.ts) — computes 4 bucket variables (all `0` today, with a comment marking Phase 5 as the activation point), adds them to `derivedTotals` (snapshot JSON), and writes them into `org_orders_mst` via the `update.data` block.

### Read path
- [`web-admin/lib/services/order-financial-summary.service.ts`](../../../web-admin/lib/services/order-financial-summary.service.ts) — `OrderFinancialSnapshot` interface extended; Prisma `select` updated; `effectiveSnapshot` input wired; snapshot return object includes the buckets.
- [`web-admin/lib/utils/order-financial-effective-snapshot.ts`](../../../web-admin/lib/utils/order-financial-effective-snapshot.ts) — input type extended; buckets pass through stored snapshot 1:1.
- [`web-admin/src/features/orders/model/order-financial-summary-view.ts`](../../../web-admin/src/features/orders/model/order-financial-summary-view.ts) — view-model `amounts` block now includes the four bucket fields.
- [`web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`](../../../web-admin/src/features/orders/lib/map-order-financial-summary-view.ts) — mapper reads buckets from snapshot and exposes them on the view model.

### i18n
- [`web-admin/messages/en.json`](../../../web-admin/messages/en.json) — added `OrderFinancial.taxBase.{title,taxable,nonTaxable,exempt,zeroRated,outOfScope}` block.
- [`web-admin/messages/ar.json`](../../../web-admin/messages/ar.json) — matching Arabic keys.
- `npm run check:i18n` passes.

### Tests
- [`web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts`](../../../web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts) — added a `tax-base decomposition (v1.1 §8.11)` describe block with two cases:
  - Buckets pass through from the canonical snapshot
  - All four default to zero when the snapshot omits them
- [`web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts`](../../../web-admin/__tests__/utils/order-financial-effective-snapshot.test.ts) — extended existing fixtures with the four bucket fields and added a dedicated "passes through tax-base decomposition buckets" test asserting all five buckets land on the output snapshot.

---

## Verification gates

| Gate | Status |
|---|---|
| Migration applied to DB | ✓ (user confirmed 2026-06-04) |
| `npx prisma generate` | ✓ clean |
| Target Jest suites (3 files, 22 tests) | ✓ 22/22 green |
| `npm run typecheck` | ✓ no errors |
| `npm run check:i18n` | ✓ EN/AR parity OK |
| `npm run build` | ✓ Compiled successfully in 28.3s; 218 static pages |

---

## Phase 5 handoff

When Phase 5 (tax-inclusive pricing + tax engine bucket classification) lands, the only place that needs to change to actually populate the buckets is the assignment block in `order-financial-write.service.ts`:

```ts
// Today:
const nonTaxableAmount = 0;
const exemptAmount = 0;
const zeroRatedAmount = 0;
const outOfScopeAmount = 0;

// Phase 5 will read these from the tax-engine result.
```

After that change, the strict bucket-sum CHECK and `RECON_TAX_BASE_BUCKETS_SUM` reconciliation check can be activated. Read path, snapshot JSON, types, view model, mapper, i18n, and UI surface all stay unchanged.

---

## Risk

Low. Schema change is additive (4 columns, default 0, no CHECK), code change writes zeros consistently with the historical baseline, read path passes through, mapper exposes the contract for the upcoming UI in Phase 8. Build + typecheck + tests all green.
