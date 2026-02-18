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
// BRANCHES (for branch-level stock)
// ==================================================================

export interface BranchOption {
  id: string;
  name: string;
  name2: string | null;
  is_main: boolean | null;
}

/**
 * Get branches for current tenant (for branch selector)
 */
export async function getBranchesForCurrentTenant(): Promise<BranchOption[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const { data, error } = await supabase
    .from('org_branches_mst')
    .select('id, name, name2, branch_name, is_main')
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .order('is_main', { ascending: false, nullsFirst: false })
    .order('s_date', { ascending: true });
  if (error) {
    console.error('Error fetching branches:', error);
    return [];
  }
  return (data || []).map((b: { id: string; name?: string; name2?: string; branch_name?: string; is_main?: boolean }) => ({
    id: b.id,
    name: b.name || b.branch_name || 'Branch',
    name2: b.name2 ?? null,
    is_main: b.is_main ?? null,
  }));
}

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
    .eq('service_category_code', 'RETAIL_ITEMS')
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

  const insertData: Record<string, unknown> = {
    tenant_org_id: tenantId,
    product_code: productCode,
    product_name: request.product_name,
    product_name2: request.product_name2 || null,
    hint_text: request.hint_text || null,
    is_retail_item: true,
    item_type_code: request.item_type_code || 'RETAIL_GOODS',
    service_category_code: 'RETAIL_ITEMS',
    product_unit: request.product_unit || 'piece',
    product_cost: request.product_cost ?? 0,
    default_sell_price: request.default_sell_price ?? 0,
    id_sku: request.id_sku || null,
    qty_on_hand: request.qty_on_hand ?? 0,
    reorder_point: request.reorder_point ?? 0,
    min_stock_level: request.min_stock_level ?? 0,
    max_stock_level: request.max_stock_level ?? null,
    last_purchase_cost: request.last_purchase_cost ?? null,
    storage_location: request.storage_location || null,
    is_active: request.is_active ?? true,
    rec_status: 1,
  };

  if (request.default_express_sell_price !== undefined)
    insertData.default_express_sell_price = request.default_express_sell_price;
  if (request.min_sell_price !== undefined) insertData.min_sell_price = request.min_sell_price;
  if (request.product_group1 !== undefined) insertData.product_group1 = request.product_group1;
  if (request.product_group2 !== undefined) insertData.product_group2 = request.product_group2;
  if (request.product_group3 !== undefined) insertData.product_group3 = request.product_group3;
  if (request.product_type !== undefined) insertData.product_type = request.product_type;
  if (request.price_type !== undefined) insertData.price_type = request.price_type;
  if (request.min_quantity !== undefined) insertData.min_quantity = request.min_quantity;
  if (request.pieces_per_product !== undefined)
    insertData.pieces_per_product = request.pieces_per_product;
  if (request.extra_days !== undefined) insertData.extra_days = request.extra_days;
  if (request.turnaround_hh !== undefined) insertData.turnaround_hh = request.turnaround_hh;
  if (request.turnaround_hh_express !== undefined)
    insertData.turnaround_hh_express = request.turnaround_hh_express;
  if (request.multiplier_express !== undefined)
    insertData.multiplier_express = request.multiplier_express;
  if (request.product_order !== undefined) insertData.product_order = request.product_order;
  if (request.is_tax_exempt !== undefined) insertData.is_tax_exempt = request.is_tax_exempt;
  if (request.product_color1 !== undefined) insertData.product_color1 = request.product_color1;
  if (request.product_color2 !== undefined) insertData.product_color2 = request.product_color2;
  if (request.product_color3 !== undefined) insertData.product_color3 = request.product_color3;
  if (request.product_icon !== undefined) insertData.product_icon = request.product_icon;
  if (request.product_image !== undefined) insertData.product_image = request.product_image;
  if (request.rec_order !== undefined) insertData.rec_order = request.rec_order;
  if (request.rec_notes !== undefined) insertData.rec_notes = request.rec_notes;

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating inventory item:', error);
    if (error.code === '23505') {
      throw new Error('Item code already exists');
    }
    throw new Error('Failed to create inventory item');
  }

  // When branch_id provided, seed org_inv_stock_by_branch
  if (request.branch_id && data) {
    const qty = request.qty_on_hand ?? 0;
    await supabase.from('org_inv_stock_by_branch').upsert(
      {
        tenant_org_id: tenantId,
        product_id: data.id,
        branch_id: request.branch_id,
        qty_on_hand: qty,
        reorder_point: request.reorder_point ?? 0,
        min_stock_level: request.min_stock_level ?? 0,
        max_stock_level: request.max_stock_level ?? null,
        last_purchase_cost: request.last_purchase_cost ?? null,
        storage_location: request.storage_location ?? null,
      },
      { onConflict: 'tenant_org_id,product_id,branch_id' }
    );
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
  if (request.default_express_sell_price !== undefined)
    updateData.default_express_sell_price = request.default_express_sell_price;
  if (request.min_sell_price !== undefined) updateData.min_sell_price = request.min_sell_price;
  if (request.id_sku !== undefined) updateData.id_sku = request.id_sku;
  if (request.reorder_point !== undefined) updateData.reorder_point = request.reorder_point;
  if (request.min_stock_level !== undefined) updateData.min_stock_level = request.min_stock_level;
  if (request.max_stock_level !== undefined) updateData.max_stock_level = request.max_stock_level;
  if (request.last_purchase_cost !== undefined) updateData.last_purchase_cost = request.last_purchase_cost;
  if (request.storage_location !== undefined) updateData.storage_location = request.storage_location;
  if (request.is_active !== undefined) updateData.is_active = request.is_active;
  if (request.product_group1 !== undefined) updateData.product_group1 = request.product_group1;
  if (request.product_group2 !== undefined) updateData.product_group2 = request.product_group2;
  if (request.product_group3 !== undefined) updateData.product_group3 = request.product_group3;
  if (request.product_type !== undefined) updateData.product_type = request.product_type;
  if (request.price_type !== undefined) updateData.price_type = request.price_type;
  if (request.min_quantity !== undefined) updateData.min_quantity = request.min_quantity;
  if (request.pieces_per_product !== undefined) updateData.pieces_per_product = request.pieces_per_product;
  if (request.extra_days !== undefined) updateData.extra_days = request.extra_days;
  if (request.turnaround_hh !== undefined) updateData.turnaround_hh = request.turnaround_hh;
  if (request.turnaround_hh_express !== undefined)
    updateData.turnaround_hh_express = request.turnaround_hh_express;
  if (request.multiplier_express !== undefined)
    updateData.multiplier_express = request.multiplier_express;
  if (request.product_order !== undefined) updateData.product_order = request.product_order;
  if (request.is_tax_exempt !== undefined) updateData.is_tax_exempt = request.is_tax_exempt;
  if (request.product_color1 !== undefined) updateData.product_color1 = request.product_color1;
  if (request.product_color2 !== undefined) updateData.product_color2 = request.product_color2;
  if (request.product_color3 !== undefined) updateData.product_color3 = request.product_color3;
  if (request.product_icon !== undefined) updateData.product_icon = request.product_icon;
  if (request.product_image !== undefined) updateData.product_image = request.product_image;
  if (request.rec_order !== undefined) updateData.rec_order = request.rec_order;
  if (request.rec_notes !== undefined) updateData.rec_notes = request.rec_notes;

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .update(updateData)
    .eq('tenant_org_id', tenantId)
    .eq('id', request.id)
    .eq('service_category_code', 'RETAIL_ITEMS')
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
    .eq('service_category_code', 'RETAIL_ITEMS')
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
    .eq('service_category_code', 'RETAIL_ITEMS')
    .eq('is_retail_item', true)
    .single();

  if (error) {
    console.error('Error fetching inventory item:', error);
    throw new Error('Inventory item not found');
  }

  return data as unknown as InventoryItem;
}

/**
 * Search inventory items with filters and pagination.
 * When branch_id set: qty from org_inv_stock_by_branch for that branch.
 * When branch_id empty ("All Branches"): aggregate sum from org_inv_stock_by_branch per product.
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
    .eq('service_category_code', 'RETAIL_ITEMS')
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
  const productIds = (data || []).map((r: Record<string, unknown>) => r.id as string);

  // Build branchQtyMap: single branch or aggregated across all branches
  let branchQtyMap: Record<string, number> = {};
  if (productIds.length > 0) {
    if (params.branch_id) {
      const { data: branchData } = await supabase
        .from('org_inv_stock_by_branch')
        .select('product_id, qty_on_hand')
        .eq('tenant_org_id', tenantId)
        .eq('branch_id', params.branch_id)
        .in('product_id', productIds);
      branchQtyMap = (branchData || []).reduce(
        (acc, row) => {
          acc[row.product_id] = Number(row.qty_on_hand) || 0;
          return acc;
        },
        {} as Record<string, number>
      );
    } else {
      // All Branches: aggregate sum per product
      const { data: branchData } = await supabase
        .from('org_inv_stock_by_branch')
        .select('product_id, qty_on_hand')
        .eq('tenant_org_id', tenantId)
        .in('product_id', productIds);
      branchQtyMap = (branchData || []).reduce(
        (acc, row) => {
          const id = row.product_id;
          acc[id] = (acc[id] ?? 0) + (Number(row.qty_on_hand) || 0);
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  // Map to list items with computed fields
  const items: InventoryItemListItem[] = (data || []).map((row: Record<string, unknown>) => {
    const productId = row.id as string;
    const qtyOnHand = branchQtyMap[productId] ?? 0;
    const reorderPoint = Number(row.reorder_point) || 0;
    const maxStockLevel = row.max_stock_level != null ? Number(row.max_stock_level) : null;
    const productCost = Number(row.product_cost) || 0;
    const hasBranchRecord =
      params.branch_id !== undefined && params.branch_id !== null && params.branch_id !== ''
        ? productId in branchQtyMap
        : undefined;

    return {
      id: productId,
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
      has_branch_record: hasBranchRecord,
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
 * Creates a transaction and updates qty_on_hand atomically.
 * When branch_id provided: updates org_inv_stock_by_branch. When null: updates org_product_data_mst.qty_on_hand (legacy).
 */
export async function adjustStock(
  request: StockAdjustmentRequest
): Promise<StockTransaction> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Get current item for product_cost and branch upsert fields
  const { data: item, error: itemError } = await supabase
    .from('org_product_data_mst')
    .select('id, qty_on_hand, product_cost, reorder_point, min_stock_level, max_stock_level, last_purchase_cost, storage_location')
    .eq('tenant_org_id', tenantId)
    .eq('id', request.product_id)
    .eq('service_category_code', 'RETAIL_ITEMS')
    .eq('is_retail_item', true)
    .single();

  if (itemError || !item) {
    throw new Error('Inventory item not found');
  }

  let qtyBefore: number;
  if (request.branch_id) {
    const { data: branchRow } = await supabase
      .from('org_inv_stock_by_branch')
      .select('qty_on_hand')
      .eq('tenant_org_id', tenantId)
      .eq('product_id', request.product_id)
      .eq('branch_id', request.branch_id)
      .maybeSingle();
    qtyBefore = branchRow ? Number(branchRow.qty_on_hand) || 0 : 0;
  } else {
    qtyBefore = Number(item.qty_on_hand) || 0;
  }
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

  const insertPayload: Record<string, unknown> = {
    tenant_org_id: tenantId,
    product_id: request.product_id,
    branch_id: request.branch_id || null,
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
  };
  if (request.processed_by != null) insertPayload.processed_by = request.processed_by;
  if (request.created_by != null) insertPayload.created_by = request.created_by;
  if (request.created_info != null) insertPayload.created_info = request.created_info;

  const { data: transaction, error: txError } = await supabase
    .from('org_inv_stock_tr')
    .insert(insertPayload)
    .select()
    .single();

  if (txError) {
    console.error('Error creating stock transaction:', txError);
    throw new Error('Failed to create stock transaction');
  }

  // Update qty: branch-level or org_product_data_mst
  if (request.branch_id) {
    const { error: upsertError } = await supabase
      .from('org_inv_stock_by_branch')
      .upsert(
        {
          tenant_org_id: tenantId,
          product_id: request.product_id,
          branch_id: request.branch_id,
          qty_on_hand: qtyAfter,
          reorder_point: item.reorder_point ?? 0,
          min_stock_level: item.min_stock_level ?? 0,
          max_stock_level: item.max_stock_level ?? null,
          last_purchase_cost: item.last_purchase_cost ?? null,
          storage_location: item.storage_location ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_org_id,product_id,branch_id',
          ignoreDuplicates: false,
        }
      );
    if (upsertError) {
      console.error('Error updating branch stock:', upsertError);
      throw new Error('Failed to update stock quantity');
    }
  } else {
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
  if (params.branch_id) {
    query = query.eq('branch_id', params.branch_id);
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
 * Get inventory statistics (totals, low stock, out of stock, value).
 * When branch_id set: stats from org_inv_stock_by_branch for that branch.
 * When branch_id empty ("All Branches"): aggregate sum from org_inv_stock_by_branch per product.
 */
export async function getInventoryStatistics(params?: {
  branch_id?: string;
}): Promise<InventoryStatistics> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data: products } = await supabase
    .from('org_product_data_mst')
    .select('id, product_cost, reorder_point, max_stock_level')
    .eq('tenant_org_id', tenantId)
    .eq('service_category_code', 'RETAIL_ITEMS')
    .eq('is_retail_item', true)
    .eq('is_active', true);

  const productIds = (products || []).map((p) => p.id);
  let qtyMap: Record<string, number> = {};

  if (productIds.length > 0) {
    let branchQuery = supabase
      .from('org_inv_stock_by_branch')
      .select('product_id, qty_on_hand')
      .eq('tenant_org_id', tenantId)
      .in('product_id', productIds);

    if (params?.branch_id) {
      branchQuery = branchQuery.eq('branch_id', params.branch_id);
    }

    const { data: branchData } = await branchQuery;

    if (params?.branch_id) {
      qtyMap = (branchData || []).reduce(
        (acc, row) => {
          acc[row.product_id] = Number(row.qty_on_hand) || 0;
          return acc;
        },
        {} as Record<string, number>
      );
    } else {
      qtyMap = (branchData || []).reduce(
        (acc, row) => {
          const id = row.product_id;
          acc[id] = (acc[id] ?? 0) + (Number(row.qty_on_hand) || 0);
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  let totalItems = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let negativeStockCount = 0;
  let totalStockValue = 0;

  for (const prod of products || []) {
    const qty = qtyMap[prod.id] ?? 0;
    const reorder = Number(prod.reorder_point) || 0;
    const cost = Number(prod.product_cost) || 0;
    totalItems++;
    if (qty < 0) negativeStockCount++;
    else if (qty <= 0) outOfStockCount++;
    else if (qty <= reorder) lowStockCount++;
    totalStockValue += qty * cost;
  }

  return {
    totalItems,
    lowStockCount,
    outOfStockCount,
    negativeStockCount,
    totalStockValue,
  };
}
