/**
 * PRD-007: Catalog Service Management API
 * Individual price list endpoints (GET, PATCH, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPriceListById,
  updatePriceList,
  deletePriceList,
} from '@/lib/services/catalog.service';
import type { PriceListUpdateRequest } from '@/lib/types/catalog';

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
// GET /api/v1/price-lists/:id - Get Price List
// ==================================================================

/**
 * Get a single price list by ID with items
 *
 * Response: { success: true, data: PriceListWithItems }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getAuthContext();

    const priceList = await getPriceListById(params.id);

    return NextResponse.json({
      success: true,
      data: priceList,
    });
  } catch (error) {
    console.error('Error fetching price list:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message === 'Price list not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch price list' },
      { status: 500 }
    );
  }
}

// ==================================================================
// PATCH /api/v1/price-lists/:id - Update Price List
// ==================================================================

/**
 * Update an existing price list
 *
 * Request Body: PriceListUpdateRequest (partial)
 *
 * Response: { success: true, data: PriceList, message: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getAuthContext();

    const body: Partial<PriceListUpdateRequest> = await request.json();

    // Validate at least one field is being updated
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }

    // Validate date range if both dates are provided
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

    // Validate price_list_type if provided
    if (body.price_list_type) {
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
    }

    // Update price list
    const priceList = await updatePriceList({
      id: params.id,
      ...body,
    });

    return NextResponse.json({
      success: true,
      data: priceList,
      message: 'Price list updated successfully',
    });
  } catch (error) {
    console.error('Error updating price list:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message === 'Price list not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update price list' },
      { status: 500 }
    );
  }
}

// ==================================================================
// DELETE /api/v1/price-lists/:id - Delete Price List
// ==================================================================

/**
 * Delete a price list (hard delete)
 *
 * Response: { success: true, message: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getAuthContext();

    await deletePriceList(params.id);

    return NextResponse.json({
      success: true,
      message: 'Price list deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting price list:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message === 'Price list not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to delete price list' },
      { status: 500 }
    );
  }
}

