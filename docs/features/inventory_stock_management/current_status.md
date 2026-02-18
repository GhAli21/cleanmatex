---
version: v1.1.0
last_updated: 2026-02-19
author: CleanMateX AI Assistant
---

# Current Status -- Inventory Stock Management

## Implementation State: Complete (Phase 1 + Branch Enforcement)

All Phase 1 deliverables are implemented and functional. Branch enforcement has been added in v1.1.0.

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
- [x] **Branch enforcement on all stock transactions** (v1.1.0)
  - `org_inv_stock_tr.branch_id` is now NOT NULL (migration 0109)
  - `StockAdjustmentRequest.branch_id` is now required (TypeScript)
  - `adjustStock()` service throws if branch_id missing
  - Adjust modal shows read-only branch info when pre-selected
  - History modal shows Branch column for each transaction

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

1. **Stock status filtering is client-side:** When filtering by stock status (low_stock, out_of_stock, overstock), all matching rows are loaded first and filtered in memory. This works fine for typical inventory sizes (< 1000 items) but may need DB-level optimization for larger datasets.

2. **Non-atomic stock adjustments:** The `adjustStock` function performs two sequential Supabase calls (insert transaction, then upsert branch stock). If the second call fails, the transaction record exists but `qty_on_hand` is not updated. This should be addressed with a database function in a future iteration.

3. **No concurrent adjustment protection:** Two users adjusting stock simultaneously for the same item could see stale `qty_before` values. Optimistic locking or DB-level serialization should be considered for high-concurrency environments.

### Branch Enforcement Rules (v1.1.0)

- **All stock transactions require a branch_id** — this is enforced at 3 levels:
  1. **DB level**: `branch_id NOT NULL` on `org_inv_stock_tr`
  2. **Service level**: `adjustStock()` throws if `branch_id` is not provided
  3. **UI level**: Adjust modal requires branch selection; Submit button disabled without branch

- **Branch display in Adjust modal**:
  - When branch pre-selected on stock page: shown as read-only info box (blue card)
  - When "All Branches" selected: dropdown shown, selection required before submit

### Blockers

None.
