/**
 * Bulk Price Export API
 * GET /api/v1/pricing/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { pricingBulkService } from '@/lib/services/pricing-bulk.service';

export async function GET(request: NextRequest) {
  try {
    const { user, tenantId } = await getAuthContext();

    if (!user || !tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const priceListId = searchParams.get('priceListId') || undefined;
    const priceListType = searchParams.get('priceListType') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Export
    const csv = await pricingBulkService.exportPriceListItems({
      priceListId,
      priceListType: priceListType || undefined,
      includeInactive,
      format: 'csv',
    });

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="price-list-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('[Pricing Export API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export price list items' },
      { status: 500 }
    );
  }
}

