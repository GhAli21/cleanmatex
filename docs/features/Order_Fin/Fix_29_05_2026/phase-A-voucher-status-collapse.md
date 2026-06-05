# Phase A — Voucher Status Triple-Column Collapse

**Date:** 2026-06-05  
**Migration:** `0342_voucher_status_collapse.sql`  
**Program:** Post-v1.1 Hardening

---

## Goal

Drop the legacy `status` column from `org_fin_vouchers_mst` and make `voucher_status` (the BVM canonical column) the single source of truth for voucher lifecycle state.

---

## Background

`org_fin_vouchers_mst` had three status-related columns:

| Column | Values | Role | Outcome |
|---|---|---|---|
| `status` | `draft/issued/voided` | Legacy pre-BVM | **DROPPED** |
| `voucher_status` | `DRAFT/POSTED/CANCELLED/REVERSED/PARTIALLY_REVERSED` | BVM canonical | **KEPT** |
| `posting_status` | `NOT_POSTED/POSTED/POSTING_FAILED` | GL state | **KEPT** |

Legacy mapping (applied in migration 0328): `draft`→`DRAFT`, `issued`→`POSTED`, `voided`→`CANCELLED`

---

## Files modified

| File | Change |
|---|---|
| `lib/constants/voucher.ts` | Deleted `VOUCHER_STATUS_LEGACY` + `VoucherStatusLegacy` type |
| `lib/types/voucher.ts` | Removed `VoucherStatusLegacy` import/re-export; removed `status: string` from `VoucherData` |
| `lib/services/voucher-service.ts` | Import fix + 13 legacy locations → canonical `voucher_status` |
| `lib/services/refund-voucher-service.ts` | Import fix + `status: ISSUED` → `voucher_status: POSTED` |
| `lib/services/voucher-biz.service.ts` | Removed legacy `status` sync writes (2 locations) |
| `lib/services/voucher-posting.service.ts` | Removed legacy `status` sync write (1 location) |
| `lib/services/voucher-reversal.service.ts` | Removed legacy `status` sync writes (2 locations) |
| `lib/services/voucher-wiring.service.ts` | Removed legacy `status` sync write (1 location) |
| `app/actions/payments/voucher-list-actions.ts` | Renamed `status` param → `voucher_status` |
| `src/features/billing/ui/vouchers-table.tsx` | Replaced `statusBadge()` with `<VoucherStatusBadge>` |
| `src/features/billing/ui/voucher-filters-bar.tsx` | Renamed URL param `status` → `voucher_status` |
| `src/features/billing/ui/billing-receipt-voucher-print-rprt.tsx` | Switched to `voucher_status` + `VoucherStatusBadge` |
| `src/features/orders/ui/orders-vouchers-tab-rprt.tsx` | Removed `?? voucher.status` fallback |
| `prisma/schema.prisma` | Removed `status` field + updated index to `voucher_status` |
| `__tests__/services/voucher-posting.test.ts` | Updated stale test asserting `posting_status` was NOT set |

---

## Migration (`0342_voucher_status_collapse.sql`)

```sql
BEGIN;
-- Safety guard: abort if any NULL voucher_status rows
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM org_fin_vouchers_mst WHERE voucher_status IS NULL LIMIT 1)
  THEN RAISE EXCEPTION 'Abort: NULL voucher_status rows found.'; END IF;
END $$;
ALTER TABLE org_fin_vouchers_mst DROP COLUMN IF EXISTS status RESTRICT;
ALTER TABLE org_fin_vouchers_mst ALTER COLUMN voucher_status SET NOT NULL;
COMMIT;
```

---

## Verification

- `npm run typecheck` — 0 errors ✓
- `npm run test -- --testPathPattern=voucher` — 60/60 ✓
- `npm run build` — green ✓
