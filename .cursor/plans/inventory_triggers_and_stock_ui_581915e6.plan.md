---
name: Inventory Triggers and Stock UI
overview: Add database triggers to enforce service_category_code/is_retail_item consistency on org_product_data_mst and sys_service_prod_templates_cd, and enhance the inventory stock page to default-filter retail items and expand the Add Item modal with all product fields.
todos: []
isProject: false
---

# Inventory Triggers and Stock Page Enhancement

## 1. Database Triggers

### Scope

- **org_product_data_mst** (tenant products)
- **sys_service_prod_templates_cd** (system templates)

Both tables have `service_category_code` and `is_retail_item` columns.

### Trigger Logic (BEFORE INSERT OR UPDATE)

Apply in order to avoid conflicts:

1. **Rule 2 first:** If `is_retail_item = true` then set `service_category_code = 'RETAIL_ITEMS'`
2. **Rule 1 second:** If `service_category_code = 'RETAIL_ITEMS'` then `is_retail_item = true`, else `is_retail_item = false`

This ensures:

- Setting `is_retail_item = true` alone will sync `service_category_code` to `RETAIL_ITEMS`
- Setting `service_category_code = 'RETAIL_ITEMS'` alone will sync `is_retail_item` to `true`
- Conflicts resolve with `service_category_code` taking precedence (Rule 1 runs last)

### Implementation

Create a new migration file: `supabase/migrations/0102_sync_retail_item_category_triggers.sql`

- Create a reusable function `sync_retail_item_category()` that applies the above logic on `NEW`
- Create triggers on both tables: `BEFORE INSERT OR UPDATE` for each row

**Reference:** [supabase/migrations/0101_inventory_stock_management.sql](supabase/migrations/0101_inventory_stock_management.sql) for migration structure; [supabase/migrations/0085_add_price_history_audit.sql](supabase/migrations/0085_add_price_history_audit.sql) for trigger pattern on org_product_data_mst.

---

## 2. Inventory Stock Page Enhancements

### 2.1 Default Filter: Retail Items Only

**Current behavior:** [web-admin/lib/services/inventory-service.ts](web-admin/lib/services/inventory-service.ts) filters by `is_retail_item = true` only.

**Change:** Add `service_category_code = 'RETAIL_ITEMS'` to the base query in `searchInventoryItems()` and `getInventoryStatistics()` for consistency. The triggers will keep these in sync, but this adds an extra filter for robustness.

**File:** [web-admin/lib/services/inventory-service.ts](web-admin/lib/services/inventory-service.ts)

- In `searchInventoryItems`: add `.eq('service_category_code', 'RETAIL_ITEMS')` to the base query (alongside existing `is_retail_item`)
- In `getInventoryStatistics`: add `.eq('service_category_code', 'RETAIL_ITEMS')` to the base query

### 2.2 Add Item Modal: All Fields + Defaults

**Current modal:** [web-admin/app/dashboard/inventory/stock/components/add-item-modal.tsx](web-admin/app/dashboard/inventory/stock/components/add-item-modal.tsx) shows: product_name, product_name2, product_unit, sku, qty_on_hand, reorder_point, product_cost, default_sell_price, storage_location.

**Required changes:**

- Default values: `service_category_code = 'RETAIL_ITEMS'`, `is_retail_item = true` (already set server-side in [inventory-service.ts](web-admin/lib/services/inventory-service.ts) create; no change needed for defaults)
- Show **all user-editable columns** from `org_product_data_mst` (excluding audit, tenant, and auto-generated fields)

**Full org_product_data_mst columns (user-editable):**

| Column                                         | Type    | Notes                                         |
| ---------------------------------------------- | ------- | --------------------------------------------- |
| product_code                                   | text    | Optional; auto-generated if empty             |
| product_name                                   | text    | Required                                      |
| product_name2                                  | text    | Arabic                                        |
| hint_text                                      | text    |                                               |
| service_category_code                          | text    | Default 'RETAIL_ITEMS', read-only in Add Item |
| is_retail_item                                 | bool    | Default true, read-only in Add Item           |
| product_group1, product_group2, product_group3 | text    |                                               |
| product_type                                   | integer |                                               |
| price_type                                     | text    |                                               |
| product_unit                                   | text    | Default 'piece'                               |
| default_sell_price                             | decimal |                                               |
| default_express_sell_price                     | decimal |                                               |
| product_cost                                   | decimal |                                               |
| min_sell_price                                 | decimal |                                               |
| min_quantity                                   | integer |                                               |
| pieces_per_product                             | integer |                                               |
| extra_days                                     | integer |                                               |
| turnaround_hh                                  | numeric |                                               |
| turnaround_hh_express                          | numeric |                                               |
| multiplier_express                             | numeric |                                               |
| product_order                                  | integer |                                               |
| is_tax_exempt                                  | integer |                                               |
| id_sku                                         | text    |                                               |
| product_color1, product_color2, product_color3 | text    |                                               |
| product_icon, product_image                    | text    |                                               |
| rec_order                                      | integer |                                               |
| rec_notes                                      | text    |                                               |
| qty_on_hand                                    | decimal | Inventory-specific                            |
| reorder_point                                  | decimal | Inventory-specific                            |
| min_stock_level, max_stock_level               | decimal | Inventory-specific                            |
| last_purchase_cost                             | decimal |                                               |
| storage_location                               | text    |                                               |
| is_active                                      | bool    | Default true                                  |

**Practical approach:** Group fields into logical sections (Core, Pricing, Inventory, Workflow, Metadata) and show the most relevant ones. Some columns (e.g. product_icon, product_image, product_color1-3) may be optional/collapsible. Prioritize:

- Core: product_code, product_name, product_name2, hint_text, product_unit, service_category_code (read-only), is_retail_item (read-only)
- Pricing: product_cost, default_sell_price, default_express_sell_price, min_sell_price
- Inventory: qty_on_hand, reorder_point, min_stock_level, max_stock_level, last_purchase_cost, storage_location
- Optional: product_group1-3, min_quantity, pieces_per_product, turnaround_hh, turnaround_hh_express, id_sku, is_active

**CreateInventoryItemRequest** in [web-admin/lib/types/inventory.ts](web-admin/lib/types/inventory.ts) and `createInventoryItem` in [inventory-service.ts](web-admin/lib/services/inventory-service.ts) must be extended to accept the additional fields.

---

## 3. Files to Modify

| File                                                                    | Changes                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `supabase/migrations/0102_sync_retail_item_category_triggers.sql`       | New migration: triggers on both tables                                                        |
| `web-admin/lib/services/inventory-service.ts`                           | Add service_category_code filter; extend createInventoryItem payload                          |
| `web-admin/lib/types/inventory.ts`                                      | Extend CreateInventoryItemRequest with all relevant fields                                    |
| `web-admin/app/dashboard/inventory/stock/components/add-item-modal.tsx` | Full form with all fields, defaults service_category_code='RETAIL_ITEMS', is_retail_item=true |
| `web-admin/messages/en.json`, `web-admin/messages/ar.json`              | Add translation keys for new labels if needed                                                 |

---

## 4. Trigger Implementation Detail

```sql
CREATE OR REPLACE FUNCTION sync_retail_item_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 2: is_retail_item=true -> service_category_code='RETAIL_ITEMS'
  IF NEW.is_retail_item = true THEN
    NEW.service_category_code := 'RETAIL_ITEMS';
  END IF;

  -- Rule 1: service_category_code drives is_retail_item
  IF NEW.service_category_code = 'RETAIL_ITEMS' THEN
    NEW.is_retail_item := true;
  ELSE
    NEW.is_retail_item := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Notes

- **Migration sequence:** Next migration after 0101 is 0102.
- **CLAUDE.md rule:** Do not apply migrations without user confirmation; create the migration file only.
- **RETAIL_ITEMS:** Ensure `RETAIL_ITEMS` exists in `sys_service_category_cd` (check seed data).
- **Edit modal:** Consider expanding [edit-item-modal.tsx](web-admin/app/dashboard/inventory/stock/components/edit-item-modal.tsx) in a follow-up for consistency; out of scope for this plan unless requested.
