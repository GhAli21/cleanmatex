/**
 * Import All Products with Default Prices API
 * POST /api/v1/pricing/import-all-products
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

        const body = await request.json();
        const { priceListId, priceListType, overwriteExisting } = body;

        if (!priceListId) {
            return NextResponse.json({ error: 'priceListId is required' }, { status: 400 });
        }

        if (!priceListType) {
            return NextResponse.json({ error: 'priceListType is required' }, { status: 400 });
        }

        // Import all products with default prices
        const result = await pricingBulkService.importAllProductsWithDefaults(
            priceListId,
            priceListType,
            overwriteExisting || false,
            tenantId
        );

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Pricing Import All Products API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to import products' },
            { status: 500 }
        );
    }
}

