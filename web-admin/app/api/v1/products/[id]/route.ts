/**
 * PRD-007: Catalog Service Management API
 * Individual product endpoints (GET, PATCH, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getProductById,
  updateProduct,
  deleteProduct,
} from '@/lib/services/catalog.service';
import type { ProductUpdateRequest } from '@/lib/types/catalog';

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
// GET /api/v1/products/:id - Get Product
// ==================================================================

/**
 * Get a single product by ID
 *
 * Response: { success: true, data: Product }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthContext();
    const { id } = await params;

    const product = await getProductById(id);

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message === 'Product not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// ==================================================================
// PATCH /api/v1/products/:id - Update Product
// ==================================================================

/**
 * Update an existing product
 *
 * Request Body: ProductUpdateRequest (partial)
 *
 * Response: { success: true, data: Product, message: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthContext();
    const { id } = await params;

    const body: Partial<ProductUpdateRequest> = await request.json();

    // Validate at least one field is being updated
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }

    // Update product
    const product = await updateProduct({
      id,
      ...body,
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('Error updating product:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message === 'Product not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.message.includes('already exists')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// ==================================================================
// DELETE /api/v1/products/:id - Delete Product
// ==================================================================

/**
 * Soft delete a product (set is_active to false)
 *
 * Response: { success: true, message: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthContext();
    const { id } = await params;

    await deleteProduct(id);

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message === 'Product not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

