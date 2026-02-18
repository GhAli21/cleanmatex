---
version: v1.2.0
last_updated: 2026-02-18
author: CleanMateX AI Assistant
---

# Changelog -- Inventory Stock Management

All notable changes to this feature are documented in this file.

## [v1.2.0] - 2026-02-18

### Added (Branch-Wise Enhancement)

- **Branch selector always visible** — Shown even for single-branch tenants; placed first in filter row
- **"All Branches" aggregate view** — When no branch selected, quantity and stats are summed from `org_inv_stock_by_branch` per product (no longer from legacy `org_product_data_mst.qty_on_hand`)
- **Negative stock support** — `NEGATIVE_STOCK` status; `adjustStock` allows negative quantities; badge and filter in UI
- **Stats card: Negative Stock count** — New `negativeStockCount` in `InventoryStatistics`; distinct card when > 0
- **Audit fields in adjustments** — `processed_by`, `created_by`, `created_info` populated from `getServerAuditContext()`; stored in `org_inv_stock_tr`
- **Zod validation in Adjust modal** — `lib/validations/inventory-schemas.ts` with `stockAdjustmentSchema`; inline errors from `safeParse`
- **Stock History modal enhancements** — Performed By, Reference, Source columns; link to order when `reference_type = 'ORDER'`; `aria-label`, `scope="col"`
- **Stats cards branch context** — Optional `branchName` prop; subtitle "at {branch}" or "All Branches"
- **sessionStorage branch persistence** — Last-selected branch (`inventory_stock_branch_id`) restored on page load for multi-branch tenants
- **No branches empty state** — Amber card when 0 branches; Add Item and Adjust disabled
- **"Never Stocked at Branch" indicator** — Dashed-underline tooltip on quantity 0 when product has no row in `org_inv_stock_by_branch`
- **Default branch selection** — Main branch or first branch auto-selected on load

### Changed

- **searchInventoryItems** — Always uses `org_inv_stock_by_branch` for quantity (branch-specific or aggregated)
- **getInventoryStatistics** — Same; adds `negativeStockCount`
- **adjustStock** — Accepts optional audit fields; no longer clamps negative `qty_after`
- **getStockStatus** — Returns `NEGATIVE_STOCK` when `qtyOnHand < 0`
- **InventoryItemListItem** — Added optional `has_branch_record`

### i18n

- `inventory.statuses.negativeStock`
- `inventory.stats.negativeStock`, `atBranch`, `allBranches`
- `inventory.labels.performedBy`, `reference`, `source`, `historyTable`
- `inventory.referenceTypes.order`, `manual`, `purchase`
- `inventory.messages.selectBranch`, `noBranchConfigured`, `notStockedAtBranch`

### Files Modified

- `web-admin/lib/services/inventory-service.ts`
- `web-admin/lib/constants/inventory.ts`
- `web-admin/lib/types/inventory.ts`
- `web-admin/lib/utils/request-audit.ts` (added `getServerAuditContext`)
- `web-admin/lib/validations/inventory-schemas.ts` (new)
- `web-admin/app/actions/inventory/inventory-actions.ts`
- `web-admin/app/dashboard/inventory/stock/page.tsx`
- `web-admin/app/dashboard/inventory/stock/components/stats-cards.tsx`
- `web-admin/app/dashboard/inventory/stock/components/adjust-stock-modal.tsx`
- `web-admin/app/dashboard/inventory/stock/components/stock-history-modal.tsx`
- `web-admin/messages/en.json`, `ar.json`

## [v1.0.0] - 2026-02-07

### Added

- Database migration `0101_inventory_stock_management.sql` with inventory columns on `org_product_data_mst` and new `org_inv_stock_tr` transaction table
- RLS policies for tenant isolation on `org_inv_stock_tr`
- Auto-update trigger for `updated_at` on `org_inv_stock_tr`
- Constants file (`lib/constants/inventory.ts`) with ITEM_CATEGORIES, UNITS_OF_MEASURE, TRANSACTION_TYPES, STOCK_STATUS, REFERENCE_TYPES, ADJUSTMENT_ACTIONS, and `getStockStatus()` helper
- Type definitions (`lib/types/inventory.ts`) for InventoryItem, InventoryItemListItem, CreateInventoryItemRequest, UpdateInventoryItemRequest, StockTransaction, StockAdjustmentRequest, search params/responses, and InventoryStatistics
- Service layer (`lib/services/inventory-service.ts`) with 8 functions: createInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryItemById, searchInventoryItems, adjustStock, searchStockTransactions, getInventoryStatistics
- 7 server actions (`app/actions/inventory/inventory-actions.ts`) wrapping the service layer
- Main stock listing page with search, filters, sorting, and pagination
- 4 KPI stats cards (Total Items, Low Stock, Out of Stock, Total Stock Value)
- Add Item modal with bilingual name fields (EN/AR)
- Edit Item modal with soft-delete capability
- Adjust Stock modal with increase/decrease/set actions and mandatory reason
- Stock History modal with paginated transaction log
- Full i18n support: English keys (`messages/en.json`) and Arabic keys (`messages/ar.json`) under `inventory.*`
- Added `common.active`, `common.inactive`, `common.saving`, `common.deleting` to shared i18n keys
- Auto-generated item codes (`INV-00001`) and transaction numbers (`STK-YYYYMMDD-0001`)
- Comprehensive feature documentation
