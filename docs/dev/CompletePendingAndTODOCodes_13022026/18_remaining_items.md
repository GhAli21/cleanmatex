# 18 - Remaining Items (Phase 8)

## Summary

Implementation of selected remaining TODOs across the codebase. Not all items were implemented (e.g. PieceHistory requires new table, payment-modal is legacy).

## Implemented

### 1. Tenant Registration Slug Check API

**Files:** `app/api/v1/tenants/check-slug/route.ts` (new), `app/register/tenant/page.tsx`

**Issue:** TODO: Implement actual slug check API — registration page simulated availability.

**Solution:** Created GET `/api/v1/tenants/check-slug?slug=xxx` that queries `org_tenants_mst` via admin client (public endpoint, no auth). Returns `{ available: boolean, slug }`. Registration page calls it on slug blur and validates before submit.

### 2. Customer Export Date Filtering

**Files:** `lib/services/customers.service.ts`, `app/api/v1/customers/export/route.ts`

**Issue:** TODO: Implement date filtering in searchCustomers — export filtered client-side.

**Solution:** Added `startDate` and `endDate` to `CustomerSearchParams`. `searchCustomers` applies `gte('created_at', startDate)` and `lte('created_at', endDate)` when provided. Export route passes `startDate`/`endDate` from query params. For date-only `endDate`, appends `T23:59:59.999Z` to include full day.

### 3. Price History Export

**Files:** `app/dashboard/catalog/pricing/[id]/components/price-history-timeline.tsx`

**Issue:** TODO: Implement export — Export CSV button did nothing.

**Solution:** Client-side CSV export from loaded `history` data. Builds CSV with headers (Date, Entity Type, Price List/Product, Old/New Price, Old/New Discount %, Reason, Changed By), triggers download as `price-history-YYYY-MM-DD.csv`.

## Not Implemented (Requires More Work)

**Implementation plans:** See [Plans_For_Remaining/](Plans_For_Remaining/README.md) for detailed plans per item.

| Item | File | Reason |
|------|------|--------|
| Piece history | PieceHistory.tsx | Needs `org_order_piece_history_tr` table |
| Payment modal promo/gift | ~~payment-modal-enhanced.tsx~~ | ✅ Done: legacy removed; PaymentModalEnhanced02 only |
| Assembly task modal | assembly-task-modal.tsx | Needs task details API |
| Workflow averageTimePerStage | workflow-service.ts | Needs status history aggregation |
| Logger remote logging | logger.ts | Requires external service (e.g. Sentry) |
| Usage tracking | usage-tracking.service.ts | Requires storage/metrics backend |
| Various dashboard widgets | PaymentMix, Turnaround, Issues, DriverUtilization, DeliveryRate, Alerts | Need real queries per widget |
| Settings pages | general, branding | Need API wiring |
| Users page | users/page.tsx | TODO: API call |

## Production Checklist

- [x] Tenant slug check uses admin client (safe for public read)
- [x] Customer export date filter is server-side
- [x] Price history export works with loaded data
- [ ] Rate-limit slug check if needed (public endpoint)
