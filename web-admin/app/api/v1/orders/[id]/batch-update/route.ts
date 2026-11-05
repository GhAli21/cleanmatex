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
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { log } from '@/lib/utils/logger';
import {
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { blockCommittedCommercialWrite, committedCommercialEchoChanged } from '@/lib/services/order-change/order-change-legacy-writer-guard';
import {
  PIECE_TAG_ERROR_CODES,
  PieceCodeService,
  mapPieceTagDbError,
} from '@/lib/services/piece-code/piece-code.service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
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
    const { updates, itemQuantityReady, orderRackLocation, lockerLocation, lockerCode, bagCount, hangingCount } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Invalid request: updates array required' },
        { status: 400 }
      );
    }

    if (bagCount !== undefined && (!Number.isInteger(bagCount) || bagCount < 1 || bagCount > 100)) {
      return NextResponse.json(
        { error: 'Invalid request: bagCount must be an integer between 1 and 100' },
        { status: 400 }
      );
    }

    if (hangingCount !== undefined && (!Number.isInteger(hangingCount) || hangingCount < 0)) {
      return NextResponse.json(
        { error: 'Invalid request: hangingCount must be a non-negative integer' },
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

    const retiredWrite = await blockCommittedCommercialWrite(tenantId, orderId);
    if (retiredWrite) {
      const pieceIds = updates.map((update) => update.pieceId).filter((id): id is string => Boolean(id));
      if (pieceIds.length > 0) {
        const { data: currentPieces } = await supabase
          .from('org_order_item_pieces_dtl')
          .select('id, notes, has_stain, has_damage')
          .eq('tenant_org_id', tenantId)
          .eq('order_id', orderId)
          .in('id', pieceIds);
        const byId = new Map((currentPieces ?? []).map((piece) => [piece.id, piece]));
        for (const update of updates) {
          const current = byId.get(update.pieceId);
          if (!current) continue;
          if (committedCommercialEchoChanged(current, update)) {
            return NextResponse.json(retiredWrite.body, { status: retiredWrite.status });
          }
          delete update.notes;
          delete update.has_stain;
          delete update.has_damage;
          delete update.color;
          delete update.brand;
        }
      }
    }

    // HFC P3 (A-38): every external tag (piece barcode) of the batch is checked before anything is written:
    // format and normalising (A-36), code look-alike (A-37), the same tag on two pieces of the batch, and a tag
    // already on another live piece (A-35). If any fails, nothing is saved and all problems are returned in `issues`.
    // 400 PIECE_TAG_INVALID / PIECE_TAG_LOOKS_LIKE_CODE; 409 PIECE_TAG_DUPLICATE_IN_BATCH / PIECE_TAG_IN_USE.
    const tagEntries = updates
      .map((update, index) => ({ update, index }))
      .filter(({ update }) => typeof update.barcode === 'string' && update.barcode !== '')
      .map(({ update, index }) => ({
        index,
        raw: update.barcode as string,
        target: { pieceId: update.pieceId, orderId, itemId: update.itemId, pieceNumber: update.pieceNumber },
      }));
    if (tagEntries.length > 0) {
      const tagCheck = await PieceCodeService.validateBatchTags(supabase, tenantId, tagEntries);
      if (tagCheck.issues.length > 0) {
        const formatIssue = tagCheck.issues.find(
          (i) => i.code === PIECE_TAG_ERROR_CODES.INVALID || i.code === PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE
        );
        const first = formatIssue ?? tagCheck.issues[0];
        return NextResponse.json(
          {
            error: first.code === PIECE_TAG_ERROR_CODES.IN_USE || first.code === PIECE_TAG_ERROR_CODES.DUPLICATE_IN_BATCH
              ? 'Piece tag already in use'
              : 'Invalid piece tag',
            code: first.code,
            tag: first.tag,
            reason: first.reason,
            heldByPieceCode: first.heldByPieceCode,
            issues: tagCheck.issues,
            piecesUpdated: 0,
          },
          { status: formatIssue ? 400 : 409 }
        );
      }
      for (const entry of tagEntries) {
        const tag = tagCheck.tags.get(entry.index);
        if (tag) updates[entry.index].barcode = tag;
      }
    }

    // Pieces are always used; always update piece-level data
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

    const bulkEntries: Array<{
      pieceId: string;
      orderItemId: string;
      updates: Parameters<typeof OrderPieceService.batchUpdatePiecesBulk>[0]['updates'][number]['updates'];
    }> = [];

    // Always update pieces in database
    for (const [itemId, pieceUpdates] of itemUpdatesMap.entries()) {
      const pieceUpdatesForService = await Promise.all(
        pieceUpdates.map(async (update) => {
          let actualPieceId = update.pieceId;

          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            update.pieceId
          );

          let currentPiece: { piece_status?: string; is_ready?: boolean | null } | null = null;

          if (!isUUID) {
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
                tenantId,
                orderId,
                itemId,
                pieceNumber: update.pieceNumber,
                pieceId: update.pieceId,
              });
              actualPieceId = existingPiece.id;
              currentPiece = existingPiece;
            } else {
              log.warn('[BatchUpdate] [003] Piece not found, skipping', {
                feature: 'order_pieces',
                action: 'batch_update_piece_not_found',
                pieceError,
                tenantId,
                orderId,
                itemId,
                pieceNumber: update.pieceNumber,
                pieceId: update.pieceId,
              });
              return null;
            }
          } else {
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

          const currentStatus = currentPiece?.piece_status as
            | 'intake'
            | 'processing'
            | 'qa'
            | 'ready'
            | undefined;
          let finalPieceStatus: 'intake' | 'processing' | 'qa' | 'ready' = update.currentStep
            ? 'processing'
            : (currentStatus || 'processing');
          let finalIsReady =
            update.is_ready ?? update.isReady ?? currentPiece?.is_ready ?? false;

          if (finalIsReady === true && finalPieceStatus === 'processing') {
            finalPieceStatus = 'ready';
          }
          if (finalIsReady === false && finalPieceStatus === 'ready') {
            finalPieceStatus = 'processing';
          }

          return {
            pieceId: actualPieceId,
            orderItemId: itemId,
            updates: {
              piece_status: finalPieceStatus,
              is_ready: finalIsReady,
              last_step: update.currentStep || undefined,
              piece_stage: update.piece_stage || undefined,
              rack_location: update.rackLocation || undefined,
              notes: update.notes || undefined,
              is_rejected: update.isRejected ?? undefined,
              barcode: update.barcode || undefined,
              has_stain: update.has_stain ?? undefined,
              has_damage: update.has_damage ?? undefined,
              updated_at: new Date().toISOString(),
              updated_by: userId,
              updated_info:
                authCheck.userName +
                ' updated piece_status=' +
                finalPieceStatus +
                ', is_ready=' +
                finalIsReady +
                ', last_step=' +
                update.currentStep +
                ', piece_stage=' +
                update.piece_stage +
                ', rack_location=' +
                update.rackLocation +
                ', notes=' +
                update.notes +
                ', is_rejected=' +
                update.isRejected +
                ', barcode=' +
                update.barcode +
                ', has_stain=' +
                update.has_stain +
                ', has_damage=' +
                update.has_damage || undefined,
            },
          };
        })
      );

      const validUpdates = pieceUpdatesForService.filter(
        (u): u is NonNullable<typeof u> => u !== null
      );

      if (validUpdates.length === 0) {
        continue;
      }

      bulkEntries.push(...validUpdates);

      readyCount += pieceUpdates.filter((p) => p.isReady || p.is_ready === true).length;
      stepsRecorded += new Set(
        pieceUpdates.filter((p) => p.currentStep).map((p) => p.currentStep)
      ).size;
      rackLocationsSet += pieceUpdates.filter((p) => p.rackLocation).length;
      itemsUpdated++;
    }

    if (bulkEntries.length > 0) {
      const batchResult = await OrderPieceService.batchUpdatePiecesBulk({
        tenantId,
        orderId,
        updates: bulkEntries,
      });

      if (!batchResult.success && batchResult.errors?.length) {
        log.warn('[BatchUpdate] bulk update partial failure', {
          feature: 'order_pieces',
          action: 'batch_update_bulk',
          tenantId,
          orderId,
          errors: batchResult.errors,
        });
      }

      // HFC P3 (A-38, accepted risk): pieces are saved one by one. Only a tag taken by another request at the same
      // instant (after the full check above) is refused by the DB (uq_ord_piece_barcode); pieces saved before it
      // stay saved, and the response says how many (piecesUpdated). The caller fixes the tag and retries.
      const tagDbError = (batchResult.errors ?? [])
        .map((e) => mapPieceTagDbError(e.error))
        .find((code) => code !== null);
      if (tagDbError) {
        return NextResponse.json(
          {
            error: tagDbError === PIECE_TAG_ERROR_CODES.IN_USE ? 'Piece tag already in use' : 'Invalid piece tag',
            code: tagDbError,
            partial: (batchResult.updated ?? 0) > 0,
            piecesUpdated: batchResult.updated ?? 0,
          },
          { status: tagDbError === PIECE_TAG_ERROR_CODES.IN_USE ? 409 : 400 }
        );
      }

      piecesUpdated = batchResult.updated ?? 0;
    }

    // Update order-level rack/locker/bag/hanging fields if any were provided
    if (
      orderRackLocation !== undefined ||
      lockerLocation !== undefined ||
      lockerCode !== undefined ||
      bagCount !== undefined ||
      hangingCount !== undefined
    ) {
      await supabase
        .from('org_orders_mst')
        .update({
          ...(orderRackLocation !== undefined ? { rack_location: orderRackLocation } : {}),
          ...(lockerLocation !== undefined ? { locker_location: lockerLocation } : {}),
          ...(lockerCode !== undefined ? { locker_code: lockerCode } : {}),
          ...(bagCount !== undefined ? { bag_count: bagCount } : {}),
          ...(hangingCount !== undefined ? { hanging_count: hangingCount } : {}),
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
        // Prefer graph action COMPLETE_PACKING when order is on packing screen status.
        try {
          const available = await listAvailableActions({
            tenantId,
            orderId,
            screen: 'packing',
          });
          const canPack = available.actions.some(
            (a) => a.actionCode === WORKFLOW_ACTIONS.COMPLETE_PACKING && a.enabled,
          );
          if (canPack) {
            await executeAction({
              tenantId,
              orderId,
              screen: 'packing',
              actionCode: WORKFLOW_ACTIONS.COMPLETE_PACKING,
              expectedStateVersion: available.stateVersion,
              actorUserId: userId,
              input: {
                reason: 'All items ready',
                rack_location: orderRackLocation,
              },
              idempotencyKey: `batch-auto-ready:${orderId}:${available.stateVersion}`,
            });
          } else {
            log.warn('[BatchUpdate] auto-ready skipped - COMPLETE_PACKING not available', {
              feature: 'order_pieces',
              action: 'batch_update_auto_ready_v2',
              tenantId,
              orderId,
              currentStatus: available.currentStatus,
            });
          }
        } catch (engineErr) {
          log.warn('[BatchUpdate] auto-ready engine failed', {
            feature: 'order_pieces',
            action: 'batch_update_auto_ready_v2',
            tenantId,
            orderId,
            error: engineErr instanceof Error ? engineErr.message : String(engineErr),
          });
        }
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
