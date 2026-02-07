---
version: v1.0.0
last_updated: 2026-02-07
author: CleanMateX AI Assistant
---

# Changelog -- Inventory Stock Management

All notable changes to this feature are documented in this file.

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
