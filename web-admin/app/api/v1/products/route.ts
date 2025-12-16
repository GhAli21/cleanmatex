/**
 * PRD-007: Catalog Service Management API
 * Product management endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createProduct,
  searchProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkImportProducts,
  exportProducts,
  getProductStatistics,
} from '@/lib/services/catalog.service';
import type {
  ProductCreateRequest,
  ProductSearchParams,
  BulkImportRequest,
  BulkExportRequest,
} from '@/lib/types/catalog';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/**
 * Get authenticated user and tenant context
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  return {
    user,
    tenantId: tenants[0].tenant_id,
    userId: user.id,
    userRole: tenants[0].user_role,
  };
}

// ==================================================================
// GET /api/v1/products - List Products
// ==================================================================

/**
 * List products with search and filters
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - search: string (search by code or name)
 * - category: string (filter by category code)
 * - status: 'active' | 'inactive'
 * - sortBy: 'code' | 'name' | 'category' | 'createdAt' | 'price'
 * - sortOrder: 'asc' | 'desc'
 *
 * Response: { success: true, data: ProductListItem[], pagination: {...} }
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: ProductSearchParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') as 'active' | 'inactive' | undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    // Validate pagination
    if (params.page! < 1) {
      return NextResponse.json(
        { error: 'page must be greater than 0' },
        { status: 400 }
      );
    }

    if (params.limit! < 1 || params.limit! > 100) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Validate status filter
    if (params.status && !['active', 'inactive'].includes(params.status)) {
      return NextResponse.json(
        { error: 'status must be active or inactive' },
        { status: 400 }
      );
    }

    // Search products
    const result = await searchProducts(params);

    return NextResponse.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// ==================================================================
// POST /api/v1/products - Create Product
// ==================================================================

/**
 * Create a new product
 *
 * Request Body: ProductCreateRequest
 *
 * Response: { success: true, data: Product, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthContext();

    const body: ProductCreateRequest = await request.json();

    // Validate required fields
    if (!body.product_name || body.product_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'product_name is required' },
        { status: 400 }
      );
    }

    if (!body.product_unit || !['piece', 'kg', 'item'].includes(body.product_unit)) {
      return NextResponse.json(
        { error: 'product_unit must be piece, kg, or item' },
        { status: 400 }
      );
    }

    if (body.default_sell_price === undefined || body.default_sell_price < 0) {
      return NextResponse.json(
        { error: 'default_sell_price must be a valid positive number' },
        { status: 400 }
      );
    }

    if (!body.service_category_code || body.service_category_code.trim().length === 0) {
      return NextResponse.json(
        { error: 'service_category_code is required' },
        { status: 400 }
      );
    }

    // Create product
    const product = await createProduct(body);

    return NextResponse.json(
      {
        success: true,
        data: product,
        message: 'Product created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes('already exists')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

