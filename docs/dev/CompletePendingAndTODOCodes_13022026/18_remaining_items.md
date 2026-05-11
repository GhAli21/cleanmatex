# 18 - Remaining Items (Phase 8)

## Summary

Implementation of selected remaining TODOs across the codebase. Several deferred items from Phase 8 are now done (piece history, dashboard KPI widgets, settings users); see [Plans_For_Remaining/](Plans_For_Remaining/README.md).

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

### 4. Piece history, dashboard KPIs, settings users (2026-05-11)

**Piece history:** Table `org_order_piece_hist_tr` (migration `0259_org_order_piece_hist_tr.sql`), writes from `OrderPieceService`, UI `PieceHistory.tsx`, API `GET /api/v1/orders/pieces/[pieceId]/history` (`orders:read`).

**Dashboard widgets:** `dashboard.service.ts` `getKPIOverview` — PaymentMix, Turnaround, Issues, DriverUtilization, DeliveryRate, Alerts, Top Services. Definitions: [dashboard-kpi-definitions.md](../dashboard-kpi-definitions.md).

**Settings / Users:** `app/dashboard/settings/users/page.tsx` — `fetchUsers`, invite via `createUser`, activate/deactivate; password reset remains platform-dependent (`resetUserPassword` stub).

### 5. General & branding settings (2026-05-07)

Per [Plans_For_Remaining/08_settings_pages.md](Plans_For_Remaining/08_settings_pages.md): General and Branding pages wired to APIs.

## Not Implemented (Requires More Work)

**Implementation plans:** See [Plans_For_Remaining/](Plans_For_Remaining/README.md) for detailed plans per item.

| Item | File | Reason |
|------|------|--------|
| Payment modal promo/gift | ~~payment-modal-enhanced.tsx~~ | ✅ Done: legacy removed; PaymentModalEnhanced02 only |
| Assembly task modal | assembly-task-modal.tsx | Needs task details API |
| Workflow averageTimePerStage | workflow-service.ts | Needs status history aggregation |
| Logger remote logging | logger.ts | Requires external service (e.g. Sentry) |
| Usage tracking | usage-tracking.service.ts | Requires storage/metrics backend |

## Production Checklist

- [x] Tenant slug check uses admin client (safe for public read)
- [x] Customer export date filter is server-side
- [x] Price history export works with loaded data
- [ ] Rate-limit slug check if needed (public endpoint)
