---
version: v1.2.0
last_updated: 2026-02-18
author: CleanMateX AI Assistant
---

# Inventory Branch-Wise Enhancement (v1.2.0)

## Overview

The Branch-Wise Enhancement makes branch-level quantity the primary view for inventory. All quantity and statistics are sourced from `org_inv_stock_by_branch`. "All Branches" shows the aggregated sum per product. Negative stock is allowed, and stock adjustments carry full audit context.

## Quantity Source

| branch_id | Quantity source |
|-----------|-----------------|
| Set (UUID) | `org_inv_stock_by_branch` for that branch |
| Empty ("All Branches") | Sum of `org_inv_stock_by_branch` per product |

## Data Flow

```
UI (Branch Selector) → branch_id
  ↓
searchInventoryItems(params) / getInventoryStatistics(params)
  ↓
  branch_id set  → SELECT from org_inv_stock_by_branch WHERE branch_id = ?
  branch_id empty → SELECT from org_inv_stock_by_branch; SUM(qty_on_hand) GROUP BY product_id
```

## Key Features

### 1. Branch Selector
- Always visible (even for single-branch tenants)
- First in filter row (primary filter)
- Label: "Branch"; options: "All Branches" + branch names
- Default: main branch or first; persisted in `sessionStorage` (`inventory_stock_branch_id`)

### 2. Negative Stock
- `NEGATIVE_STOCK` status when `qtyOnHand < 0`
- `adjustStock` allows negative `qty_after`
- Badge and filter in UI
- `negativeStockCount` in stats (distinct card when > 0)

### 3. Audit in Adjustments
- `processed_by`, `created_by`, `created_info` in `org_inv_stock_tr`
- Populated via `getServerAuditContext()` (userId, userName, userAgent, userIp)

### 4. Zod Validation (Adjust Modal)
- Schema: `lib/validations/inventory-schemas.ts`
- Validates: quantity, reason, adjustmentType
- Inline errors from `safeParse`

### 5. Stock History Modal
- Performed By (from `created_by` / `processed_by`)
- Reference (link to order when `reference_type = 'ORDER'`)
- Source (Order / Manual / Purchase)

### 6. "Never Stocked at Branch"
- When branch selected and product has no row in `org_inv_stock_by_branch`
- Quantity 0 shown with dashed underline; tooltip "Not stocked at this branch"

### 7. No Branches
- Empty state card: "No branch configured. Add a branch in Settings to manage inventory."
- Add Item and Adjust disabled

## File Reference

| File | Purpose |
|------|---------|
| `lib/services/inventory-service.ts` | Branch aggregation, negative stock, audit params |
| `lib/constants/inventory.ts` | `NEGATIVE_STOCK`, `getStockStatus` |
| `lib/types/inventory.ts` | `has_branch_record`, `negativeStockCount` |
| `lib/validations/inventory-schemas.ts` | Zod schema for adjust modal |
| `lib/utils/request-audit.ts` | `getServerAuditContext()` |
| `app/actions/inventory/inventory-actions.ts` | Pass audit to `adjustStock` |
| `app/dashboard/inventory/stock/page.tsx` | Branch selector, no-branches state, tooltip |
| `app/dashboard/inventory/stock/components/stats-cards.tsx` | `branchName`, Negative Stock card |
| `app/dashboard/inventory/stock/components/adjust-stock-modal.tsx` | Zod validation |
| `app/dashboard/inventory/stock/components/stock-history-modal.tsx` | Performed By, Reference, Source |

## i18n Keys Added

- `inventory.statuses.negativeStock`
- `inventory.stats.negativeStock`, `atBranch`, `allBranches`
- `inventory.labels.performedBy`, `reference`, `source`, `historyTable`
- `inventory.referenceTypes.order`, `manual`, `purchase`
- `inventory.messages.selectBranch`, `noBranchConfigured`, `notStockedAtBranch`

## Verification

After implementation:
- Run `npm run build`
- Run `npm run check:i18n`
- Test single-branch and multi-branch tenants
- Test "All Branches" aggregate vs branch-specific view
