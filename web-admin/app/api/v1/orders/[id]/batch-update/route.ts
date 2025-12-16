/**
 * Batch Update API Route
 *
 * POST /api/v1/orders/[id]/batch-update
 *
 * Batch update multiple pieces/items for an order.
 * Updates ready status, processing steps, notes, and rack locations.
 * Calculates and updates quantity_ready per item.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BatchUpdateRequest, PieceUpdate } from '@/types/order';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const orderId = params.id;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant from user metadata
    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant found for user' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: BatchUpdateRequest = await request.json();
    const { updates, itemQuantityReady, orderRackLocation } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Invalid request: updates array required' },
        { status: 400 }
      );
    }

    // Verify order belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id, tenant_org_id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      );
    }

    // Group updates by itemId
    const itemUpdatesMap = new Map<string, PieceUpdate[]>();
    updates.forEach(update => {
      const existing = itemUpdatesMap.get(update.itemId) || [];
      existing.push(update);
      itemUpdatesMap.set(update.itemId, existing);
    });

    let piecesUpdated = 0;
    let itemsUpdated = 0;
    let readyCount = 0;
    let stepsRecorded = 0;
    let rackLocationsSet = 0;

    // Update each item's quantity_ready and metadata
    for (const [itemId, pieceUpdates] of itemUpdatesMap.entries()) {
      // Calculate ready count for this item
      const itemReadyCount = itemQuantityReady?.[itemId] ||
        pieceUpdates.filter(p => p.isReady).length;

      // Collect step updates
      const stepsSet = new Set(
        pieceUpdates
          .filter(p => p.currentStep)
          .map(p => p.currentStep)
      );

      // Collect rack locations
      const rackLocationsForItem = pieceUpdates
        .filter(p => p.rackLocation)
        .map(p => p.rackLocation);

      // Build metadata object with piece states
      const pieceMetadata = pieceUpdates.reduce((acc, piece) => {
        acc[`piece_${piece.pieceNumber}`] = {
          isReady: piece.isReady,
          currentStep: piece.currentStep,
          notes: piece.notes,
          rackLocation: piece.rackLocation,
        };
        return acc;
      }, {} as Record<string, any>);

      // Update the item
      const { error: updateError } = await supabase
        .from('org_order_items_dtl')
        .update({
          quantity_ready: itemReadyCount,
          item_last_step: pieceUpdates.find(p => p.currentStep)?.currentStep || null,
          item_last_step_at: new Date().toISOString(),
          item_last_step_by: user.id,
          metadata: {
            ...pieceMetadata,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
        })
        .eq('id', itemId)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        console.error('Error updating item:', updateError);
        continue;
      }

      itemsUpdated++;
      piecesUpdated += pieceUpdates.length;
      readyCount += itemReadyCount;
      stepsRecorded += stepsSet.size;
      rackLocationsSet += rackLocationsForItem.length;
    }

    // Update order-level rack location if provided
    if (orderRackLocation !== undefined) {
      await supabase
        .from('org_orders_mst')
        .update({
          rack_location: orderRackLocation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId);
    }

    // Check if all items are ready and auto-transition to READY
    const { data: allItems } = await supabase
      .from('org_order_items_dtl')
      .select('quantity, quantity_ready')
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId);

    if (allItems) {
      const allReady = allItems.every(
        item => item.quantity_ready >= item.quantity
      );

      if (allReady && orderRackLocation) {
        // Auto-transition to READY
        await supabase
          .from('org_orders_mst')
          .update({
            status: 'ready',
            current_status: 'ready',
            ready_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .eq('tenant_org_id', tenantId);

        // Log history
        await supabase
          .from('org_order_history')
          .insert({
            tenant_org_id: tenantId,
            order_id: orderId,
            action_type: 'STATUS_CHANGE',
            from_value: 'processing',
            to_value: 'ready',
            done_by: user.id,
            done_at: new Date().toISOString(),
            payload: {
              reason: 'All items ready',
              rack_location: orderRackLocation,
            },
          });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        piecesUpdated,
        itemsUpdated,
        readyCount,
        stepsRecorded,
        rackLocationsSet,
      },
    });

  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update order',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
