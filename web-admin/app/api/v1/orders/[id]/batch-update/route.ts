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
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { tenantSettingsService } from '@/lib/services/tenant-settings.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { log } from '@/lib/utils/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let orderId: string | undefined;
  let tenantId: string | undefined;

  try {
    const resolvedParams = await params;
    orderId = resolvedParams.id;

    // Validate CSRF token
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) {
      return csrfResponse;
    }

    // Verify authentication and permissions
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Unauthorized or permission denied
    }
    tenantId = authCheck.tenantId;
    const { userId } = authCheck;

    // Apply rate limiting (per tenant)
    const rateLimitResponse = await checkAPIRateLimitTenant(tenantId);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();

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
      log.error('[BatchUpdate] [001] Order not found or access denied', orderError instanceof Error ? orderError : new Error(String(orderError)), {
        orderError,
        order,
        tenantId,
        orderId,
      });
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      );
    }

    // Check if piece tracking is enabled
    let trackByPiece = await tenantSettingsService.checkIfSettingAllowed(
      tenantId,
      'USE_TRACK_BY_PIECE'
    );

    trackByPiece = true;

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

    // Update pieces if tracking is enabled, otherwise update items
    if (trackByPiece) {
      // Use OrderPieceService to update pieces in database
      for (const [itemId, pieceUpdates] of itemUpdatesMap.entries()) {
        // Resolve piece IDs - if pieceId is not a UUID, find by itemId + pieceNumber
        const pieceUpdatesForService = await Promise.all(
          pieceUpdates.map(async (update) => {
            let actualPieceId = update.pieceId;

            // Check if pieceId is a UUID (DB ID)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(update.pieceId);

            // Get current piece data to check piece_status and is_ready
            let currentPiece: any = null;

            if (!isUUID) {

              // Generated ID format: itemId-piece-N
              // Find piece by itemId + piece_seq
              const { data: existingPiece, error: pieceError } = await supabase
                .from('org_order_item_pieces_dtl')
                .select('id, piece_status, is_ready')
                .eq('tenant_org_id', tenantId)
                .eq('order_item_id', itemId)
                .eq('piece_seq', update.pieceNumber)
                .eq('order_id', orderId)
                .single();

              if (!pieceError && existingPiece) {
                log.info('[BatchUpdate] [002] Piece found', {
                  feature: 'order_pieces',
                  action: 'batch_update_piece_found',
                  message: 'pieceError=' + pieceError?.message + ', existingPiece=' + JSON.stringify(existingPiece),
                  pieceError,
                  existingPiece,
                  tenantId,
                  orderId,
                  itemId,
                  pieceNumber: update.pieceNumber,
                  pieceId: update.pieceId,
                });
                actualPieceId = existingPiece.id;
                currentPiece = existingPiece;
              } else {
                // Piece doesn't exist yet - will need to create it
                // For now, skip and log - pieces should be auto-created when item is created
                log.warn('[BatchUpdate] [003] Piece not found, skipping', {
                  feature: 'order_pieces',
                  action: 'batch_update_piece_not_found',
                  message: 'pieceError=' + pieceError?.message,
                  pieceError,
                  tenantId,
                  orderId,
                  itemId,
                  pieceNumber: update.pieceNumber,
                  pieceId: update.pieceId,
                  //error: pieceError?.message,
                });
                return null;
              }
            } else {// UUID-based IDs
              // Fetch current piece data for UUID-based IDs
              const { data: existingPiece } = await supabase
                .from('org_order_item_pieces_dtl')
                .select('piece_status, is_ready')
                .eq('id', actualPieceId)
                .eq('tenant_org_id', tenantId)
                .eq('order_id', orderId)
                .eq('order_item_id', itemId)
                .single();

              if (existingPiece) {
                currentPiece = existingPiece;
              }
            }

            // Determine piece_status and is_ready based on rules
            const currentStatus = currentPiece?.piece_status as 'intake' | 'processing' | 'qa' | 'ready' | undefined;
            let finalPieceStatus: 'intake' | 'processing' | 'qa' | 'ready' = update.currentStep ? 'processing' : (currentStatus || 'processing');
            // Use is_ready if provided, otherwise fall back to isReady, then current value, then false
            let finalIsReady = update.is_ready ?? update.isReady ?? currentPiece?.is_ready ?? false;
            log.info('[BatchUpdate] [004] Final piece status', {
              feature: 'order_pieces',
              action: 'batch_update_final_piece_status',
              message: 'currentStatus=' + currentStatus + ', finalPieceStatus=' + finalPieceStatus + ', finalIsReady=' + finalIsReady,
              currentStatus,
              finalPieceStatus,
              currentPiece,
              finalIsReady,
              tenantId,
              orderId,
              itemId,
              pieceNumber: update.pieceNumber,
              pieceId: update.pieceId,
            });
            // Apply rules:
            // 1. If is_ready=true and piece_status='processing', set piece_status='ready'
            if (finalIsReady === true && finalPieceStatus === 'processing') {
              finalPieceStatus = 'ready';
              log.info('[BatchUpdate] [005] Final piece status', {
                feature: 'order_pieces',
                action: 'batch_update_final_piece_status',
                message: 'Final piece status set to ready',
                currentStatus,
                finalPieceStatus,
                currentPiece,
                finalIsReady,
                tenantId,
                orderId,
                itemId,
                pieceNumber: update.pieceNumber,
                pieceId: update.pieceId,
              });
            }
            // 2. If is_ready=false and piece_status='ready', set piece_status='processing'
            if (finalIsReady === false && finalPieceStatus === 'ready') {
              finalPieceStatus = 'processing';
              log.info('[BatchUpdate] [006] Final piece status', {
                feature: 'order_pieces',
                action: 'batch_update_final_piece_status',
                message: 'Final piece status set to processing  because is_ready=false and finalPieceStatus=ready',
                currentStatus,
                finalPieceStatus,
                currentPiece,
                finalIsReady,
                tenantId,
                orderId,
                itemId,
                pieceNumber: update.pieceNumber,
                pieceId: update.pieceId,
              });
            }

            return {
              pieceId: actualPieceId,
              updates: {
                piece_status: finalPieceStatus as 'intake' | 'processing' | 'qa' | 'ready',
                is_ready: finalIsReady,
                last_step: update.currentStep || undefined,
                rack_location: update.rackLocation || undefined,
                notes: update.notes || undefined,
                is_rejected: update.isRejected ?? undefined,
                color: update.color || undefined,
                brand: update.brand || undefined,
                barcode: update.barcode || undefined,
                has_stain: update.has_stain ?? undefined,
                has_damage: update.has_damage ?? undefined,
                updated_at: new Date().toISOString(),
                updated_by: userId,
                updated_info: authCheck.userName + ' updated piece_status=' + finalPieceStatus + ', is_ready=' + finalIsReady + ', last_step=' + update.currentStep + ', rack_location=' + update.rackLocation + ', notes=' + update.notes + ', is_rejected=' + update.isRejected + ', color=' + update.color + ', brand=' + update.brand + ', barcode=' + update.barcode + ', has_stain=' + update.has_stain + ', has_damage=' + update.has_damage || undefined,
              },
            };
          })
        );

        // Filter out null entries (pieces that don't exist)
        const validUpdates = pieceUpdatesForService.filter((u): u is NonNullable<typeof u> => u !== null);
        log.info('[BatchUpdate] [008] Valid updates', {
          feature: 'order_pieces',
          action: 'batch_update_valid_updates',
          message: 'validUpdates=' + validUpdates.length + ', pieceUpdatesForService=' + pieceUpdatesForService.length,
          //JSON.stringify(validUpdates) + ', pieceUpdatesForService=' + JSON.stringify(pieceUpdatesForService),
          validUpdatesCount: validUpdates.length,
          pieceUpdatesForServiceCount: pieceUpdatesForService.length,
          tenantId,
          orderId,
          itemId: itemId,
        });

        if (validUpdates.length === 0) {
          continue; // Skip if no valid updates
        }

        const batchResult = await OrderPieceService.batchUpdatePieces({
          tenantId,
          updates: validUpdates,
        });

        if (batchResult.success) {
          piecesUpdated += batchResult.updated || 0;

          // Sync quantity_ready for this item
          await OrderPieceService.syncItemQuantityReady(tenantId, itemId);

          // Count ready pieces
          const readyPieces = pieceUpdates.filter(p => p.isReady).length;
          readyCount += readyPieces;

          // Count steps
          const stepsSet = new Set(pieceUpdates.filter(p => p.currentStep).map(p => p.currentStep));
          stepsRecorded += stepsSet.size;

          // Count rack locations
          const rackLocations = pieceUpdates.filter(p => p.rackLocation).length;
          rackLocationsSet += rackLocations;

          itemsUpdated++;
        }
      }
    } else { // trackByPiece is false
      // Legacy: Update items metadata (backward compatibility)
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
            item_last_step_by: userId,
            metadata: {
              ...pieceMetadata,
              updated_at: new Date().toISOString(),
              updated_by: userId,
            },
          })
          .eq('id', itemId)
          .eq('tenant_org_id', tenantId);

        if (updateError) {
          log.error('[Batch Update] [007] Error updating item', new Error(updateError.message), {
            feature: 'order_pieces',
            action: 'batch_update_item',
            tenantId,
            orderId,
            itemId,
          });
          continue;
        }

        itemsUpdated++;
        piecesUpdated += pieceUpdates.length;
        readyCount += itemReadyCount;
        stepsRecorded += stepsSet.size;
        rackLocationsSet += rackLocationsForItem.length;
      }
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
        item => (item.quantity_ready ?? 0) >= (item.quantity ?? 0)
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
            done_by: userId,
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
    log.error('[Batch Update] Error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_pieces',
      action: 'batch_update',
      tenantId,
      orderId,
    });
    return NextResponse.json(
      {
        error: 'Failed to update order',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
