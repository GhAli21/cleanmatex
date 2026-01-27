/**
 * Server Action: Find or Create Product
 * 
 * Searches for a product by name within a service category.
 * If found, returns the product ID.
 * If not found, creates the product and returns its ID.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { createProduct, searchProducts } from '@/lib/services/catalog.service';
import type { ProductCreateRequest } from '@/lib/types/catalog';

interface FindOrCreateProductParams {
  productName: string;
  productName2?: string;
  serviceCategoryCode: string;
  defaultPrice?: number;
}

interface FindOrCreateProductResult {
  success: boolean;
  productId?: string;
  error?: string;
  created?: boolean; // true if product was created, false if found
}

/**
 * Find or create a product by name
 * Tenant ID is retrieved from the session automatically
 */
export async function findOrCreateProduct(
  params: FindOrCreateProductParams
): Promise<FindOrCreateProductResult> {
  try {
    const { productName, productName2, serviceCategoryCode, defaultPrice } = params;

    if (!productName || !productName.trim()) {
      return {
        success: false,
        error: 'Product name is required',
      };
    }

    if (!serviceCategoryCode) {
      return {
        success: false,
        error: 'Service category code is required',
      };
    }

    // Search for existing product by name (case-insensitive, exact match preferred)
    const searchResult = await searchProducts({
      category: serviceCategoryCode,
      search: productName.trim(),
      status: 'active',
      page: 1,
      limit: 10,
    });

    // Find exact match (case-insensitive)
    const exactMatch = searchResult.products.find(
      (p) =>
        p.product_name?.toLowerCase().trim() === productName.toLowerCase().trim() &&
        p.service_category_code === serviceCategoryCode
    );

    if (exactMatch) {
      return {
        success: true,
        productId: exactMatch.id,
        created: false,
      };
    }

    // Product not found - create it
    const productData: ProductCreateRequest = {
      service_category_code: serviceCategoryCode,
      product_name: productName.trim(),
      product_name2: productName2?.trim() || null,
      product_unit: 'piece', // Default unit
      default_sell_price: defaultPrice || 0,
      is_active: true,
    };

    const createdProduct = await createProduct(productData);

    return {
      success: true,
      productId: createdProduct.id,
      created: true,
    };
  } catch (error) {
    console.error('[findOrCreateProduct] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find or create product',
    };
  }
}

