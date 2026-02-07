/**
 * Inventory Stock Management Service
 * CRUD operations for inventory items (org_product_data_mst with is_retail_item=true)
 * and stock transactions (org_inv_stock_tr)
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { getStockStatus, TRANSACTION_TYPES, ADJUSTMENT_ACTIONS } from '@/lib/constants/inventory';
import type {
  InventoryItem,
  InventoryItemListItem,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventorySearchParams,
  InventorySearchResponse,
  StockTransaction,
  StockAdjustmentRequest,
  StockTransactionSearchParams,
  StockTransactionSearchResponse,
  InventoryStatistics,
} from '@/lib/types/inventory';

// ==================================================================
// INVENTORY ITEMS (org_product_data_mst WHERE is_retail_item = true)
// ==================================================================

/**
 * Auto-generate item code: INV-00001, INV-00002, ...
 */
async function generateItemCode(): Promise<string> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data } = await supabase
    .from('org_product_data_mst')
    .select('product_code')
    .eq('tenant_org_id', tenantId)
    .eq('is_retail_item', true)
    .like('product_code', 'INV-%')
    .order('product_code', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (data?.product_code) {
    const match = data.product_code.match(/INV-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `INV-${String(nextNumber).padStart(5, '0')}`;
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  request: CreateInventoryItemRequest
): Promise<InventoryItem> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const productCode = request.product_code || (await generateItemCode());

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .insert({
      tenant_org_id: tenantId,
      product_code: productCode,
      product_name: request.product_name,
      product_name2: request.product_name2 || null,
      hint_text: request.hint_text || null,
      is_retail_item: true,
      item_type_code: request.item_type_code || 'RETAIL_GOODS',
      service_category_code: 'RETAIL_ITEMS',
      product_unit: request.product_unit || 'PC',
      product_cost: request.product_cost ?? 0,
      default_sell_price: request.default_sell_price ?? 0,
      id_sku: request.id_sku || null,
      qty_on_hand: request.qty_on_hand ?? 0,
      reorder_point: request.reorder_point ?? 0,
      min_stock_level: request.min_stock_level ?? 0,
      max_stock_level: request.max_stock_level ?? null,
      last_purchase_cost: request.last_purchase_cost ?? null,
      storage_location: request.storage_location || null,
      is_active: true,
      rec_status: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating inventory item:', error);
    if (error.code === '23505') {
      throw new Error('Item code already exists');
    }
    throw new Error('Failed to create inventory item');
  }

  return data as unknown as InventoryItem;
}

/**
 * Update an existing inventory item
 */
export async function updateInventoryItem(
  request: UpdateInventoryItemRequest
): Promise<InventoryItem> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (request.product_name !== undefined) updateData.product_name = request.product_name;
  if (request.product_name2 !== undefined) updateData.product_name2 = request.product_name2;
  if (request.hint_text !== undefined) updateData.hint_text = request.hint_text;
  if (request.item_type_code !== undefined) updateData.item_type_code = request.item_type_code;
  if (request.product_unit !== undefined) updateData.product_unit = request.product_unit;
  if (request.product_cost !== undefined) updateData.product_cost = request.product_cost;
  if (request.default_sell_price !== undefined) updateData.default_sell_price = request.default_sell_price;
  if (request.id_sku !== undefined) updateData.id_sku = request.id_sku;
  if (request.reorder_point !== undefined) updateData.reorder_point = request.reorder_point;
  if (request.min_stock_level !== undefined) updateData.min_stock_level = request.min_stock_level;
  if (request.max_stock_level !== undefined) updateData.max_stock_level = request.max_stock_level;
  if (request.last_purchase_cost !== undefined) updateData.last_purchase_cost = request.last_purchase_cost;
  if (request.storage_location !== undefined) updateData.storage_location = request.storage_location;
  if (request.is_active !== undefined) updateData.is_active = request.is_active;

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .update(updateData)
    .eq('tenant_org_id', tenantId)
    .eq('id', request.id)
    .eq('is_retail_item', true)
    .select()
    .single();

  if (error) {
    console.error('Error updating inventory item:', error);
    throw new Error('Failed to update inventory item');
  }

  return data as unknown as InventoryItem;
}

/**
 * Soft-delete an inventory item
 */
export async function deleteInventoryItem(id: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { error } = await supabase
    .from('org_product_data_mst')
    .update({ is_active: false, rec_status: 0, updated_at: new Date().toISOString() })
    .eq('tenant_org_id', tenantId)
    .eq('id', id)
    .eq('is_retail_item', true);

  if (error) {
    console.error('Error deleting inventory item:', error);
    throw new Error('Failed to delete inventory item');
  }
}

/**
 * Get single inventory item by ID
 */
export async function getInventoryItemById(id: string): Promise<InventoryItem> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('id', id)
    .eq('is_retail_item', true)
    .single();

  if (error) {
    console.error('Error fetching inventory item:', error);
    throw new Error('Inventory item not found');
  }

  return data as unknown as InventoryItem;
}

/**
 * Search inventory items with filters and pagination
 */
export async function searchInventoryItems(
  params: InventorySearchParams
): Promise<InventorySearchResponse> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  let query = supabase
    .from('org_product_data_mst')
    .select('*', { count: 'exact' })
    .eq('tenant_org_id', tenantId)
    .eq('is_retail_item', true);

  // Filter: active status
  if (params.is_active !== undefined) {
    query = query.eq('is_active', params.is_active);
  }

  // Filter: item type code
  if (params.item_type_code) {
    query = query.eq('item_type_code', params.item_type_code);
  }

  // Filter: search by code or name
  if (params.search) {
    query = query.or(
      `product_code.ilike.%${params.search}%,product_name.ilike.%${params.search}%,product_name2.ilike.%${params.search}%,id_sku.ilike.%${params.search}%`
    );
  }

  // Sorting
  const sortColumn = {
    code: 'product_code',
    name: 'product_name',
    quantity: 'qty_on_hand',
    value: 'product_cost',
    createdAt: 'created_at',
  }[params.sortBy || 'createdAt'] || 'created_at';

  query = query.order(sortColumn, { ascending: (params.sortOrder || 'desc') === 'asc' });

  // Pagination
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error searching inventory items:', error);
    throw new Error('Failed to search inventory items');
  }

  const total = count || 0;

  // Map to list items with computed fields
  const items: InventoryItemListItem[] = (data || []).map((row: Record<string, unknown>) => {
    const qtyOnHand = Number(row.qty_on_hand) || 0;
    const reorderPoint = Number(row.reorder_point) || 0;
    const maxStockLevel = row.max_stock_level != null ? Number(row.max_stock_level) : null;
    const productCost = Number(row.product_cost) || 0;

    return {
      id: row.id as string,
      product_code: row.product_code as string,
      product_name: row.product_name as string | null,
      product_name2: row.product_name2 as string | null,
      item_type_code: row.item_type_code as string | null,
      product_unit: row.product_unit as string | null,
      product_cost: productCost,
      default_sell_price: row.default_sell_price != null ? Number(row.default_sell_price) : null,
      id_sku: row.id_sku as string | null,
      qty_on_hand: qtyOnHand,
      reorder_point: reorderPoint,
      max_stock_level: maxStockLevel,
      storage_location: row.storage_location as string | null,
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      stock_status: getStockStatus(qtyOnHand, reorderPoint, maxStockLevel),
      stock_value: qtyOnHand * productCost,
    };
  });

  // Client-side filter for stock_status (computed field)
  let filteredItems = items;
  if (params.stock_status) {
    filteredItems = items.filter((item) => item.stock_status === params.stock_status);
  }

  return {
    items: filteredItems,
    total: params.stock_status ? filteredItems.length : total,
    page,
    limit,
    totalPages: Math.ceil((params.stock_status ? filteredItems.length : total) / limit),
  };
}

// ==================================================================
// STOCK TRANSACTIONS
// ==================================================================

/**
 * Generate transaction number: STK-20260207-0001
 */
async function generateTransactionNo(): Promise<string> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const { data } = await supabase
    .from('org_inv_stock_tr')
    .select('transaction_no')
    .eq('tenant_org_id', tenantId)
    .like('transaction_no', `STK-${today}-%`)
    .order('transaction_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  let seq = 1;
  if (data?.transaction_no) {
    const match = data.transaction_no.match(/STK-\d{8}-(\d+)/);
    if (match) {
      seq = parseInt(match[1], 10) + 1;
    }
  }

  return `STK-${today}-${String(seq).padStart(4, '0')}`;
}

/**
 * Adjust stock for an item (increase, decrease, or set)
 * Creates a transaction and updates qty_on_hand atomically
 */
export async function adjustStock(
  request: StockAdjustmentRequest
): Promise<StockTransaction> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Get current item
  const { data: item, error: itemError } = await supabase
    .from('org_product_data_mst')
    .select('id, qty_on_hand, product_cost')
    .eq('tenant_org_id', tenantId)
    .eq('id', request.product_id)
    .eq('is_retail_item', true)
    .single();

  if (itemError || !item) {
    throw new Error('Inventory item not found');
  }

  const qtyBefore = Number(item.qty_on_hand) || 0;
  let quantity: number;
  let qtyAfter: number;
  let transactionType: string;

  switch (request.action) {
    case ADJUSTMENT_ACTIONS.INCREASE:
      quantity = Math.abs(request.quantity);
      qtyAfter = qtyBefore + quantity;
      transactionType = TRANSACTION_TYPES.STOCK_IN;
      break;
    case ADJUSTMENT_ACTIONS.DECREASE:
      quantity = -Math.abs(request.quantity);
      qtyAfter = qtyBefore + quantity;
      if (qtyAfter < 0) qtyAfter = 0;
      transactionType = TRANSACTION_TYPES.STOCK_OUT;
      break;
    case ADJUSTMENT_ACTIONS.SET:
      quantity = request.quantity - qtyBefore;
      qtyAfter = request.quantity;
      transactionType = TRANSACTION_TYPES.ADJUSTMENT;
      break;
    default:
      throw new Error('Invalid adjustment action');
  }

  const transactionNo = await generateTransactionNo();
  const unitCost = request.unit_cost ?? Number(item.product_cost) ?? 0;

  // Create transaction
  const { data: transaction, error: txError } = await supabase
    .from('org_inv_stock_tr')
    .insert({
      tenant_org_id: tenantId,
      product_id: request.product_id,
      transaction_no: transactionNo,
      transaction_type: transactionType,
      quantity,
      unit_cost: unitCost,
      total_cost: Math.abs(quantity) * unitCost,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      reference_type: 'MANUAL',
      reason: request.reason,
      notes: request.notes || null,
      is_active: true,
      rec_status: 1,
    })
    .select()
    .single();

  if (txError) {
    console.error('Error creating stock transaction:', txError);
    throw new Error('Failed to create stock transaction');
  }

  // Update qty_on_hand on product
  const { error: updateError } = await supabase
    .from('org_product_data_mst')
    .update({
      qty_on_hand: qtyAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_org_id', tenantId)
    .eq('id', request.product_id);

  if (updateError) {
    console.error('Error updating qty_on_hand:', updateError);
    throw new Error('Failed to update stock quantity');
  }

  return transaction as unknown as StockTransaction;
}

/**
 * Search stock transactions for an item
 */
export async function searchStockTransactions(
  params: StockTransactionSearchParams
): Promise<StockTransactionSearchResponse> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  let query = supabase
    .from('org_inv_stock_tr')
    .select('*', { count: 'exact' })
    .eq('tenant_org_id', tenantId)
    .eq('product_id', params.product_id)
    .eq('is_active', true);

  if (params.transaction_type) {
    query = query.eq('transaction_type', params.transaction_type);
  }

  query = query.order('transaction_date', { ascending: false });

  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error searching stock transactions:', error);
    throw new Error('Failed to search stock transactions');
  }

  const total = count || 0;

  return {
    transactions: (data || []) as unknown as StockTransaction[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ==================================================================
// STATISTICS
// ==================================================================

/**
 * Get inventory statistics (totals, low stock, out of stock, value)
 */
export async function getInventoryStatistics(): Promise<InventoryStatistics> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .select('qty_on_hand, reorder_point, product_cost')
    .eq('tenant_org_id', tenantId)
    .eq('is_retail_item', true)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching inventory statistics:', error);
    throw new Error('Failed to fetch inventory statistics');
  }

  const items = data || [];
  let totalItems = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalStockValue = 0;

  for (const item of items) {
    totalItems++;
    const qty = Number(item.qty_on_hand) || 0;
    const reorder = Number(item.reorder_point) || 0;
    const cost = Number(item.product_cost) || 0;

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= reorder) {
      lowStockCount++;
    }

    totalStockValue += qty * cost;
  }

  return {
    totalItems,
    lowStockCount,
    outOfStockCount,
    totalStockValue,
  };
}
