/**
 * PRD-007: Catalog Service Management
 * Core business logic for catalog, products, and pricing management
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import type {
  ServiceCategory,
  EnabledCategory,
  EnableCategoriesRequest,
  Product,
  ProductListItem,
  ProductCreateRequest,
  ProductUpdateRequest,
  ProductSearchParams,
  ProductSearchResponse,
  PriceList,
  PriceListItem,
  PriceListWithItems,
  PriceListCreateRequest,
  PriceListUpdateRequest,
  BulkImportResult,
  ValidationError,
  CSVTemplate,
  ProductStatistics,
} from '@/lib/types/catalog';

// Note: Using centralized getTenantIdFromSession from @/lib/db/tenant-context

// ==================================================================
// SERVICE CATEGORIES
// ==================================================================

/**
 * Get all available service categories (global)
 */
export async function getServiceCategories(): Promise<ServiceCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sys_service_category_cd')
    .select('*')
    .eq('is_active', true)
    .order('rec_order');

  if (error) {
    console.error('Error fetching service categories:', error);
    throw new Error('Failed to fetch service categories');
  }

  return data as ServiceCategory[];
}

/**
 * Get enabled categories for current tenant
 * Falls back to all global categories if no categories are enabled for the tenant
 */
export async function getEnabledCategories(): Promise<EnabledCategory[]> {
  const startTime = Date.now();
  const supabase = await createClient();

  try {
    const tenantId = await getTenantIdFromSession();

    // Try simpler query first - just get enabled category codes
    // Use a reasonable timeout (30 seconds) to prevent hanging
    const timeoutMs = 30000; // 30 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout after 30 seconds')), timeoutMs);
    });

    let enabledCodes: string[] = [];
    try {
      const queryPromise = supabase
        .from('org_service_category_cf')
        .select('service_category_code')
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true);

      // Race the query against timeout
      const queryResult = await Promise.race([queryPromise, timeoutPromise]);
      const { data: enabledData, error: simpleError } = queryResult;

      if (!simpleError && enabledData && enabledData.length > 0) {
        enabledCodes = enabledData.map((item: any) => item.service_category_code);
      }
    } catch (simpleQueryError: any) {
      console.warn('Simple query failed or timed out, trying fallback:', simpleQueryError.message);
      // If timeout or error, continue to fallback
    }

    // If we have enabled codes, fetch the full category data
    if (enabledCodes.length > 0) {
      try {
        // Use type assertion to avoid TypeScript deep type instantiation issue
        const categoriesQuery = (supabase
          .from('sys_service_category_cd') as any)
          .select('*')
          .in('service_category_code', enabledCodes)
          .eq('is_active', true)
          .order('rec_order');

        const categoriesResult = await categoriesQuery;
        const { data: categoriesData, error: categoriesError } = categoriesResult;

        if (!categoriesError && categoriesData) {
          const transformed = categoriesData.map((cat: any) => ({
            ...cat,
            tenant_org_id: tenantId,
          })) as EnabledCategory[];

          const duration = Date.now() - startTime;
          console.log(`[Catalog Service] getEnabledCategories completed in ${duration}ms (${transformed.length} categories)`);
          return transformed;
        }
      } catch (categoriesError: any) {
        console.warn('Categories query failed, falling back to global:', categoriesError);
      }
    }

    // Fall through to global categories if enabled categories query fails or returns empty
    console.warn('No enabled categories found or query failed, falling back to global categories');
    const globalCategories = await getServiceCategories();
    return globalCategories.map((cat) => ({
      ...cat,
      tenant_org_id: tenantId,
    })) as EnabledCategory[];
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Catalog Service] getEnabledCategories failed after ${duration}ms:`, error);

    // On timeout or any error, fall back to global categories
    try {
      const tenantId = await getTenantIdFromSession();
      const globalCategories = await getServiceCategories();
      return globalCategories.map((cat) => ({
        ...cat,
        tenant_org_id: tenantId,
      })) as EnabledCategory[];
    } catch (fallbackError) {
      console.error('Fallback to global categories also failed:', fallbackError);
      throw new Error('Failed to fetch categories');
    }
  }
}

/**
 * Enable categories for tenant
 */
export async function enableCategories(
  request: EnableCategoriesRequest
): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // First, delete existing enabled categories
  const { error: deleteError } = await supabase
    .from('org_service_category_cf')
    .delete()
    .eq('tenant_org_id', tenantId);

  if (deleteError) {
    console.error('Error deleting existing categories:', deleteError);
    throw new Error('Failed to reset categories');
  }

  // Insert new enabled categories
  const categoriesToEnable = request.categoryCodes.map((code) => ({
    tenant_org_id: tenantId,
    service_category_code: code,
  }));

  const { error: insertError } = await supabase
    .from('org_service_category_cf')
    .insert(categoriesToEnable);

  if (insertError) {
    console.error('Error enabling categories:', insertError);
    throw new Error('Failed to enable categories');
  }
}

// ==================================================================
// PRODUCTS
// ==================================================================

/**
 * Generate product code (if not provided)
 */
async function generateProductCode(): Promise<string> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Get the highest product code for this tenant
  const { data, error } = await supabase
    .from('org_product_data_mst')
    .select('product_code')
    .eq('tenant_org_id', tenantId)
    .order('product_code', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error generating product code:', error);
    throw new Error('Failed to generate product code');
  }

  // Parse the last product code and increment
  let nextNumber = 1;
  if (data?.product_code) {
    const match = data.product_code.match(/\d+/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  return `PROD-${String(nextNumber).padStart(5, '0')}`;
}

/**
 * Create a new product
 */
export async function createProduct(
  request: ProductCreateRequest
): Promise<Product> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Generate product code if not provided
  const productCode = request.product_code || (await generateProductCode());

  // Validate category is enabled for tenant
  const { data: categoryEnabled } = await supabase
    .from('org_service_category_cf')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('service_category_code', request.service_category_code)
    .maybeSingle();

  if (!categoryEnabled) {
    throw new Error('Service category not enabled for this tenant');
  }

  // Insert product
  const { data, error } = await supabase
    .from('org_product_data_mst')
    .insert({
      tenant_org_id: tenantId,
      service_category_code: request.service_category_code,
      product_code: productCode,
      product_name: request.product_name,
      product_name2: request.product_name2 || null,
      hint_text: request.hint_text || null,
      is_retail_item: request.is_retail_item || false,
      product_type: request.product_type || null,
      price_type: request.price_type || null,
      product_unit: request.product_unit,
      default_sell_price: request.default_sell_price,
      default_express_sell_price: request.default_express_sell_price || null,
      product_cost: request.product_cost || null,
      min_sell_price: request.min_sell_price || null,
      min_quantity: request.min_quantity || null,
      pieces_per_product: request.pieces_per_product || null,
      extra_days: request.extra_days || null,
      turnaround_hh: request.turnaround_hh || null,
      turnaround_hh_express: request.turnaround_hh_express || null,
      multiplier_express: request.multiplier_express || null,
      product_order: request.product_order || null,
      is_tax_exempt: request.is_tax_exempt || null,
      tags: request.tags || null,
      id_sku: request.id_sku || null,
      is_active: request.is_active !== undefined ? request.is_active : true,
      product_color1: request.product_color1 || null,
      product_color2: request.product_color2 || null,
      product_color3: request.product_color3 || null,
      product_icon: request.product_icon || null,
      product_image: request.product_image || null,
      rec_notes2: null,
      rec_status: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      throw new Error('Product code already exists');
    }
    throw new Error('Failed to create product');
  }

  if (!data) {
    throw new Error('Failed to create product: no data returned');
  }

  // Type assertion: Supabase returns all fields including rec_notes2 (even if null)
  return data as unknown as Product;
}

/**
 * Update an existing product
 */
export async function updateProduct(
  request: ProductUpdateRequest
): Promise<Product> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Build update object (exclude undefined values)
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  // Only update fields that are provided
  if (request.service_category_code !== undefined)
    updateData.service_category_code = request.service_category_code;
  if (request.product_code !== undefined) updateData.product_code = request.product_code;
  if (request.product_name !== undefined) updateData.product_name = request.product_name;
  if (request.product_name2 !== undefined) updateData.product_name2 = request.product_name2;
  if (request.hint_text !== undefined) updateData.hint_text = request.hint_text;
  if (request.is_retail_item !== undefined) updateData.is_retail_item = request.is_retail_item;
  if (request.product_type !== undefined) updateData.product_type = request.product_type;
  if (request.price_type !== undefined) updateData.price_type = request.price_type;
  if (request.product_unit !== undefined) updateData.product_unit = request.product_unit;
  if (request.default_sell_price !== undefined)
    updateData.default_sell_price = request.default_sell_price;
  if (request.default_express_sell_price !== undefined)
    updateData.default_express_sell_price = request.default_express_sell_price;
  if (request.product_cost !== undefined) updateData.product_cost = request.product_cost;
  if (request.min_sell_price !== undefined) updateData.min_sell_price = request.min_sell_price;
  if (request.min_quantity !== undefined) updateData.min_quantity = request.min_quantity;
  if (request.pieces_per_product !== undefined)
    updateData.pieces_per_product = request.pieces_per_product;
  if (request.extra_days !== undefined) updateData.extra_days = request.extra_days;
  if (request.turnaround_hh !== undefined) updateData.turnaround_hh = request.turnaround_hh;
  if (request.turnaround_hh_express !== undefined)
    updateData.turnaround_hh_express = request.turnaround_hh_express;
  if (request.multiplier_express !== undefined)
    updateData.multiplier_express = request.multiplier_express;
  if (request.product_order !== undefined) updateData.product_order = request.product_order;
  if (request.is_tax_exempt !== undefined) updateData.is_tax_exempt = request.is_tax_exempt;
  if (request.tags !== undefined) updateData.tags = request.tags;
  if (request.id_sku !== undefined) updateData.id_sku = request.id_sku;
  if (request.is_active !== undefined) updateData.is_active = request.is_active;
  if (request.product_color1 !== undefined)
    updateData.product_color1 = request.product_color1;
  if (request.product_color2 !== undefined)
    updateData.product_color2 = request.product_color2;
  if (request.product_color3 !== undefined)
    updateData.product_color3 = request.product_color3;
  if (request.product_icon !== undefined)
    updateData.product_icon = request.product_icon;
  if (request.product_image !== undefined)
    updateData.product_image = request.product_image;

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .update(updateData)
    .eq('tenant_org_id', tenantId)
    .eq('id', request.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    if (error.code === '23505') {
      throw new Error('Product code already exists');
    }
    throw new Error('Failed to update product');
  }

  if (!data) {
    throw new Error('Failed to update product: no data returned');
  }

  // Type assertion: Supabase returns all fields including rec_notes2 (even if null)
  return data as unknown as Product;
}

/**
 * Delete a product (soft delete)
 */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { error } = await supabase
    .from('org_product_data_mst')
    .update({ is_active: false })
    .eq('tenant_org_id', tenantId)
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    throw new Error('Failed to delete product');
  }
}

/**
 * Get a single product by ID
 */
export async function getProductById(id: string): Promise<Product> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data, error } = await supabase
    .from('org_product_data_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching product:', error);
    throw new Error('Product not found');
  }

  if (!data) {
    throw new Error('Product not found');
  }

  // Type assertion: Supabase returns all fields including rec_notes2 (even if null)
  return data as unknown as Product;
}

/**
 * Search products with filters and pagination
 */
export async function searchProducts(
  params: ProductSearchParams
): Promise<ProductSearchResponse> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  console.log('🔍 Searching products for tenant:', tenantId);
  console.log('🔍 Search params:', params);

  // Build query with filters
  let query = supabase
    .from('org_product_data_mst')
    .select('*', { count: 'exact' })
    .eq('tenant_org_id', tenantId);

  // Filter by category
  if (params.category) {
    query = query.eq('service_category_code', params.category);
  }

  // Filter by status
  if (params.status === 'active') {
    query = query.eq('is_active', true);
  } else if (params.status === 'inactive') {
    query = query.eq('is_active', false);
  }

  // Search by product code or name
  if (params.search) {
    query = query.or(
      `product_code.ilike.%${params.search}%,product_name.ilike.%${params.search}%,product_name2.ilike.%${params.search}%`
    );
  }

  // Sorting
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';

  const sortColumn = {
    code: 'product_code',
    name: 'product_name',
    category: 'service_category_code',
    createdAt: 'created_at',
    price: 'default_sell_price',
  }[sortBy] || 'created_at';

  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Pagination
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  query = query.range(offset, offset + limit - 1);

  // Execute query
  const { data, error, count } = await query;

  console.log('📦 Query result:', {
    success: !error,
    error: error,
    count: count,
    dataLength: data?.length,
    firstProduct: data?.[0],
    category: params.category
  });

  if (error) {
    console.error('Error searching products:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to search products: ${error.message || JSON.stringify(error)}`);
  }

  // Transform data to ProductListItem format
  const products: ProductListItem[] = (data || []).map((item: any) => ({
    id: item.id,
    product_code: item.product_code,
    product_name: item.product_name,
    product_name2: item.product_name2,
    service_category_code: item.service_category_code,
    category_name: item.service_category_code, // Use code for now
    category_name2: item.service_category_code,
    default_sell_price: item.default_sell_price,
    default_express_sell_price: item.default_express_sell_price,
    product_unit: item.product_unit,
    is_active: item.is_active,
    created_at: item.created_at,
  }));

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    products,
    total,
    page,
    limit,
    totalPages,
  };
}

// ==================================================================
// PRICE LISTS
// ==================================================================

/**
 * Get all price lists for current tenant
 */
export async function getPriceLists(): Promise<PriceList[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data, error } = await supabase
    .from('org_price_lists_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching price lists:', error);
    throw new Error('Failed to fetch price lists');
  }

  // Get item counts for each price list
  let result: PriceList[] = data as PriceList[];

  if (data && data.length > 0) {
    const priceListIds = data.map((pl) => pl.id);
    const { data: itemCounts } = await supabase
      .from('org_price_list_items_dtl')
      .select('price_list_id')
      .in('price_list_id', priceListIds);

    const countsByListId = (itemCounts || []).reduce((acc, item) => {
      acc[item.price_list_id] = (acc[item.price_list_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    result = result.map((pl) => ({
      ...pl,
      item_count: countsByListId[pl.id] || 0,
    }));
  }

  return result;
}

/**
 * Get a single price list with items
 */
export async function getPriceListById(id: string): Promise<PriceListWithItems> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Get price list
  const { data: priceList, error: priceListError } = await supabase
    .from('org_price_lists_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('id', id)
    .single();

  if (priceListError) {
    console.error('Error fetching price list:', priceListError);
    throw new Error('Price list not found');
  }

  // Get items
  const { data: items, error: itemsError } = await supabase
    .from('org_price_list_items_dtl')
    .select(
      `
      *,
      org_product_data_mst(product_code, product_name, product_name2)
    `
    )
    .eq('price_list_id', id)
    .eq('is_active', true)
    .order('created_at');

  if (itemsError) {
    console.error('Error fetching price list items:', itemsError);
    throw new Error('Failed to fetch price list items');
  }

  // Transform items to include product data
  const transformedItems: PriceListItem[] = (items || []).map((item: any) => ({
    ...item,
    product_code: item.org_product_data_mst?.product_code,
    product_name: item.org_product_data_mst?.product_name,
    product_name2: item.org_product_data_mst?.product_name2,
  }));

  return {
    ...(priceList as PriceList),
    items: transformedItems,
  };
}

/**
 * Create a new price list
 */
export async function createPriceList(
  request: PriceListCreateRequest
): Promise<PriceList> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Insert price list
  const { data, error } = await supabase
    .from('org_price_lists_mst')
    .insert({
      tenant_org_id: tenantId,
      name: request.name,
      name2: request.name2 || null,
      description: request.description || null,
      description2: request.description2 || null,
      price_list_type: request.price_list_type,
      effective_from: request.effective_from || null,
      effective_to: request.effective_to || null,
      is_default: request.is_default || false,
      priority: request.priority || 0,
      is_active: true,
      rec_status: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating price list:', error);
    throw new Error('Failed to create price list');
  }

  // Insert items if provided
  if (request.items && request.items.length > 0) {
    const itemsToInsert = request.items.map((item) => ({
      tenant_org_id: tenantId,
      price_list_id: data.id,
      product_id: item.product_id,
      price: item.price,
      discount_percent: item.discount_percent || 0,
      min_quantity: item.min_quantity || 1,
      max_quantity: item.max_quantity || null,
      is_active: true,
      rec_status: 1,
    }));

    const { error: itemsError } = await supabase
      .from('org_price_list_items_dtl')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating price list items:', itemsError);
      // Clean up the price list
      await supabase.from('org_price_lists_mst').delete().eq('id', data.id);
      throw new Error('Failed to create price list items');
    }
  }

  return data as PriceList;
}

/**
 * Update an existing price list
 */
export async function updatePriceList(
  request: PriceListUpdateRequest
): Promise<PriceList> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Build update object
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (request.name !== undefined) updateData.name = request.name;
  if (request.name2 !== undefined) updateData.name2 = request.name2;
  if (request.description !== undefined) updateData.description = request.description;
  if (request.description2 !== undefined) updateData.description2 = request.description2;
  if (request.price_list_type !== undefined) updateData.price_list_type = request.price_list_type;
  if (request.effective_from !== undefined) updateData.effective_from = request.effective_from;
  if (request.effective_to !== undefined) updateData.effective_to = request.effective_to;
  if (request.is_default !== undefined) updateData.is_default = request.is_default;
  if (request.priority !== undefined) updateData.priority = request.priority;

  const { data, error } = await supabase
    .from('org_price_lists_mst')
    .update(updateData)
    .eq('tenant_org_id', tenantId)
    .eq('id', request.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating price list:', error);
    throw new Error('Failed to update price list');
  }

  return data as PriceList;
}

/**
 * Delete a price list (hard delete - also deletes items)
 */
export async function deletePriceList(id: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Items will be cascade deleted
  const { error } = await supabase
    .from('org_price_lists_mst')
    .delete()
    .eq('tenant_org_id', tenantId)
    .eq('id', id);

  if (error) {
    console.error('Error deleting price list:', error);
    throw new Error('Failed to delete price list');
  }
}

// ==================================================================
// BULK OPERATIONS
// ==================================================================

/**
 * Parse CSV content and validate
 */
function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.trim().split('\n');
  return lines.map((line) => {
    // Simple CSV parsing (can be enhanced later)
    return line.split(',').map((field) => field.trim());
  });
}

/**
 * Validate CSV row data
 */
function validateCSVRow(
  row: string[],
  headers: string[],
  rowNumber: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (row.length !== headers.length) {
    errors.push({
      row: rowNumber,
      field: 'all',
      message: `Expected ${headers.length} columns, got ${row.length}`,
    });
    return errors;
  }

  // Map row to object
  const data: Record<string, string> = {};
  headers.forEach((header, index) => {
    data[header] = row[index];
  });

  // Validate required fields
  if (!data.product_code || data.product_code.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'product_code',
      message: 'Product code is required',
    });
  }

  if (!data.product_name || data.product_name.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'product_name',
      message: 'Product name is required',
    });
  }

  if (!data.category_code || data.category_code.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'category_code',
      message: 'Category code is required',
    });
  }

  if (!data.price) {
    errors.push({
      row: rowNumber,
      field: 'price',
      message: 'Price is required',
    });
  } else {
    const price = parseFloat(data.price);
    if (isNaN(price) || price < 0) {
      errors.push({
        row: rowNumber,
        field: 'price',
        message: 'Price must be a valid positive number',
        value: data.price,
      });
    }
  }

  if (!data.unit || !['piece', 'kg', 'item'].includes(data.unit)) {
    errors.push({
      row: rowNumber,
      field: 'unit',
      message: 'Unit must be piece, kg, or item',
      value: data.unit,
    });
  }

  return errors;
}

/**
 * Import products from CSV
 */
export async function bulkImportProducts(
  csvContent: string,
  template: 'basic' | 'advanced'
): Promise<BulkImportResult> {
  const rows = parseCSV(csvContent);
  if (rows.length === 0) {
    return {
      success: false,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      imported: 0,
      skipped: 0,
      errors: [{ row: 1, field: 'file', message: 'CSV file is empty' }],
    };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Validate all rows
  const allErrors: ValidationError[] = [];
  const validRows: any[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const errors = validateCSVRow(row, headers, i + 2);
    if (errors.length > 0) {
      allErrors.push(...errors);
    } else {
      validRows.push({ row: i + 2, data: row });
    }
  }

  if (allErrors.length > 0) {
    return {
      success: false,
      totalRows: dataRows.length,
      validRows: validRows.length,
      invalidRows: allErrors.length,
      imported: 0,
      skipped: 0,
      errors: allErrors,
    };
  }

  // Import valid rows
  let imported = 0;
  const importErrors: ValidationError[] = [];

  for (const validRow of validRows) {
    try {
      const rowData = validRow.data;
      const data: any = {};

      headers.forEach((header, index) => {
        data[header] = rowData[index];
      });

      await createProduct({
        product_code: data.product_code,
        product_name: data.product_name,
        product_name2: data.product_name_ar || '',
        service_category_code: data.category_code,
        product_unit: data.unit,
        default_sell_price: parseFloat(data.price),
        default_express_sell_price: data.price_express
          ? parseFloat(data.price_express)
          : undefined,
      });

      imported++;
    } catch (error: any) {
      importErrors.push({
        row: validRow.row,
        field: 'import',
        message: error.message || 'Failed to import row',
      });
    }
  }

  return {
    success: importErrors.length === 0,
    totalRows: dataRows.length,
    validRows: validRows.length,
    invalidRows: importErrors.length,
    imported,
    skipped: dataRows.length - imported - importErrors.length,
    errors: importErrors,
  };
}

/**
 * Export products to CSV
 */
export async function exportProducts(
  template: 'basic' | 'advanced'
): Promise<string> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Get all active products
  const { data, error } = await supabase
    .from('org_product_data_mst')
    .select(
      `
      *,
      sys_service_category_cd(ctg_name, ctg_name2)
    `
    )
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .order('product_code');

  if (error) {
    throw new Error('Failed to fetch products for export');
  }

  // Generate CSV
  if (template === 'basic') {
    const headers = 'product_code,product_name,product_name_ar,category_code,price,unit';
    const rows = (data || []).map((product: any) =>
      [
        product.product_code,
        product.product_name || '',
        product.product_name2 || '',
        product.service_category_code || '',
        product.default_sell_price || '',
        product.product_unit || '',
      ].join(',')
    );
    return [headers, ...rows].join('\n');
  } else {
    // Advanced template
    const headers =
      'product_code,product_name,product_name_ar,category_code,price_regular,price_express,unit,min_qty,turnaround_hh,turnaround_hh_express,is_active';
    const rows = (data || []).map((product: any) =>
      [
        product.product_code,
        product.product_name || '',
        product.product_name2 || '',
        product.service_category_code || '',
        product.default_sell_price || '',
        product.default_express_sell_price || '',
        product.product_unit || '',
        product.min_quantity || '',
        product.turnaround_hh || '',
        product.turnaround_hh_express || '',
        product.is_active,
      ].join(',')
    );
    return [headers, ...rows].join('\n');
  }
}

/**
 * Get product statistics
 */
export async function getProductStatistics(): Promise<ProductStatistics> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Get all products
  const { data, error } = await supabase
    .from('org_product_data_mst')
    .select('is_active,service_category_code')
    .eq('tenant_org_id', tenantId);

  if (error) {
    throw new Error('Failed to fetch product statistics');
  }

  const totalProducts = data?.length || 0;
  const activeProducts = data?.filter((p) => p.is_active).length || 0;
  const inactiveProducts = totalProducts - activeProducts;

  // Count by category
  const byCategory: Record<string, number> = {};
  data?.forEach((product) => {
    const category = product.service_category_code || 'uncategorized';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });

  return {
    totalProducts,
    activeProducts,
    inactiveProducts,
    byCategory,
  };
}

