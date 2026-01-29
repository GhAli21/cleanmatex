/**
 * Price List Items API
 * POST /api/v1/price-lists/[id]/items - Create item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

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
 * POST /api/v1/price-lists/[id]/items
 * Create a new price list item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await getAuthContext();
    const { id: priceListId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.product_id || !body.price) {
      return NextResponse.json(
        { error: 'product_id and price are required' },
        { status: 400 }
      );
    }

    // Validate price
    const price = parseFloat(body.price);
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: 'price must be >= 0' },
        { status: 400 }
      );
    }

    // Validate discount
    const discountPercent = body.discount_percent ? parseFloat(body.discount_percent) : 0;
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json(
        { error: 'discount_percent must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Validate quantity range
    const minQuantity = body.min_quantity ? parseInt(body.min_quantity) : 1;
    if (minQuantity < 1) {
      return NextResponse.json(
        { error: 'min_quantity must be >= 1' },
        { status: 400 }
      );
    }

    const maxQuantity = body.max_quantity ? parseInt(body.max_quantity) : null;
    if (maxQuantity !== null && maxQuantity < minQuantity) {
      return NextResponse.json(
        { error: 'max_quantity must be >= min_quantity' },
        { status: 400 }
      );
    }

    // Verify price list exists and belongs to tenant
    const supabase = await createClient();
    const { data: priceList, error: priceListError } = await supabase
      .from('org_price_lists_mst')
      .select('id')
      .eq('id', priceListId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (priceListError || !priceList) {
      return NextResponse.json(
        { error: 'Price list not found or access denied' },
        { status: 404 }
      );
    }

    // Verify product exists and belongs to tenant
    const { data: product, error: productError } = await supabase
      .from('org_product_data_mst')
      .select('id')
      .eq('id', body.product_id)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found or inactive' },
        { status: 404 }
      );
    }

    // Insert item
    const { data, error } = await supabase
      .from('org_price_list_items_dtl')
      .insert({
        tenant_org_id: tenantId,
        price_list_id: priceListId,
        product_id: body.product_id,
        price,
        discount_percent: discountPercent,
        min_quantity: minQuantity,
        max_quantity: maxQuantity,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating price list item:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create price list item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error in POST /api/v1/price-lists/[id]/items:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create price list item' },
      { status: 500 }
    );
  }
}

