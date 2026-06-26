/**
 * Price Import Template API
 * GET /api/v1/pricing/template
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { pricingBulkService } from '@/lib/services/pricing-bulk.service';

/**
 *
 */
export async function GET() {
  try {
    const { user, tenantId } = await getAuthContext();

    if (!user || !tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = pricingBulkService.getImportTemplate();

    // Return CSV template file
    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="price-list-import-template.csv"',
      },
    });
  } catch (error: any) {
    console.error('[Pricing Template API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate template' },
      { status: 500 }
    );
  }
}

