---
name: Retail Order Inventory Integration
overview: "Implement full order-to-inventory integration: auto-deduct stock when retail items are sold, enforce order-type consistency (retail-only OR services-only), require immediate payment for retail orders, add branch-level stock tracking for multi-branch tenants, and apply best-practice safeguards."
todos: []
isProject: false
---

# Retail Order Inventory Integration Plan (Updated)

## Summary

Integrate order creation with inventory so that selling retail items automatically deducts stock, with validation and payment rules ensuring data integrity. Add branch-level stock tracking so inventory, history, and transactions can be filtered and managed per branch.

---

## 0. Branch-Level Stock Tracking (NEW)

### Goal

Enable tracking of inventory stock by branch so multi-branch tenants can see and manage stock per location.

### 0.1 Database Schema

**Migration:** `supabase/migrations/0103_inventory_branch_level_and_deduct.sql` (or split into 0103 + 0104)

**A. New table: org_inv_stock_by_branch**

- `tenant_org_id` UUID NOT NULL
- `product_id` UUID NOT NULL
- `branch_id` UUID NOT NULL
- `qty_on_hand` DECIMAL(19,4) DEFAULT 0
- `reorder_point` DECIMAL(19,4) DEFAULT 0
- `min_stock_level`, `max_stock_level`, `last_purchase_cost`, `storage_location`
- PK: (tenant_org_id, product_id, branch_id)
- FK: product_id → org_product_data_mst, branch_id → org_branches_mst

**B. org_inv_stock_tr - ADD branch_id**

- `branch_id` UUID NULL (nullable for backward compat)
- FK to org_branches_mst(id, tenant_org_id)
- Index: (tenant_org_id, branch_id, product_id, transaction_date DESC)

**C. org_product_data_mst**

- Keep qty_on_hand for backward compatibility (single-branch / legacy). For multi-branch, qty_on_hand can represent "default branch" or be deprecated in favor of org_inv_stock_by_branch.
- Migration: For existing retail items, migrate qty_on_hand to org_inv_stock_by_branch for the tenant's first/default branch.

### 0.2 Service & API Changes

- **inventory-service.ts:** All queries accept optional `branchId`. When provided: filter by branch_id; read qty from org_inv_stock_by_branch (or join). When null: use tenant-level (org_product_data_mst.qty_on_hand for single-branch).
- **InventorySearchParams:** Add `branch_id?: string`
- **Add/Edit/Adjust:** Require or default branch_id from current user context (e.g. user's assigned branch or branch selection).
- **Stock history:** Filter org_inv_stock_tr by branch_id when present.

### 0.3 UI Changes

- **Stock page:** Add branch selector (dropdown). When multi-branch, filter list by selected branch. Show "All branches" option to aggregate.
- **Stats cards:** Scope by branch when branch selected.
- **Add Item modal:** Default branch from context; allow override if multi-branch.
- **Adjust Stock / History:** Branch context passed through; transactions show branch.
- **Order creation:** Deduct from order.branch_id when branch_id is set.

### 0.4 Backward Compatibility

- Single-branch tenants: branch_id stays NULL or we auto-create org_inv_stock_by_branch rows for their default branch from org_product_data_mst.
- Existing org_inv_stock_tr rows: branch_id NULL is valid; new transactions should set branch_id.

---

## 1. Order Type Validation: Retail OR Services, Not Both

### Rule

A new order must contain **either** retail items **or** service items, never both.

### Implementation

**1.1 Client-side:** Block add when cart has opposite type; show alert.

**1.2 Server-side:** [web-admin/app/api/v1/orders/route.ts](web-admin/app/api/v1/orders/route.ts) – validate all items same type; return 400 if mixed.

**1.3 UX:** Add i18n keys for mixed-type validation messages.

---

## 2. Retail Order Payment: No Pay-on-Collection

### Rule

For retail-only orders, `PAY_ON_COLLECTION` is not allowed; payment must be recorded at POS.

### Implementation

**2.1 Payment modal:** Add `isRetailOnlyOrder` prop; hide/disable PAY_ON_COLLECTION; default to CASH.

**2.2 Submission hook:** Validate retail + PAY_ON_COLLECTION and abort before API call.

---

## 3. Stock Deduction on Order Creation

### 3.1 Database function

**Migration must include, before creating the function:**

```sql
DROP FUNCTION IF EXISTS deduct_retail_stock_for_order(UUID, UUID);
```

This drops the old 2-argument version before creating the new one (with or without `p_branch_id`), ensuring clean upgrades.

**Function:** `deduct_retail_stock_for_order(p_order_id, p_tenant_org_id, p_branch_id)`

- When branch_id provided: deduct from org_inv_stock_by_branch for that branch.
- When branch_id NULL: deduct from org_product_data_mst.qty_on_hand (legacy).
- Insert org_inv_stock_tr with branch_id.

### 3.2 Order service

- After order + items created, call deduction RPC with order.branch_id.
- Rollback order on insufficient stock error.

---

## 4. Order Cancellation / Stock Restore (Future)

- When order with retail items is cancelled, restore stock via `restore_stock_for_order` function.
- Document as follow-up.

---

## 5. Files to Modify / Create

| File                                                                       | Action                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `supabase/migrations/0103_inventory_branch_and_deduct.sql`                 | Create – org_inv_stock_by_branch, branch_id on org_inv_stock_tr, deduct function |
| `web-admin/lib/services/inventory-service.ts`                              | Modify – branch_id in params, use org_inv_stock_by_branch                        |
| `web-admin/lib/types/inventory.ts`                                         | Modify – add branch_id to params, types                                          |
| `web-admin/app/dashboard/inventory/stock/page.tsx`                         | Modify – branch selector                                                         |
| `web-admin/app/dashboard/inventory/stock/components/*`                     | Modify – pass branch_id to actions                                               |
| `web-admin/lib/services/order-service.ts`                                  | Modify – call stock deduction with branch_id                                     |
| `web-admin/app/api/v1/orders/route.ts`                                     | Modify – mixed retail/services validation                                        |
| `web-admin/app/dashboard/orders/new/components/payment-modal-enhanced.tsx` | Modify – disable PAY_ON_COLLECTION for retail                                    |
| `web-admin/src/features/orders/ui/new-order-modals.tsx`                    | Modify – pass isRetailOnlyOrder                                                  |
| `web-admin/src/features/orders/hooks/use-order-submission.ts`              | Modify – validate retail + PAY_ON_COLLECTION                                     |
| `web-admin/src/features/orders/hooks/use-new-order-state.ts`               | Modify – validate retail vs services on add                                      |
| `web-admin/messages/en.json`, `web-admin/messages/ar.json`                 | Add – validation messages                                                        |

---

## 6. Implementation Order

1. **DB migration** – org_inv_stock_by_branch, branch_id on org_inv_stock_tr, deduct function, data migration
2. **Inventory service** – branch_id support in all functions
3. **Inventory UI** – branch selector, filter by branch
4. **Products API** – ensure is_retail_item, service_category_code in response
5. **Client retail vs services validation**
6. **Server mixed validation**
7. **Payment modal** – PAY_ON_COLLECTION disabled for retail
8. **Order service** – stock deduction with branch_id
9. **i18n** – New messages
10. **Testing** – Retail order, branch-level stock, history
