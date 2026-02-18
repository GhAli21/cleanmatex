---
version: v1.2.0
last_updated: 2026-02-18
author: CleanMateX AI Assistant
---

# Current Status -- Inventory Stock Management

## Implementation State: Complete (Phase 1 + Branch-Wise Enhancement v1.2.0)

All Phase 1 deliverables are implemented and functional. Branch-wise quantity, negative stock, and audit enhancements are complete in v1.2.0.

### Completed

- [x] Database schema (migration applied)
- [x] RLS policies for tenant isolation
- [x] Constants, types, and service layer
- [x] Server actions (7 total)
- [x] Stock listing page with search, filters, pagination
- [x] KPI stats cards
- [x] Add / Edit / Delete item flows
- [x] Stock adjustment flow (increase, decrease, set)
- [x] Transaction history view with branch column
- [x] i18n support (EN + AR)
- [x] Feature documentation
- [x] **Branch-wise quantity everywhere** (v1.2.0)
  - Branch selector always visible; first in filter row
  - When branch selected: quantity from `org_inv_stock_by_branch` for that branch
  - When "All Branches": aggregated sum per product from `org_inv_stock_by_branch`
  - Default branch: main or first; sessionStorage persistence for last selection
  - No-branches empty state with disabled Add/Adjust
- [x] **Negative stock support**
  - `NEGATIVE_STOCK` status and badge; negative quantities allowed in `adjustStock`
  - `negativeStockCount` in stats
- [x] **Audit in adjustments**
  - `processed_by`, `created_by`, `created_info` in `org_inv_stock_tr` via `getServerAuditContext()`
- [x] **Zod validation in Adjust modal**
- [x] **Stock History modal** — Performed By, Reference, Source columns; order link
- [x] **"Never Stocked at Branch"** tooltip when qty 0 and no branch row

### Pending (Future Phases)

- [ ] Automated unit and integration tests
- [ ] Machine management (Phase 2)
- [ ] Supplier management (Phase 2)
- [ ] Purchase orders (Phase 3)
- [ ] Usage-per-order allocation (Phase 3)
- [ ] Batch/lot tracking (Phase 4)
- [ ] Barcode scanning (Phase 4)
- [ ] Atomic DB transaction for stock adjustments (DB function)

### Known Limitations

1. **Stock status filtering is client-side:** When filtering by stock status (low_stock, out_of_stock, overstock, negative_stock), all matching rows are loaded first and filtered in memory. This works fine for typical inventory sizes (< 1000 items) but may need DB-level optimization for larger datasets.

2. **Non-atomic stock adjustments:** The `adjustStock` function performs two sequential Supabase calls (insert transaction, then upsert branch stock). If the second call fails, the transaction record exists but `qty_on_hand` is not updated. This should be addressed with a database function in a future iteration.

3. **No concurrent adjustment protection:** Two users adjusting stock simultaneously for the same item could see stale `qty_before` values. Optimistic locking or DB-level serialization should be considered for high-concurrency environments.

### Branch-Wise Rules (v1.2.0)

| branch_id      | Quantity source                                                                 |
|----------------|----------------------------------------------------------------------------------|
| Set (UUID)     | `org_inv_stock_by_branch` for that branch                                       |
| Empty          | Sum of `org_inv_stock_by_branch` per product across all branches ("All Branches")|

- **Adjust**: Uses selected branch when available; disabled when no branches configured.
- **Add Item**: Disabled when no branches.

### Blockers

None.
