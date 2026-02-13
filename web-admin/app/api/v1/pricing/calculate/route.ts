/**
 * Price Calculation API
 * POST /api/v1/pricing/calculate
 * Calculate price for order items
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { pricingService } from '@/lib/services/pricing.service';
import type { PriceLookupParams } from '@/lib/types/pricing';

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await getAuthContext();

    if (!user || !tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items, customerId, isExpress } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required' },
        { status: 400 }
      );
    }

    // Calculate price for each item
    const priceResults = await Promise.all(
      items.map((item: { productId: string; quantity: number }) =>
        pricingService.getPriceForOrderItem({
          tenantId,
          productId: item.productId,
          quantity: item.quantity,
          isExpress: isExpress || false,
          customerId,
        })
      )
    );

    // Calculate order totals
    const orderTotals = await pricingService.calculateOrderTotals(
      tenantId,
      items.map((item: { productId: string; quantity: number }) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      { customerId, isExpress: isExpress || false }
    );

    return NextResponse.json({
      success: true,
      data: {
        items: priceResults,
        totals: orderTotals,
      },
    });
  } catch (error: any) {
    console.error('[Pricing Calculate API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate prices' },
      { status: 500 }
    );
  }
}

