# Plan: Add Storage Location, SKU & Stock Fields to org_inv_stock_by_branch

**Version:** 1.0  
**Created:** 2026-02-19  
**Status:** Ready for Implementation

## Overview

Extend `org_inv_stock_by_branch` with branch-level stock-related fields (including SKU) and wire them through services, APIs, and frontend. When a branch is selected, branch-level values take precedence over product-level defaults.

### Current State

| Field                 | org_inv_stock_by_branch | org_product_data_mst | Used in list when branch set? |
|-----------------------|-------------------------|----------------------|-------------------------------|
| qty_on_hand           | ✅                       | ✅                   | ✅ from branch                 |
| reorder_point        | ✅                       | ✅                   | ❌ from product                |
| min_stock_level      | ✅                       | ✅                   | ❌ from product                |
| max_stock_level      | ✅                       | ✅                   | ❌ from product                |
| last_purchase_cost   | ✅                       | ✅                   | ❌ from product                |
| storage_location     | ✅                       | ✅                   | ❌ from product                |
| **id_sku**           | ❌ missing               | ✅                   | ❌ from product only           |

### Target State

- Add `id_sku` to `org_inv_stock_by_branch`.
- When `branch_id` is set: list, edit, and adjust use branch-level values (fallback to product).
- When "All Branches": continue using product-level values (no single branch).

---

## 1. Database Migration

**File:** `supabase/migrations/0110_add_id_sku_to_org_inv_stock_by_branch.sql`

```sql
-- Add id_sku (SKU) to org_inv_stock_by_branch
-- Allows branch-specific SKU override (nullable; falls back to product.id_sku)
ALTER TABLE org_inv_stock_by_branch
  ADD COLUMN IF NOT EXISTS id_sku TEXT;
COMMENT ON COLUMN org_inv_stock_by_branch.id_sku IS 'Branch-specific SKU; NULL = use product-level id_sku';
```

**Data migration (optional):** If desired, backfill existing branch rows from product:

```sql
UPDATE org_inv_stock_by_branch b
SET id_sku = p.id_sku
FROM org_product_data_mst p
WHERE b.product_id = p.id
  AND b.tenant_org_id = p.tenant_org_id
  AND b.id_sku IS NULL
  AND p.id_sku IS NOT NULL;
```

---

## 2. Types

**File:** `web-admin/lib/types/inventory.ts`

### 2.1 Branch stock record

```typescript
/** Branch-level stock record (org_inv_stock_by_branch row) */
export interface BranchStockRecord {
  tenant_org_id: string;
  product_id: string;
  branch_id: string;
  qty_on_hand: number;
  reorder_point: number;
  min_stock_level: number;
  max_stock_level: number | null;
  last_purchase_cost: number | null;
  storage_location: string | null;
  id_sku: string | null;
  created_at?: string;
  updated_at?: string;
}
```

### 2.2 InventoryItemListItem

Extend optional branch fields (for when branch is selected):

```typescript
export interface InventoryItemListItem {
  // ... existing ...
  id_sku: string | null;
  storage_location: string | null;
  reorder_point: number;
  max_stock_level: number | null;
  min_stock_level?: number;        // for branch-level editing
  last_purchase_cost?: number | null;  // for branch-level editing
  /** When branch_id set: true if product has row in org_inv_stock_by_branch */
  has_branch_record?: boolean;
}
```

### 2.3 UpdateBranchStockRequest

```typescript
export interface UpdateBranchStockRequest {
  product_id: string;
  branch_id: string;
  qty_on_hand?: number;
  reorder_point?: number;
  min_stock_level?: number;
  max_stock_level?: number | null;
  last_purchase_cost?: number | null;
  storage_location?: string | null;
  id_sku?: string | null;
}
```

---

## 3. Service Layer

**File:** `web-admin/lib/services/inventory-service.ts`

### 3.1 searchInventoryItems — branch-level field resolution

When `params.branch_id` is set:

1. Query `org_inv_stock_by_branch` for `product_id, qty_on_hand, reorder_point, min_stock_level, max_stock_level, last_purchase_cost, storage_location, id_sku`.
2. For each product:
   - If branch row exists: use branch values; fallback to product for nulls.
   - If no branch row: use product values.

When `params.branch_id` is empty ("All Branches"): keep current behavior (product-level).

**Logic sketch:**

```
if (params.branch_id) {
  branchData = select from org_inv_stock_by_branch where branch_id = ?
  for each product:
    row = branchData[product_id]
    reorder_point = row?.reorder_point ?? product.reorder_point
    storage_location = row?.storage_location ?? product.storage_location
    id_sku = row?.id_sku ?? product.id_sku
    // same for min_stock_level, max_stock_level, last_purchase_cost
} else {
  // All Branches: use product-level as today
}
```

### 3.2 New: updateBranchStock

```typescript
export async function updateBranchStock(request: UpdateBranchStockRequest): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (request.reorder_point !== undefined) updateData.reorder_point = request.reorder_point;
  if (request.min_stock_level !== undefined) updateData.min_stock_level = request.min_stock_level;
  if (request.max_stock_level !== undefined) updateData.max_stock_level = request.max_stock_level;
  if (request.last_purchase_cost !== undefined) updateData.last_purchase_cost = request.last_purchase_cost;
  if (request.storage_location !== undefined) updateData.storage_location = request.storage_location;
  if (request.id_sku !== undefined) updateData.id_sku = request.id_sku;

  const { error } = await supabase
    .from('org_inv_stock_by_branch')
    .update(updateData)
    .eq('tenant_org_id', tenantId)
    .eq('product_id', request.product_id)
    .eq('branch_id', request.branch_id);

  if (error) throw new Error('Failed to update branch stock');
}
```

Note: If no row exists, caller can upsert instead of update (e.g. via a dedicated `upsertBranchStock` that inserts when missing).

### 3.3 adjustStock — preserve branch-level fields on upsert

Today `adjustStock` upserts `org_inv_stock_by_branch` and overwrites all fields from `org_product_data_mst`. Change to:

- **Update `qty_on_hand` only** when row exists.
- **Insert new row** when missing: copy from product (reorder_point, min_stock_level, max_stock_level, last_purchase_cost, storage_location, id_sku).

Logic:

```typescript
if (branchRow exists) {
  upsert: { qty_on_hand: qtyAfter, updated_at }  // preserve branch overrides
} else {
  upsert: { qty_on_hand: qtyAfter, reorder_point, min_stock_level, max_stock_level, last_purchase_cost, storage_location, id_sku from product }
}
```

---

## 4. deduct_retail_stock_for_order

**File:** `supabase/migrations/0111_deduct_copy_branch_stock_fields.sql` (or combine with 0110)

When inserting new row into `org_inv_stock_by_branch`:

- Add `max_stock_level`, `storage_location`, `id_sku` from `org_product_data_mst` (with NULL/defaults if missing).

Current INSERT columns: `qty_on_hand, reorder_point, min_stock_level`.

Extended INSERT columns: `max_stock_level, last_purchase_cost, storage_location, id_sku`.

Use a subquery to pull these from product:

```sql
INSERT INTO org_inv_stock_by_branch (
  tenant_org_id, product_id, branch_id,
  qty_on_hand, reorder_point, min_stock_level, max_stock_level,
  last_purchase_cost, storage_location, id_sku
) 
SELECT 
  p_tenant_org_id, r.product_id, p_branch_id,
  0, COALESCE(p.reorder_point, 0), COALESCE(p.min_stock_level, 0), p.max_stock_level,
  p.last_purchase_cost, p.storage_location, p.id_sku
FROM org_product_data_mst p
WHERE p.id = r.product_id AND p.tenant_org_id = p_tenant_org_id
...
```

---

## 5. Server Actions

**File:** `web-admin/app/actions/inventory/inventory-actions.ts`

Add:

```typescript
export async function updateBranchStockAction(request: UpdateBranchStockRequest) {
  try {
    await updateBranchStock(request);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update branch stock';
    return { success: false, error: message };
  }
}
```

---

## 6. Frontend

### 6.1 Stock table (page.tsx)

When branch is selected, add columns:

- **Storage Location** (after Unit or before Status)
- **SKU** (after Item Code or Item Name)

Use existing i18n keys: `inventory.labels.storageLocation`, `inventory.labels.sku`.

Make columns conditionally visible: show Storage Location and SKU only when `branchId` is set (branch-level context). When "All Branches", optionally hide or show product-level values.

### 6.2 Edit Item flow

**Option A — Branch-scoped edit when branch selected**

- When `branchId` is set: Edit opens "Edit Branch Stock" or extends Edit modal to include branch fields (storage_location, id_sku, reorder_point, min_stock_level, max_stock_level, last_purchase_cost).
- Call `updateBranchStockAction` for branch fields.
- Product-level fields (name, unit, product_cost, default_sell_price) continue to use `updateInventoryItemAction`.

**Option B — Separate "Edit Branch Stock" action**

- Add "Edit Branch" (or similar) in the row actions when branch is selected.
- Opens modal with branch-only fields and calls `updateBranchStockAction`.

Recommendation: **Option A** — single Edit modal with branch section when branch is selected.

### 6.3 Adjust Stock modal

- No schema changes required.
- `adjustStock` will preserve branch-level fields after this enhancement.

### 6.4 Add Item modal

- When `branch_id` is provided, ensure `createInventoryItem` upsert to `org_inv_stock_by_branch` includes `id_sku` (after migration). Already includes `storage_location`, `reorder_point`, etc.

---

## 7. Validation

**File:** `web-admin/lib/validations/inventory-schemas.ts`

Add Zod schema for `UpdateBranchStockRequest` if needed (e.g. for API route or stricter validation).

---

## 8. File Checklist

| Layer        | File                                      | Action                                  |
|-------------|--------------------------------------------|-----------------------------------------|
| DB          | `0110_add_id_sku_to_org_inv_stock_by_branch.sql` | Create migration                        |
| DB          | `0111_deduct_copy_branch_stock_fields.sql` | Update deduct function INSERT           |
| Types       | `lib/types/inventory.ts`                  | Add BranchStockRecord, UpdateBranchStockRequest |
| Service     | `lib/services/inventory-service.ts`       | searchInventoryItems branch resolution; updateBranchStock; adjustStock preserve |
| Actions     | `app/actions/inventory/inventory-actions.ts` | Add updateBranchStockAction             |
| Page        | `app/dashboard/inventory/stock/page.tsx`   | Add Storage Location, SKU columns       |
| Edit Modal  | `edit-item-modal.tsx`                      | Add branch fields when branch selected  |
| Create      | `createInventoryItem`                      | Ensure id_sku in branch upsert (post-migration) |

---

## 9. i18n

Existing keys suffice:

- `inventory.labels.storageLocation`
- `inventory.labels.sku`

Add if missing:

- `inventory.actions.editBranchStock` — "Edit Branch Stock"

---

## 10. Testing Scenarios

1. **Branch selected, product has branch row:** List shows branch-level storage_location, id_sku, reorder_point.
2. **Branch selected, product has no branch row:** List shows product-level values; Edit creates/updates branch row.
3. **All Branches:** List shows product-level values; Edit updates product only.
4. **Adjust stock:** Branch-level fields remain after adjust; new branch row gets product defaults.
5. **Order deduction:** New branch row gets max_stock_level, storage_location, id_sku from product.

---

## 11. Migration Version

- Current last migration: `0109_enforce_branch_id_inv_stock_tr.sql`
- Use: `0110_*` for id_sku, `0111_*` for deduct enhancement (or merge into 0110)
