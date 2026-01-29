/**
 * Pricing Bulk Operations Service
 *
 * Handles CSV import/export for bulk price management.
 */

import { createClient } from '@/lib/supabase/client';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import type { PriceListItem } from '@/lib/types/catalog';

export interface BulkImportRow {
  product_code?: string;
  product_id?: string;
  price: number;
  discount_percent?: number;
  min_quantity?: number;
  max_quantity?: number | null;
}

export interface BulkImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  errors: Array<{
    row: number;
    data: BulkImportRow;
    error: string;
  }>;
}

export interface BulkExportOptions {
  priceListId?: string;
  priceListType?: string;
  includeInactive?: boolean;
  format?: 'csv' | 'excel';
}

export class PricingBulkService {
  private supabase = createClient();

  /**
   * Import price list items from CSV data
   * @param priceListId - Price list ID to import into
   * @param rows - Array of CSV rows
   * @returns BulkImportResult
   */
  async importPriceListItems(
    priceListId: string,
    rows: BulkImportRow[]
  ): Promise<BulkImportResult> {
    const tenantId = await getTenantIdFromSession();
    const result: BulkImportResult = {
      success: true,
      totalRows: rows.length,
      imported: 0,
      errors: [],
    };

    // Verify price list exists and belongs to tenant
    const { data: priceList, error: priceListError } = await this.supabase
      .from('org_price_lists_mst')
      .select('id, tenant_org_id')
      .eq('id', priceListId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (priceListError || !priceList) {
      result.success = false;
      result.errors.push({
        row: 0,
        data: {} as BulkImportRow,
        error: 'Price list not found or access denied',
      });
      return result;
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate row
        if (!row.price || row.price < 0) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: 'Invalid price (must be >= 0)',
          });
          continue;
        }

        // Find product by code or ID
        let productId: string | null = null;

        if (row.product_id) {
          productId = row.product_id;
        } else if (row.product_code) {
          const { data: product } = await this.supabase
            .from('org_product_data_mst')
            .select('id')
            .eq('tenant_org_id', tenantId)
            .eq('product_code', row.product_code)
            .eq('is_active', true)
            .single();

          if (product) {
            productId = product.id;
          }
        }

        if (!productId) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: 'Product not found (check product_code or product_id)',
          });
          continue;
        }

        // Verify product belongs to tenant
        const { data: product } = await this.supabase
          .from('org_product_data_mst')
          .select('id')
          .eq('tenant_org_id', tenantId)
          .eq('id', productId)
          .eq('is_active', true)
          .single();

        if (!product) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: 'Product not found or inactive',
          });
          continue;
        }

        // Validate quantity range
        const minQuantity = row.min_quantity || 1;
        const maxQuantity = row.max_quantity === undefined ? null : row.max_quantity;

        if (minQuantity < 1) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: 'min_quantity must be >= 1',
          });
          continue;
        }

        if (maxQuantity !== null && maxQuantity < minQuantity) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: 'max_quantity must be >= min_quantity',
          });
          continue;
        }

        // Validate discount
        const discountPercent = row.discount_percent || 0;
        if (discountPercent < 0 || discountPercent > 100) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: 'discount_percent must be between 0 and 100',
          });
          continue;
        }

        // Insert or update price list item
        const { error: insertError } = await this.supabase
          .from('org_price_list_items_dtl')
          .upsert(
            {
              tenant_org_id: tenantId,
              price_list_id: priceListId,
              product_id: productId,
              price: row.price,
              discount_percent: discountPercent,
              min_quantity: minQuantity,
              max_quantity: maxQuantity,
              is_active: true,
            },
            {
              onConflict: 'price_list_id,product_id,min_quantity',
            }
          );

        if (insertError) {
          result.errors.push({
            row: i + 1,
            data: row,
            error: insertError.message,
          });
          continue;
        }

        result.imported++;
      } catch (error: any) {
        result.errors.push({
          row: i + 1,
          data: row,
          error: error.message || 'Unknown error',
        });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Export price list items to CSV format
   * @param options - Export options
   * @returns CSV string
   */
  async exportPriceListItems(options: BulkExportOptions = {}): Promise<string> {
    const tenantId = await getTenantIdFromSession();

    // Build query
    let query = this.supabase
      .from('org_price_list_items_dtl')
      .select(
        `
        id,
        price,
        discount_percent,
        min_quantity,
        max_quantity,
        is_active,
        org_price_lists_mst!inner(
          id,
          name,
          price_list_type
        ),
        org_product_data_mst!inner(
          id,
          product_code,
          product_name,
          product_name2
        )
      `
      )
      .eq('tenant_org_id', tenantId);

    // Apply filters
    if (options.priceListId) {
      query = query.eq('price_list_id', options.priceListId);
    }

    if (options.priceListType) {
      query = query.eq('org_price_lists_mst.price_list_type', options.priceListType);
    }

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: items, error } = await query;

    if (error) {
      throw new Error(`Failed to export price list items: ${error.message}`);
    }

    // Convert to CSV
    const headers = [
      'product_code',
      'product_id',
      'product_name',
      'product_name2',
      'price_list_id',
      'price_list_name',
      'price',
      'discount_percent',
      'min_quantity',
      'max_quantity',
      'is_active',
    ];

    const rows = (items || []).map((item: any) => [
      item.org_product_data_mst?.product_code || '',
      item.org_product_data_mst?.id || '',
      item.org_product_data_mst?.product_name || '',
      item.org_product_data_mst?.product_name2 || '',
      item.org_price_lists_mst?.id || '',
      item.org_price_lists_mst?.name || '',
      item.price || 0,
      item.discount_percent || 0,
      item.min_quantity || 1,
      item.max_quantity || '',
      item.is_active ? 'true' : 'false',
    ]);

    // Generate CSV
    const csvRows = [headers.join(',')];
    rows.forEach((row) => {
      csvRows.push(
        row.map((cell: any) => {
          const str = String(cell);
          // Escape quotes and wrap in quotes if contains comma or newline
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      );
    });

    return csvRows.join('\n');
  }

  /**
   * Import all active products with their default prices
   * @param priceListId - Price list ID to import into
   * @param priceListType - Price list type (standard, express, etc.)
   * @param overwriteExisting - Whether to overwrite existing price list items
   * @param tenantId - Optional tenant ID (if not provided, will be fetched from session)
   * @returns BulkImportResult
   */
  async importAllProductsWithDefaults(
    priceListId: string,
    priceListType: string,
    overwriteExisting: boolean = false,
    tenantId?: string
  ): Promise<BulkImportResult> {
    const v_tenantId = tenantId || (await getTenantIdFromSession());
    const result: BulkImportResult = {
      success: true,
      totalRows: 0,
      imported: 0,
      errors: [],
    };

    // Verify price list exists and belongs to tenant
    const { data: priceList, error: priceListError } = await this.supabase
      .from('org_price_lists_mst')
      .select('id, tenant_org_id, price_list_type')
      .eq('id', priceListId)
      .eq('tenant_org_id', v_tenantId)
      .single();

    if (priceListError || !priceList) {
      result.success = false;
      result.errors.push({
        row: 0,
        data: {} as BulkImportRow,
        error: 'Price list not found or access denied',
      });
      return result;
    }

    // Determine which default price field to use based on price list type
    const useExpressPrice = priceListType === 'express' || priceListType === 'vip';

    // Fetch all active products for the tenant
    const { data: products, error: productsError } = await this.supabase
      .from('org_product_data_mst')
      .select('id, product_code, product_name, default_sell_price, default_express_sell_price')
      .eq('tenant_org_id', v_tenantId)
      .eq('is_active', true)
      .eq('rec_status', 1);

    if (productsError) {
      result.success = false;
      result.errors.push({
        row: 0,
        data: {} as BulkImportRow,
        error: `Failed to fetch products: ${productsError.message}`,
      });
      return result;
    }

    if (!products || products.length === 0) {
      result.success = false;
      result.errors.push({
        row: 0,
        data: {} as BulkImportRow,
        error: 'No active products found',
      });
      return result;
    }

    result.totalRows = products.length;

    // Get existing price list items if not overwriting
    let existingItems: Set<string> = new Set();
    if (!overwriteExisting) {
      const { data: existing } = await this.supabase
        .from('org_price_list_items_dtl')
        .select('product_id, min_quantity')
        .eq('tenant_org_id', v_tenantId)
        .eq('price_list_id', priceListId)
        .eq('is_active', true);

      if (existing) {
        existing.forEach((item) => {
          existingItems.add(`${item.product_id}_${item.min_quantity || 1}`);
        });
      }
    }

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        // Determine default price based on price list type
        const defaultPrice = useExpressPrice
          ? product.default_express_sell_price
          : product.default_sell_price;

        // Skip products without default price
        if (!defaultPrice || Number(defaultPrice) <= 0) {
          result.errors.push({
            row: i + 1,
            data: {
              product_id: product.id,
              product_code: product.product_code,
              price: 0,
            } as BulkImportRow,
            error: `No default ${useExpressPrice ? 'express' : 'standard'} price set for product`,
          });
          continue;
        }

        const price = Number(defaultPrice);
        const minQuantity = 1; // Default to quantity 1
        const itemKey = `${product.id}_${minQuantity}`;

        // Skip if already exists and not overwriting
        if (!overwriteExisting && existingItems.has(itemKey)) {
          continue;
        }

        // Insert or update price list item
        const { error: insertError } = await this.supabase
          .from('org_price_list_items_dtl')
          .upsert(
            {
              tenant_org_id: v_tenantId,
              price_list_id: priceListId,
              product_id: product.id,
              price: price,
              discount_percent: 0,
              min_quantity: minQuantity,
              max_quantity: null,
              is_active: true,
            },
            {
              onConflict: 'price_list_id,product_id,min_quantity',
            }
          );

        if (insertError) {
          result.errors.push({
            row: i + 1,
            data: {
              product_id: product.id,
              product_code: product.product_code,
              price: price,
            } as BulkImportRow,
            error: insertError.message,
          });
          continue;
        }

        result.imported++;
      } catch (error: any) {
        result.errors.push({
          row: i + 1,
          data: {
            product_id: product.id,
            product_code: product.product_code,
            price: 0,
          } as BulkImportRow,
          error: error.message || 'Unknown error',
        });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Get CSV template for import
   * @returns CSV string with headers and example row
   */
  getImportTemplate(): string {
    const headers = [
      'product_code',
      'product_id',
      'price',
      'discount_percent',
      'min_quantity',
      'max_quantity',
    ];

    const exampleRow = ['PROD001', '', '10.500', '0', '1', ''];

    return [headers.join(','), exampleRow.join(',')].join('\n');
  }
}

// Export singleton instance
export const pricingBulkService = new PricingBulkService();

