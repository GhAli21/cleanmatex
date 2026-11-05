/**
 * PRD-007: Catalog Service Management API
 * Export products to CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { exportProducts } from '@/lib/services/catalog.service';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

// ==================================================================
// GET /api/v1/products/export - Export Products
// ==================================================================

/**
 * Export products to CSV
 *
 * Query Parameters:
 * - template: 'basic' | 'advanced' (default: 'advanced')
 *
 * Response: CSV file download
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('products:export')(request);
  if (auth instanceof NextResponse) return auth;

  try {

    const { searchParams } = new URL(request.url);
    const template = (searchParams.get('template') as 'basic' | 'advanced') || 'advanced';

    // Validate template
    if (!['basic', 'advanced'].includes(template)) {
      return NextResponse.json(
        { error: 'template must be basic or advanced' },
        { status: 400 }
      );
    }

    // Export products
    const csvContent = await exportProducts(template);

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting products:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to export products' },
      { status: 500 }
    );
  }
}

