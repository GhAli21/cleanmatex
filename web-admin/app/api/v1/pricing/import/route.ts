/**
 * Bulk Price Import API
 * POST /api/v1/pricing/import
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { pricingBulkService } from '@/lib/services/pricing-bulk.service';

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await getAuthContext();

    if (!user || !tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const priceListId = formData.get('priceListId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!priceListId) {
      return NextResponse.json({ error: 'priceListId is required' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have at least a header row and one data row' }, { status: 400 });
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    // Convert to BulkImportRow format
    const importRows = rows.map((row) => ({
      product_code: row.product_code || undefined,
      product_id: row.product_id || undefined,
      price: parseFloat(row.price || '0'),
      discount_percent: row.discount_percent ? parseFloat(row.discount_percent) : undefined,
      min_quantity: row.min_quantity ? parseInt(row.min_quantity, 10) : undefined,
      max_quantity: row.max_quantity ? (row.max_quantity === '' ? null : parseInt(row.max_quantity, 10)) : undefined,
    }));

    // Import
    const result = await pricingBulkService.importPriceListItems(priceListId, importRows);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Pricing Import API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import price list items' },
      { status: 500 }
    );
  }
}

