/**
 * PRD-007: Catalog Service Management API
 * Export products to CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportProducts } from '@/lib/services/catalog.service';

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
// GET /api/v1/products/export - Export Products
// ==================================================================

/**
 * Export products to CSV
 *
 * Query Parameters:
 * - template: 'basic' | 'advanced' (default: 'advanced')
 *
 * Response: CSV file download
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();

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

