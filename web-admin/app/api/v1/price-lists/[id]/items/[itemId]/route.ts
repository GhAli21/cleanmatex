/**
 * Price List Item API
 * PUT /api/v1/price-lists/[id]/items/[itemId] - Update item
 * DELETE /api/v1/price-lists/[id]/items/[itemId] - Delete item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    throw new Error('No tenant access found');
  }

  return {
    user,
    tenantId: tenants[0].tenant_id,
    userId: user.id,
  };
}

/**
 * PUT /api/v1/price-lists/[id]/items/[itemId]
 * Update a price list item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { tenantId } = await getAuthContext();
    const { id: priceListId, itemId } = await params;
    const body = await request.json();

    // Validate price if provided
    if (body.price !== undefined) {
      const price = parseFloat(body.price);
      if (isNaN(price) || price < 0) {
        return NextResponse.json(
          { error: 'price must be >= 0' },
          { status: 400 }
        );
      }
    }

    // Validate discount if provided
    if (body.discount_percent !== undefined) {
      const discountPercent = parseFloat(body.discount_percent);
      if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        return NextResponse.json(
          { error: 'discount_percent must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Validate quantity range if provided
    if (body.min_quantity !== undefined) {
      const minQuantity = parseInt(body.min_quantity);
      if (isNaN(minQuantity) || minQuantity < 1) {
        return NextResponse.json(
          { error: 'min_quantity must be >= 1' },
          { status: 400 }
        );
      }

      if (body.max_quantity !== undefined && body.max_quantity !== null) {
        const maxQuantity = parseInt(body.max_quantity);
        if (isNaN(maxQuantity) || maxQuantity < minQuantity) {
          return NextResponse.json(
            { error: 'max_quantity must be >= min_quantity' },
            { status: 400 }
          );
        }
      }
    }

    // Verify item exists and belongs to tenant and price list
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from('org_price_list_items_dtl')
      .select('id, price_list_id')
      .eq('id', itemId)
      .eq('tenant_org_id', tenantId)
      .eq('price_list_id', priceListId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Price list item not found or access denied' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.discount_percent !== undefined) updateData.discount_percent = parseFloat(body.discount_percent);
    if (body.min_quantity !== undefined) updateData.min_quantity = parseInt(body.min_quantity);
    if (body.max_quantity !== undefined) updateData.max_quantity = body.max_quantity ? parseInt(body.max_quantity) : null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Update item
    const { data, error } = await supabase
      .from('org_price_list_items_dtl')
      .update(updateData)
      .eq('id', itemId)
      .eq('tenant_org_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating price list item:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update price list item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/v1/price-lists/[id]/items/[itemId]:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update price list item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/price-lists/[id]/items/[itemId]
 * Delete a price list item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { tenantId } = await getAuthContext();
    const { id: priceListId, itemId } = await params;

    // Verify item exists and belongs to tenant and price list
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from('org_price_list_items_dtl')
      .select('id')
      .eq('id', itemId)
      .eq('tenant_org_id', tenantId)
      .eq('price_list_id', priceListId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Price list item not found or access denied' },
        { status: 404 }
      );
    }

    // Delete item
    const { error } = await supabase
      .from('org_price_list_items_dtl')
      .delete()
      .eq('id', itemId)
      .eq('tenant_org_id', tenantId);

    if (error) {
      console.error('Error deleting price list item:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete price list item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Price list item deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/v1/price-lists/[id]/items/[itemId]:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to delete price list item' },
      { status: 500 }
    );
  }
}

