/**
 * PRD-007: Catalog Service Management API
 * Price list management endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getPriceLists,
  getPriceListById,
  createPriceList,
  updatePriceList,
  deletePriceList,
} from '@/lib/services/catalog.service';
import type {
  PriceListCreateRequest,
  PriceListUpdateRequest,
} from '@/lib/types/catalog';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

// ==================================================================
// GET /api/v1/price-lists - List Price Lists
// ==================================================================

/**
 * List all price lists for tenant
 *
 * Response: { success: true, data: PriceList[] }
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('pricing:read')(request);
  if (auth instanceof NextResponse) return auth;

  try {

    const priceLists = await getPriceLists();

    return NextResponse.json({
      success: true,
      data: priceLists,
    });
  } catch (error) {
    console.error('Error fetching price lists:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch price lists' },
      { status: 500 }
    );
  }
}

// ==================================================================
// POST /api/v1/price-lists - Create Price List
// ==================================================================

/**
 * Create a new price list
 *
 * Request Body: PriceListCreateRequest
 *
 * Response: { success: true, data: PriceList, message: string }
 * @param request
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission('pricing:create')(request);
  if (auth instanceof NextResponse) return auth;

  try {

    const body: PriceListCreateRequest = await request.json();

    // Validate required fields
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!body.price_list_type) {
      return NextResponse.json(
        { error: 'price_list_type is required' },
        { status: 400 }
      );
    }

    if (
      !['standard', 'express', 'vip', 'seasonal', 'b2b', 'promotional'].includes(
        body.price_list_type
      )
    ) {
      return NextResponse.json(
        {
          error: 'price_list_type must be one of: standard, express, vip, seasonal, b2b, promotional',
        },
        { status: 400 }
      );
    }

    // Validate date range
    if (body.effective_from && body.effective_to) {
      const fromDate = new Date(body.effective_from);
      const toDate = new Date(body.effective_to);

      if (fromDate > toDate) {
        return NextResponse.json(
          { error: 'effective_from must be before or equal to effective_to' },
          { status: 400 }
        );
      }
    }

    // Create price list
    const priceList = await createPriceList(body);

    return NextResponse.json(
      {
        success: true,
        data: priceList,
        message: 'Price list created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating price list:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create price list' },
      { status: 500 }
    );
  }
}

