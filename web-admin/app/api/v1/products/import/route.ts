/**
 * PRD-007: Catalog Service Management API
 * Bulk import products from CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bulkImportProducts } from '@/lib/services/catalog.service';
import type { BulkImportRequest } from '@/lib/types/catalog';

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
// POST /api/v1/products/import - Import Products
// ==================================================================

/**
 * Import products from CSV file
 *
 * Request Body:
 * - template: 'basic' | 'advanced'
 * - data: string (CSV content)
 *
 * Response: { success: boolean, data: BulkImportResult }
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthContext();

    const body: BulkImportRequest = await request.json();

    // Validate request body
    if (!body.template || !['basic', 'advanced'].includes(body.template)) {
      return NextResponse.json(
        { error: 'template must be basic or advanced' },
        { status: 400 }
      );
    }

    if (!body.data || typeof body.data !== 'string') {
      return NextResponse.json(
        { error: 'data must be a valid CSV string' },
        { status: 400 }
      );
    }

    if (body.data.trim().length === 0) {
      return NextResponse.json(
        { error: 'CSV data cannot be empty' },
        { status: 400 }
      );
    }

    // Import products
    const result = await bulkImportProducts(body.data, body.template);

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Error importing products:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to import products' },
      { status: 500 }
    );
  }
}

