/**
 * Inventory Stock Management Types
 * Types for inventory items (retail products) and stock transactions
 */

import type {
  ItemCategory,
  UnitOfMeasure,
  TransactionType,
  StockStatus,
  AdjustmentAction,
  ReferenceType,
} from '@/lib/constants/inventory';

// Re-export constants types for convenience
export type {
  ItemCategory,
  UnitOfMeasure,
  TransactionType,
  StockStatus,
  AdjustmentAction,
  ReferenceType,
};

// ==================================================================
// INVENTORY ITEM (from org_product_data_mst where is_retail_item=true)
// ==================================================================

/**
 * Inventory item — subset of Product with stock fields
 */
export interface InventoryItem {
  id: string;
  tenant_org_id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  hint_text: string | null;
  is_retail_item: boolean;
  item_type_code: string | null;
  service_category_code: string | null;
  product_unit: string | null;
  product_cost: number | null;
  default_sell_price: number | null;
  id_sku: string | null;
  // Inventory-specific columns
  qty_on_hand: number;
  reorder_point: number;
  min_stock_level: number;
  max_stock_level: number | null;
  last_purchase_cost: number | null;
  storage_location: string | null;
  // Standard fields
  is_active: boolean;
  rec_status: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

/**
 * Inventory item for list/table display with computed fields
 */
export interface InventoryItemListItem {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  item_type_code: string | null;
  product_unit: string | null;
  product_cost: number | null;
  default_sell_price: number | null;
  id_sku: string | null;
  qty_on_hand: number;
  reorder_point: number;
  max_stock_level: number | null;
  storage_location: string | null;
  is_active: boolean;
  created_at: string;
  // Computed
  stock_status: StockStatus;
  stock_value: number;
}

/**
 * Create inventory item request
 */
export interface CreateInventoryItemRequest {
  product_code?: string;
  product_name: string;
  product_name2?: string;
  hint_text?: string;
  item_type_code?: string;
  product_unit?: string;
  product_cost?: number;
  default_sell_price?: number;
  id_sku?: string;
  qty_on_hand?: number;
  reorder_point?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  last_purchase_cost?: number;
  storage_location?: string;
}

/**
 * Update inventory item request
 */
export interface UpdateInventoryItemRequest {
  id: string;
  product_name?: string;
  product_name2?: string;
  hint_text?: string;
  item_type_code?: string;
  product_unit?: string;
  product_cost?: number;
  default_sell_price?: number;
  id_sku?: string;
  reorder_point?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  last_purchase_cost?: number;
  storage_location?: string;
  is_active?: boolean;
}

// ==================================================================
// STOCK TRANSACTIONS (from org_inv_stock_tr)
// ==================================================================

/**
 * Stock transaction record
 */
export interface StockTransaction {
  id: string;
  tenant_org_id: string;
  product_id: string;
  transaction_no: string | null;
  transaction_date: string;
  transaction_type: TransactionType;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  qty_before: number | null;
  qty_after: number | null;
  reference_type: ReferenceType | null;
  reference_id: string | null;
  reference_no: string | null;
  reason: string | null;
  notes: string | null;
  processed_by: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

/**
 * Stock adjustment request (UI action)
 */
export interface StockAdjustmentRequest {
  product_id: string;
  action: AdjustmentAction;
  quantity: number;
  reason: string;
  notes?: string;
  unit_cost?: number;
}

// ==================================================================
// SEARCH / PAGINATION
// ==================================================================

export interface InventorySearchParams {
  page?: number;
  limit?: number;
  search?: string;
  item_type_code?: string;
  stock_status?: StockStatus;
  is_active?: boolean;
  sortBy?: 'code' | 'name' | 'quantity' | 'value' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface InventorySearchResponse {
  items: InventoryItemListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StockTransactionSearchParams {
  product_id: string;
  page?: number;
  limit?: number;
  transaction_type?: TransactionType;
}

export interface StockTransactionSearchResponse {
  transactions: StockTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================================================================
// STATISTICS
// ==================================================================

export interface InventoryStatistics {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValue: number;
}
