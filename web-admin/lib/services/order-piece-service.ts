/**
 * OrderPieceService
 * Core business logic for order item pieces operations
 * Handles CRUD operations, batch updates, and sync with order items
 */

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import type { OrderItemPiece } from '@/types/order';
import { log } from '@/lib/utils/logger';
import {
  mapOrderPieceFromDb,
  mapOrderPiecesFromDb,
  type OrderPieceDbModel,
} from '@/lib/mappers/order-piece.mapper';

/** Prisma transaction client — same shape used in order-service.ts */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface CreatePieceParams {
  tenantId: string;
  orderId: string;
  orderItemId: string;
  pieceSeq: number;
  serviceCategoryCode?: string;
  productId?: string;
  pricePerUnit: number;
  totalPrice: number;
  color?: string;
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePieceParams {
  pieceId: string;
  tenantId: string;
  updates: {
    scan_state?: 'expected' | 'scanned' | 'missing' | 'wrong';
    barcode?: string;
    piece_status?: 'intake' | 'processing' | 'qa' | 'ready';
    is_ready?: boolean;
    piece_stage?: string;
    is_rejected?: boolean;
    issue_id?: string;
    rack_location?: string;
    last_step_at?: Date;
    last_step_by?: string;
    last_step?: string;
    notes?: string;
    color?: string;
    brand?: string;
    has_stain?: boolean;
    has_damage?: boolean;
    metadata?: Record<string, any>;
    updated_at?: string;
    updated_by?: string;
    updated_info?: string;
  };
}

export interface BatchUpdatePiecesParams {
  tenantId: string;
  updates: Array<{
    pieceId: string;
    updates: UpdatePieceParams['updates'];
  }>;
}

export class OrderPieceService {
  /**
   * Create pieces for an order item
   * Auto-creates pieces 1..quantity for order items (pieces are always used)
   * @param piecesData - Optional array of piece-level data. If provided, must match quantity.
   *                     If not provided, uses baseData for all pieces uniformly.
   */
  static async createPiecesForItem(
    tenantId: string,
    orderId: string,
    orderItemId: string,
    quantity: number,
    baseData: {
      serviceCategoryCode?: string;
      productId?: string;
      pricePerUnit: number;
      totalPrice: number;
      color?: string;
      brand?: string;
      hasStain?: boolean;
      hasDamage?: boolean;
      notes?: string;
      metadata?: Record<string, any>;
    },
    piecesData?: Array<{
      pieceSeq: number;
      color?: string;
      brand?: string;
      hasStain?: boolean;
      hasDamage?: boolean;
      notes?: string;
      rackLocation?: string;
      metadata?: Record<string, any>;
      packingPrefCode?: string;
      servicePrefs?: Array<{ preference_code: string; source?: string; extra_price: number }>;
    }>,
    branchId?: string
  ): Promise<{ success: boolean; pieces?: OrderItemPiece[]; error?: string }> {
    try {
      const supabase = await createClient();

      // Verify item exists and belongs to tenant
      const { data: item, error: itemError } = await supabase
        .from('org_order_items_dtl')
        .select('id, order_id, tenant_org_id, quantity, price_per_unit, total_price')
        .eq('id', orderItemId)
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .single();

      if (itemError || !item) {
        return { success: false, error: 'Order item not found' };
      }

      // Calculate price per piece
      const pricePerPiece = baseData.pricePerUnit / quantity;
      const totalPricePerPiece = baseData.totalPrice / quantity;

      // Create pieces array - use piece-level data if provided, otherwise use baseData
      const piecesToInsert = Array.from({ length: quantity }, (_, index) => {
        const pieceSeq = index + 1;
        const pieceData = piecesData?.find(p => p.pieceSeq === pieceSeq);
        const servicePrefCharge = (pieceData?.servicePrefs ?? []).reduce(
          (sum, p) => sum + Number(p.extra_price ?? 0),
          0
        );

        return {
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId,
          branch_id: branchId ?? null,
          piece_seq: pieceSeq,
          service_category_code: baseData.serviceCategoryCode || null,
          product_id: baseData.productId || null,
          scan_state: 'expected' as const,
          barcode: null,
          quantity: 1,
          price_per_unit: pricePerPiece,
          total_price: totalPricePerPiece,
          piece_status: 'processing' as const,
          piece_stage: null,
          is_rejected: false,
          issue_id: null,
          rack_location: pieceData?.rackLocation || null,
          last_step_at: null,
          last_step_by: null,
          last_step: null,
          notes: pieceData?.notes || baseData.notes || null,
          color: pieceData?.color || baseData.color || null,
          brand: pieceData?.brand || baseData.brand || null,
          has_stain: pieceData?.hasStain ?? baseData.hasStain ?? false,
          has_damage: pieceData?.hasDamage ?? baseData.hasDamage ?? false,
          metadata: pieceData?.metadata || baseData.metadata || {},
          packing_pref_code: pieceData?.packingPrefCode || null,
          service_pref_charge: servicePrefCharge,
          created_by: null,
          created_info: null,
          rec_status: 1,
        };
      });

      const { data: pieces, error: insertError } = await supabase
        .from('org_order_item_pieces_dtl')
        .insert(piecesToInsert)
        .select();

      if (insertError) {
        log.error('[OrderPieceService] Error creating pieces', new Error(insertError.message), {
          feature: 'order_pieces',
          action: 'create_pieces',
          tenantId,
          orderId,
          orderItemId,
          quantity,
        });
        return { success: false, error: insertError.message };
      }

      // Insert piece-level service prefs (org_order_item_pc_prefs)
      const createdPieces = pieces as Array<{ id: string; piece_seq: number }>;
      for (const pieceData of piecesData ?? []) {
        const prefs = pieceData.servicePrefs;
        if (!prefs || prefs.length === 0) continue;
        const createdPiece = createdPieces.find((p) => p.piece_seq === pieceData.pieceSeq);
        if (!createdPiece) continue;
        const rows = prefs.map((p) => ({
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId,
          order_item_piece_id: createdPiece.id,
          preference_code: p.preference_code,
          source: p.source ?? 'manual',
          extra_price: Number(p.extra_price ?? 0),
          branch_id: branchId ?? null,
        }));
        const { error: prefsError } = await supabase.from('org_order_item_pc_prefs').insert(rows);
        if (prefsError) {
          log.warn('[OrderPieceService] Failed to insert piece service prefs', {
            feature: 'order_pieces',
            action: 'create_piece_prefs',
            pieceId: createdPiece.id,
            error: prefsError.message,
          });
        }
      }

      // Sync quantity_ready on item (starts at 0)
      await this.syncItemQuantityReady(tenantId, orderItemId);

      return { success: true, pieces: mapOrderPiecesFromDb(pieces as OrderPieceDbModel[]) };
    } catch (error) {
      log.error('[OrderPieceService] Exception creating pieces', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'create_pieces',
        tenantId,
        orderId,
        orderItemId,
        quantity,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create pieces for an order item inside an existing Prisma transaction.
   *
   * Use this instead of `createPiecesForItem` whenever the parent order item was
   * created within the same Prisma transaction (e.g. during order update).  All
   * reads and writes use the transaction client so they are fully atomic with the
   * surrounding transaction and are never affected by transaction isolation issues.
   *
   * `quantity_ready` is intentionally left at 0 — newly created pieces have
   * status "processing", so the count would be 0 regardless.
   */
  static async createPiecesForItemWithTx(
    tx: PrismaTx,
    tenantId: string,
    orderId: string,
    orderItemId: string,
    quantity: number,
    baseData: {
      serviceCategoryCode?: string;
      productId?: string;
      pricePerUnit: number;
      totalPrice: number;
      color?: string;
      brand?: string;
      hasStain?: boolean;
      hasDamage?: boolean;
      notes?: string;
      metadata?: Record<string, any>;
    },
    piecesData?: Array<{
      pieceSeq: number;
      color?: string;
      brand?: string;
      hasStain?: boolean;
      hasDamage?: boolean;
      notes?: string;
      rackLocation?: string;
      metadata?: Record<string, any>;
      packingPrefCode?: string;
      servicePrefs?: Array<{ preference_code: string; source?: string; extra_price: number }>;
    }>,
    branchId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pricePerPiece = baseData.pricePerUnit / quantity;
      const totalPricePerPiece = baseData.totalPrice / quantity;

      const piecesToInsert = Array.from({ length: quantity }, (_, index) => {
        const pieceSeq = index + 1;
        const pieceData = piecesData?.find(p => p.pieceSeq === pieceSeq);
        const servicePrefCharge = (pieceData?.servicePrefs ?? []).reduce(
          (sum, p) => sum + Number(p.extra_price ?? 0),
          0
        );

        return {
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId,
          branch_id: branchId ?? null,
          piece_seq: pieceSeq,
          service_category_code: baseData.serviceCategoryCode ?? null,
          product_id: baseData.productId ?? null,
          scan_state: 'expected',
          barcode: null,
          quantity: 1,
          price_per_unit: pricePerPiece,
          total_price: totalPricePerPiece,
          piece_status: 'processing',
          piece_stage: null,
          is_rejected: false,
          issue_id: null,
          rack_location: pieceData?.rackLocation ?? null,
          last_step_at: null,
          last_step_by: null,
          last_step: null,
          notes: pieceData?.notes ?? baseData.notes ?? null,
          color: pieceData?.color ?? baseData.color ?? null,
          brand: pieceData?.brand ?? baseData.brand ?? null,
          has_stain: pieceData?.hasStain ?? baseData.hasStain ?? false,
          has_damage: pieceData?.hasDamage ?? baseData.hasDamage ?? false,
          metadata: (pieceData?.metadata ?? baseData.metadata ?? {}) as object,
          packing_pref_code: pieceData?.packingPrefCode ?? null,
          service_pref_charge: servicePrefCharge,
          created_by: null,
          created_info: null,
          rec_status: 1,
        };
      });

      await tx.org_order_item_pieces_dtl.createMany({ data: piecesToInsert });

      // Note: Piece-level service prefs (org_order_item_pc_prefs) for order-update flow
      // are not yet persisted here. New-order flow uses createPiecesForItem (Supabase) which does.

      // quantity_ready stays 0 — new pieces are "processing", not "ready"

      return { success: true };
    } catch (error) {
      log.error(
        '[OrderPieceService] Exception creating pieces within transaction',
        error instanceof Error ? error : new Error(String(error)),
        { feature: 'order_pieces', action: 'create_pieces_with_tx', tenantId, orderId, orderItemId, quantity }
      );
      // Re-throw so the enclosing Prisma transaction rolls back atomically
      throw error;
    }
  }

  /**
   * Get all pieces for an order item
   */
  static async getPiecesByItem(
    tenantId: string,
    orderItemId: string
  ): Promise<{ success: boolean; pieces?: OrderItemPiece[]; error?: string }> {
    try {
      const supabase = await createClient();

      const { data: pieces, error } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('*')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId)
        .order('piece_seq', { ascending: true });

      if (error) {
        log.error('[OrderPieceService] Error fetching pieces', new Error(error.message), {
          feature: 'order_pieces',
          action: 'get_pieces_by_item',
          tenantId,
          orderItemId,
        });
        return { success: false, error: error.message };
      }

      return { success: true, pieces: mapOrderPiecesFromDb(pieces as OrderPieceDbModel[]) };
    } catch (error) {
      log.error('[OrderPieceService] Exception fetching pieces', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'get_pieces_by_item',
        tenantId,
        orderItemId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pieces by order ID
   * Includes packing_pref_code from pieces table and service_prefs from org_order_item_pc_prefs
   */
  static async getPiecesByOrder(
    tenantId: string,
    orderId: string
  ): Promise<{ success: boolean; pieces?: OrderItemPiece[]; error?: string }> {
    try {
      const supabase = await createClient();

      const { data: pieces, error } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('*')
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .order('order_item_id', { ascending: true })
        .order('piece_seq', { ascending: true });

      if (error) {
        log.error('[OrderPieceService] Error fetching pieces', new Error(error.message), {
          feature: 'order_pieces',
          action: 'get_pieces_by_order',
          tenantId,
          orderId,
        });
        return { success: false, error: error.message };
      }

      const pieceIds = (pieces ?? []).map((p: { id: string }) => p.id);
      let piecePrefsMap: Record<string, Array<{ preference_code: string; source?: string; extra_price: number }>> = {};

      if (pieceIds.length > 0) {
        const { data: prefs } = await supabase
          .from('org_order_item_pc_prefs')
          .select('order_item_piece_id, preference_code, source, extra_price')
          .eq('tenant_org_id', tenantId)
          .in('order_item_piece_id', pieceIds);

        for (const row of prefs ?? []) {
          const pieceId = row.order_item_piece_id as string;
          if (!piecePrefsMap[pieceId]) piecePrefsMap[pieceId] = [];
          piecePrefsMap[pieceId].push({
            preference_code: row.preference_code,
            source: row.source ?? 'manual',
            extra_price: Number(row.extra_price ?? 0),
          });
        }
      }

      const mapped = mapOrderPiecesFromDb(pieces as OrderPieceDbModel[]);
      const enriched = mapped.map((p) => ({
        ...p,
        service_prefs: piecePrefsMap[p.id]?.length ? piecePrefsMap[p.id] : undefined,
      }));

      return { success: true, pieces: enriched };
    } catch (error) {
      log.error('[OrderPieceService] Exception fetching pieces', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'get_pieces_by_order',
        tenantId,
        orderId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get single piece by ID
   */
  static async getPieceById(
    tenantId: string,
    pieceId: string
  ): Promise<{ success: boolean; piece?: OrderItemPiece; error?: string }> {
    try {
      const supabase = await createClient();

      const { data: piece, error } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('*')
        .eq('tenant_org_id', tenantId)
        .eq('id', pieceId)
        .single();

      if (error) {
        log.error('[OrderPieceService] Error fetching piece', new Error(error.message), {
          feature: 'order_pieces',
          action: 'get_piece_by_id',
          tenantId,
          pieceId,
        });
        return { success: false, error: error.message };
      }

      if (!piece) {
        return { success: false, error: 'Piece not found' };
      }

      return { success: true, piece: mapOrderPieceFromDb(piece as OrderPieceDbModel) };
    } catch (error) {
      log.error('[OrderPieceService] Exception fetching piece', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'get_piece_by_id',
        tenantId,
        pieceId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a single piece
   */
  static async updatePiece(
    params: UpdatePieceParams
  ): Promise<{ success: boolean; piece?: OrderItemPiece; error?: string }> {
    try {
      const supabase = await createClient();

      const updateData: any = {
        ...params.updates,
        updated_at: new Date().toISOString(),
      };

      // Convert Date to ISO string if present
      if (updateData.last_step_at instanceof Date) {
        updateData.last_step_at = updateData.last_step_at.toISOString();
      }
      log.info('[OrderPieceService] [001] updateData', {
        feature: 'order_pieces',
        action: 'update_piece',
        message: 'update Piece Data= tenantId=' + params.tenantId + ', pieceId=' + params.pieceId,
        tenantId: params.tenantId,
        pieceId: params.pieceId,
        updateData: updateData,
      });

      const { data: piece, error } = await supabase
        .from('org_order_item_pieces_dtl')
        .update(updateData)
        .eq('id', params.pieceId)
        .eq('tenant_org_id', params.tenantId)
        //.eq('order_id', params.updates.order_id)
        //.eq('order_item_id', params.updates.order_item_id)
        //.eq('piece_seq', params.updates.piece_seq)
        .select()
        .single();
      log.info('[OrderPieceService] [002] Update Success piece', {
        feature: 'order_pieces',
        action: 'update_piece',
        message: 'Update Success piece= tenantId=' + params.tenantId + ', pieceId=' + params.pieceId,
        tenantId: params.tenantId,
        pieceId: params.pieceId,
        //piece: mapOrderPieceFromDb(piece as OrderPieceDbModel),
      });
      if (error) {
        log.error('[OrderPieceService] Error updating piece', new Error(error.message), {
          feature: 'order_pieces',
          action: 'update_piece',
          tenantId: params.tenantId,
          pieceId: params.pieceId,
        });
        return { success: false, error: error.message };
      }

      // Sync quantity_ready on parent item if status changed
      if (params.updates.piece_status || params.updates.is_rejected) {
        const pieceData = mapOrderPieceFromDb(piece as OrderPieceDbModel);
        await this.syncItemQuantityReady(params.tenantId, pieceData.order_item_id);
      }

      return { success: true, piece: mapOrderPieceFromDb(piece as OrderPieceDbModel) };
    } catch (error) {
      log.error('[OrderPieceService] Exception updating piece', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'update_piece',
        tenantId: params.tenantId,
        pieceId: params.pieceId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch update multiple pieces
   */
  static async batchUpdatePieces(
    params: BatchUpdatePiecesParams
  ): Promise<{
    success: boolean;
    updated?: number;
    errors?: Array<{ pieceId: string; error: string }>;
  }> {
    try {
      const supabase = await createClient();
      const errors: Array<{ pieceId: string; error: string }> = [];
      let updatedCount = 0;

      // Process updates sequentially to maintain consistency
      for (const { pieceId, updates } of params.updates) {
        const result = await this.updatePiece({
          pieceId,
          tenantId: params.tenantId,
          updates,
        });

        if (result.success) {
          updatedCount++;
        } else {
          errors.push({ pieceId, error: result.error || 'Unknown error' });
        }
      }

      return {
        success: errors.length === 0,
        updated: updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      log.error('[OrderPieceService] Exception batch updating pieces', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'batch_update_pieces',
        tenantId: params.tenantId,
        updateCount: params.updates.length,
      });
      return {
        success: false,
        updated: 0,
        errors: [
          {
            pieceId: 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Mark piece as ready
   */
  static async markPieceReady(
    tenantId: string,
    pieceId: string,
    userId?: string
  ): Promise<{ success: boolean; piece?: OrderItemPiece; error?: string }> {
    return this.updatePiece({
      pieceId,
      tenantId,
      updates: {
        piece_status: 'ready',
        updated_by: userId,
      },
    });
  }

  /**
   * Reject a piece
   */
  static async rejectPiece(
    tenantId: string,
    pieceId: string,
    issueId?: string,
    userId?: string,
    notes?: string
  ): Promise<{ success: boolean; piece?: OrderItemPiece; error?: string }> {
    return this.updatePiece({
      pieceId,
      tenantId,
      updates: {
        is_rejected: true,
        issue_id: issueId,
        notes: notes,
        updated_by: userId,
      },
    });
  }

  /**
   * Sync quantity_ready for all items in an order
   */
  static async syncOrderItemsQuantityReady(
    tenantId: string,
    orderId: string
  ): Promise<{
    success: boolean;
    synced?: number;
    errors?: Array<{ itemId: string; error: string }>;
  }> {
    try {
      const supabase = await createClient();

      // Get all items for the order
      const { data: items, error: itemsError } = await supabase
        .from('org_order_items_dtl')
        .select('id')
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId);

      if (itemsError) {
        return { success: false, errors: [{ itemId: 'unknown', error: itemsError.message }] };
      }

      const errors: Array<{ itemId: string; error: string }> = [];
      let syncedCount = 0;

      // Sync each item
      for (const item of items || []) {
        const result = await this.syncItemQuantityReady(tenantId, item.id);
        if (result.success) {
          syncedCount++;
        } else {
          errors.push({ itemId: item.id, error: result.error || 'Unknown error' });
        }
      }

      return {
        success: errors.length === 0,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      log.error('[OrderPieceService] Exception syncing order items', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'sync_order_items',
        tenantId,
        orderId,
      });
      return {
        success: false,
        synced: 0,
        errors: [
          {
            itemId: 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Sync quantity_ready on order item based on piece statuses
   */
  static async syncItemQuantityReady(
    tenantId: string,
    orderItemId: string
  ): Promise<{ success: boolean; quantityReady?: number; error?: string }> {
    try {
      const supabase = await createClient();

      // Count ready pieces (status='ready' AND is_rejected=false)
      const { count, error: countError } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId)
        .eq('piece_status', 'ready')
        .eq('is_rejected', false);

      if (countError) {
        log.error('[OrderPieceService] Error counting ready pieces', new Error(countError.message), {
          feature: 'order_pieces',
          action: 'sync_quantity_ready',
          tenantId,
          orderItemId,
        });
        return { success: false, error: countError.message };
      }

      const quantityReady = count || 0;

      // Update item's quantity_ready
      const { error: updateError } = await supabase
        .from('org_order_items_dtl')
        .update({ quantity_ready: quantityReady })
        .eq('id', orderItemId)
        .eq('tenant_org_id', tenantId);

      if (updateError) {
        log.error('[OrderPieceService] Error updating quantity_ready', new Error(updateError.message), {
          feature: 'order_pieces',
          action: 'sync_quantity_ready',
          tenantId,
          orderItemId,
        });
        return { success: false, error: updateError.message };
      }

      return { success: true, quantityReady };
    } catch (error) {
      log.error('[OrderPieceService] Exception syncing quantity_ready', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'sync_quantity_ready',
        tenantId,
        orderItemId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a piece (soft delete by setting rec_status=0)
   */
  static async deletePiece(
    tenantId: string,
    pieceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Get piece to find order_item_id for sync
      const { data: piece } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('order_item_id')
        .eq('id', pieceId)
        .eq('tenant_org_id', tenantId)
        .single();

      // Soft delete
      const { error } = await supabase
        .from('org_order_item_pieces_dtl')
        .update({ rec_status: 0, updated_at: new Date().toISOString() })
        .eq('id', pieceId)
        .eq('tenant_org_id', tenantId);

      if (error) {
        log.error('[OrderPieceService] Error deleting piece', new Error(error.message), {
          feature: 'order_pieces',
          action: 'delete_piece',
          tenantId,
          pieceId,
        });
        return { success: false, error: error.message };
      }

      // Sync quantity_ready if piece was deleted
      if (piece) {
        await this.syncItemQuantityReady(tenantId, piece.order_item_id);
      }

      return { success: true };
    } catch (error) {
      log.error('[OrderPieceService] Exception deleting piece', error instanceof Error ? error : new Error(String(error)), {
        feature: 'order_pieces',
        action: 'delete_piece',
        tenantId,
        pieceId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

