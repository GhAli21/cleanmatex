---
version: v1.2.0
last_updated: 2026-02-18
author: CleanMateX AI Assistant
---

# Inventory Stock Management -- Developer Flow Diagrams

> **v1.2.0:** Quantity and stats use `org_inv_stock_by_branch` (branch-specific or aggregated). Adjust flow includes audit context and Zod validation. See [Branch-Wise Enhancement](./branch-wise-enhancement.md).

## Stock Adjustment Flow (v1.2.0)

```mermaid
sequenceDiagram
    participant UI as AdjustStockModal
    participant SA as adjustStockAction
    participant SVC as adjustStock()
    participant DB as Supabase / PostgreSQL

    UI->>UI: Zod validate (stockAdjustmentSchema)
    UI->>SA: { product_id, action, quantity, reason, branch_id }
    SA->>SA: getServerAuditContext() --> userId, userName, userAgent, userIp
    SA->>SVC: adjustStock(request + audit)
    SVC->>SVC: getTenantIdFromSession()
    alt branch_id set
        SVC->>DB: SELECT qty_on_hand FROM org_inv_stock_by_branch<br/>WHERE tenant_org_id, product_id, branch_id
        DB-->>SVC: qty_before (or 0 if no row)
    else branch_id null (legacy)
        SVC->>DB: SELECT qty_on_hand FROM org_product_data_mst
        DB-->>SVC: qty_before
    end
    SVC->>SVC: Compute qtyAfter (allow negative)
    SVC->>DB: INSERT org_inv_stock_tr<br/>(+ processed_by, created_by, created_info)
    SVC->>DB: UPSERT org_inv_stock_by_branch (or UPDATE org_product_data_mst)
    SVC-->>SA: StockTransaction
    SA-->>UI: { success: true }
    UI->>UI: onSuccess() --> refresh list
```

## Inventory Search Flow (v1.2.0)

```mermaid
sequenceDiagram
    participant UI as StockPage
    participant SA as searchInventoryItemsAction
    participant SVC as searchInventoryItems()
    participant DB as Supabase / PostgreSQL

    UI->>SA: { page, limit, search, stock_status, is_active, branch_id }
    SA->>SVC: searchInventoryItems(params)
    SVC->>DB: SELECT * FROM org_product_data_mst (retail items)
    DB-->>SVC: rows[]
    alt branch_id set
        SVC->>DB: SELECT product_id, qty_on_hand FROM org_inv_stock_by_branch<br/>WHERE branch_id = ?
    else branch_id empty (All Branches)
        SVC->>DB: SELECT product_id, qty_on_hand FROM org_inv_stock_by_branch<br/>SUM per product
    end
    SVC->>SVC: Build branchQtyMap; has_branch_record when branch set
    SVC->>SVC: Map to InventoryItemListItem; getStockStatus; stock_value
    SVC-->>SA: InventorySearchResponse
    SA-->>UI: { success: true, data: { items, total, page, ... } }
```

## Create Item Flow

```mermaid
sequenceDiagram
    participant UI as AddItemModal
    participant SA as createInventoryItemAction
    participant SVC as createInventoryItem()
    participant DB as Supabase / PostgreSQL

    UI->>SA: { product_name, product_unit, qty_on_hand, ... }
    SA->>SVC: createInventoryItem(request)
    SVC->>SVC: getTenantIdFromSession()
    SVC->>SVC: generateItemCode() --> INV-00001
    SVC->>DB: INSERT INTO org_product_data_mst<br/>(tenant_org_id, product_code, product_name,<br/>is_retail_item=true, qty_on_hand, ...)
    DB-->>SVC: InventoryItem
    SVC-->>SA: InventoryItem
    SA-->>UI: { success: true, data: InventoryItem }
    UI->>UI: onSuccess() --> refresh list
```

## Page Load Flow

```mermaid
flowchart TD
    A[StockPage mounts] --> B{currentTenant exists?}
    B -->|No| C[Set loading=false, return]
    B -->|Yes| D["Promise.all([searchItems, getStats])"]
    D --> E{Both succeed?}
    E -->|Yes| F[Set items, stats, pagination]
    E -->|No| G[Set error message]
    F --> H[Render StatsCards + FilterBar + Table + Pagination]
    H --> I{User interacts}
    I -->|Search/Filter| J[Update filter state, reset page to 1]
    I -->|Paginate| K[Update page number]
    I -->|Add Item| L[Show AddItemModal]
    I -->|Edit Item| M[Show EditItemModal]
    I -->|Adjust| N[Show AdjustStockModal]
    I -->|History| O[Show StockHistoryModal]
    J --> D
    K --> D
    L -->|onSuccess| D
    M -->|onSuccess| D
    N -->|onSuccess| D
```

## Stock Status Computation

```mermaid
flowchart TD
    A["getStockStatus(qtyOnHand, reorderPoint, maxStockLevel)"] --> B{qtyOnHand <= 0?}
    B -->|Yes| C["OUT_OF_STOCK"]
    B -->|No| D{qtyOnHand <= reorderPoint?}
    D -->|Yes| E["LOW_STOCK"]
    D -->|No| F{maxStockLevel set AND qtyOnHand > maxStockLevel?}
    F -->|Yes| G["OVERSTOCK"]
    F -->|No| H["IN_STOCK"]

    style C fill:#fee2e2,stroke:#dc2626
    style E fill:#fef3c7,stroke:#d97706
    style G fill:#dbeafe,stroke:#2563eb
    style H fill:#dcfce7,stroke:#16a34a
```
