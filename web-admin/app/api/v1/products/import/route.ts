/**
 * PRD-007: Catalog Service Management API
 * Bulk import products from CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { bulkImportProducts } from '@/lib/services/catalog.service';
import type { BulkImportRequest } from '@/lib/types/catalog';

/** Each row is created one by one inside the request, so the upload is bounded. */
const MAX_IMPORT_CSV_CHARS = 2 * 1024 * 1024;

// ==================================================================
// POST /api/v1/products/import - Import Products
// ==================================================================

/**
 * Import products from CSV file (insert only, so `products:create` is the gate).
 *
 * Request Body:
 * - template: 'basic' | 'advanced'
 * - data: string (CSV content)
 *
 * Response: { success: boolean, data: BulkImportResult }
 * @param request
 */
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission('products:create')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
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

    if (body.data.length > MAX_IMPORT_CSV_CHARS) {
      return NextResponse.json(
        { error: 'CSV data is too large (max 2 MB)' },
        { status: 413 }
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
      if (error.message === 'No tenant context') {
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
