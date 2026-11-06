/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * OrderPieceService
 * Core business logic for order item pieces operations
 * Handles CRUD operations, batch updates, and sync with order items
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import type { OrderItemPiece } from '@/types/order';
import { log } from '@/lib/utils/logger';
import {
  mapOrderPieceFromDb,
  mapOrderPiecesFromDb,
  type OrderPieceDbModel,
} from '@/lib/mappers/order-piece.mapper';
import { toUICode } from '@/lib/utils/condition-codes';
import { OrderPiecePreferenceService } from '@/lib/services/order-piece-preference.service';
import {
  checkSinglePieceTag,
  mapPieceTagDbError,
  PIECE_TAG_ERROR_CODES,
  type PieceTagErrorCode,
  type PieceTagIssue,
} from '@/lib/services/piece-code/piece-code.service';

/** Default for piece/item preference rows created in create vs edit-order flows */
export type OrderPreferencesSourceDefault = 'ORDER_CREATE' | 'ORDER_EDIT';

/** Prisma transaction client — same shape used in order-service.ts */

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
    /** External tag. Checked like batch-update (HFC P3b). '' or null removes the tag. */
    barcode?: string | null;
    piece_status?: 'intake' | 'processing' | 'qa' | 'ready';
    is_ready?: boolean;
    piece_stage?: string;
    is_rejected?: boolean;
    issue_id?: string;
    rack_location?: string;
    /** Denormalized; DTL sync via {@link OrderPiecePreferenceService.replacePiecePacking} when updated */
    packing_pref_code?: string | null;
    /** Optional tenant catalog id for DTL `preference_id` when saving packing */
    packing_pref_cf_id?: string | null;
    /** ISO string or Date; persisted as timestamptz */
    last_step_at?: Date | string;
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

export interface BulkPieceUpdateEntry {
  pieceId: string;
  orderItemId: string;
  updates: UpdatePieceParams['updates'];
}

export interface BatchUpdatePiecesBulkParams {
  tenantId: string;
  orderId: string;
  updates: BulkPieceUpdateEntry[];
}

/** Columns required by Processing modal / Simple dialog piece surfaces */
export const PROCESSING_PIECE_SELECT = `
  id,
  tenant_org_id,
  order_id,
  order_item_id,
  piece_seq,
  piece_code,
  piece_status,
  piece_stage,
  is_ready,
  is_rejected,
  issue_id,
  last_step,
  last_step_at,
  last_step_by,
  notes,
  rack_location,
  barcode,
  scan_state,
  has_stain,
  has_damage,
  packing_pref_code,
  rec_status
`.replace(/\s+/g, ' ').trim();

const PIECE_HISTORY_TRACKED_KEYS = [
  'piece_status',
  'is_ready',
  'is_rejected',
  'scan_state',
  'rack_location',
  'piece_stage',
  'barcode',
  'notes',
] as const;

export class OrderPieceService {
  /**
   * Merge PIECE-level `org_order_preferences_dtl` rows into mapped pieces (`service_prefs`, `conditions`).
   * Shared by `getPiecesByItem` and `getPiecesByOrder` so all piece list APIs return the same pref shape.
   * Removed preference lineage is retained for Change history and excluded from live piece projections.
   */
  static async attachPieceLevelPreferencesFromDtl(
    supabase: SupabaseClient,
    tenantId: string,
    pieces: OrderItemPiece[]
  ): Promise<OrderItemPiece[]> {
    if (pieces.length === 0) return pieces;

    const pieceIds = pieces.map((p) => p.id);
    const piecePrefsMap: Record<string, Array<{ preference_code: string; source?: string; extra_price: number }>> = {};
    const pieceConditionsMap: Record<string, string[]> = {};
    /** Color prefs live in DTL (`preference_sys_kind=color`); piece.color JSONB is legacy. */
    const pieceColorPrefsMap: Record<string, string[]> = {};
    /** Prefer DTL `packing_prefs` when present (authoritative vs denormalized piece row). */
    const piecePackingFromDtl: Record<string, string> = {};

    const { data: prefs } = await supabase
      .from('org_order_preferences_dtl')
      .select('order_item_piece_id, preference_code, prefs_source, extra_price, preference_sys_kind')
      .eq('tenant_org_id', tenantId)
      .eq('prefs_level', 'PIECE')
      .eq('rec_status', 1)
      .in('order_item_piece_id', pieceIds);

    for (const row of prefs ?? []) {
      const pieceId = row.order_item_piece_id as string;
      const sysKind = row.preference_sys_kind as string | null;
      if (sysKind === 'service_prefs') {
        if (!piecePrefsMap[pieceId]) piecePrefsMap[pieceId] = [];
        piecePrefsMap[pieceId].push({
          preference_code: row.preference_code,
          source: row.prefs_source ?? 'manual',
          extra_price: Number(row.extra_price ?? 0),
        });
      } else if (sysKind === 'color') {
        if (!pieceColorPrefsMap[pieceId]) pieceColorPrefsMap[pieceId] = [];
        if (typeof row.preference_code === 'string' && row.preference_code !== '') {
          pieceColorPrefsMap[pieceId].push(row.preference_code);
        }
      } else if (sysKind === 'packing_prefs') {
        piecePackingFromDtl[pieceId] = row.preference_code;
      } else if (
        sysKind === 'condition_stain' ||
        sysKind === 'condition_damag' ||
        sysKind === 'condition_special'
      ) {
        if (!pieceConditionsMap[pieceId]) pieceConditionsMap[pieceId] = [];
        pieceConditionsMap[pieceId].push(toUICode(row.preference_code));
      }
    }

    return pieces.map((p) => ({
      ...p,
      service_prefs: piecePrefsMap[p.id]?.length ? piecePrefsMap[p.id] : undefined,
      color_prefs: pieceColorPrefsMap[p.id]?.length ? pieceColorPrefsMap[p.id] : undefined,
      conditions: pieceConditionsMap[p.id]?.length ? pieceConditionsMap[p.id] : undefined,
      packing_pref_code: piecePackingFromDtl[p.id] ?? p.packing_pref_code ?? null,
    }));
  }

  /** Attach DTL rows to one piece after a DB read/update so PATCH/GET responses match list payloads. */
  private static async enrichSinglePieceFromDtl(
    supabase: SupabaseClient,
    tenantId: string,
    piece: OrderItemPiece
  ): Promise<OrderItemPiece> {
    const [enriched] = await this.attachPieceLevelPreferencesFromDtl(supabase, tenantId, [piece]);
    return enriched;
  }

  /**
   * Gets the current pieces for an order item.
   * Removed rows are intentionally absent because operational work must follow the live hierarchy.
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
        .eq('rec_status', 1)
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

      const mapped = mapOrderPiecesFromDb(pieces as OrderPieceDbModel[]);
      const enriched = await this.attachPieceLevelPreferencesFromDtl(supabase, tenantId, mapped);
      return { success: true, pieces: enriched };
    } catch (error) {
      log.error(
        '[OrderPieceService] Exception fetching pieces by item',
        error instanceof Error ? error : new Error(String(error)),
        {
          feature: 'order_pieces',
          action: 'get_pieces_by_item',
          tenantId,
          orderItemId,
        }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets the current pieces for an order.
   * Includes packing_pref_code from pieces table and service_prefs from org_order_preferences_dtl.
   * Removed rows are intentionally absent because operational work must follow the live hierarchy.
   */
  static async getPiecesByOrder(
    tenantId: string,
    orderId: string
  ): Promise<{ success: boolean; pieces?: OrderItemPiece[]; error?: string }> {
    try {
      const supabase = await createClient();

      const { data: pieces, error } = await supabase
        .from('org_order_item_pieces_dtl')
        .select(PROCESSING_PIECE_SELECT)
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .eq('rec_status', 1)
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

      const mapped = mapOrderPiecesFromDb(pieces as unknown as OrderPieceDbModel[]);
      const enriched = await this.attachPieceLevelPreferencesFromDtl(supabase, tenantId, mapped);

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
   * Gets one current piece by ID.
   * A removed piece is treated as unavailable to keep operational reads separate from Change history.
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
        .eq('rec_status', 1)
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

      const mapped = mapOrderPieceFromDb(piece as OrderPieceDbModel);
      const enriched = await this.enrichSinglePieceFromDtl(supabase, tenantId, mapped);
      return { success: true, piece: enriched };
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
   * Writes org_order_piece_hist_tr rows for tracked field transitions (migration 0259).
   */
  private static async recordPieceFieldChanges(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    doneBy: string | null
  ): Promise<void> {
    const keys = [
      'piece_status',
      'is_ready',
      'is_rejected',
      'scan_state',
      'rack_location',
      'piece_stage',
      'barcode',
      'notes',
    ] as const;
    for (const key of keys) {
      const prev = before[key];
      const next = after[key];
      if (prev === next) continue;
      const { error } = await supabase.from('org_order_piece_hist_tr').insert({
        tenant_org_id: tenantId,
        order_piece_id: pieceId,
        action_code: key,
        from_value: prev == null ? null : String(prev),
        to_value: next == null ? null : String(next),
        done_by: doneBy,
      });
      if (error) {
        log.error(
          '[OrderPieceService] org_order_piece_hist_tr insert failed',
          new Error(error.message),
          { tenantId, pieceId, key }
        );
      }
    }
  }

  /**
   * Update a single piece
   */
  static async updatePiece(
    params: UpdatePieceParams
  ): Promise<{
    success: boolean;
    piece?: OrderItemPiece;
    error?: string;
    /** HFC P3b: set when the external tag was refused (PIECE_TAG_*). */
    code?: PieceTagErrorCode;
    tagIssue?: PieceTagIssue;
  }> {
    try {
      const supabase = await createClient();

      const { data: beforeRow } = await supabase
        .from('org_order_item_pieces_dtl')
        .select(
          'piece_status,is_ready,is_rejected,scan_state,rack_location,piece_stage,barcode,notes,order_id'
        )
        .eq('id', params.pieceId)
        .eq('tenant_org_id', params.tenantId)
        .maybeSingle();

      // HFC P3b: the external tag gets the same checks as batch-update (A-35..A-37): format, code look-alike,
      // tag already on another live piece. Blank or null removes the tag.
      let normalizedTag: string | null | undefined;
      if (Object.prototype.hasOwnProperty.call(params.updates as object, 'barcode')) {
        const rawTag = params.updates.barcode;
        if (rawTag == null || (typeof rawTag === 'string' && rawTag.trim() === '')) {
          normalizedTag = null;
        } else {
          const tagCheck = await checkSinglePieceTag(
            supabase,
            params.tenantId,
            params.pieceId,
            (beforeRow as { order_id?: string } | null)?.order_id ?? '',
            String(rawTag)
          );
          if (tagCheck.ok === false) {
            return {
              success: false,
              error:
                tagCheck.issue.code === PIECE_TAG_ERROR_CODES.IN_USE ? 'Piece tag already in use' : 'Invalid piece tag',
              code: tagCheck.issue.code,
              tagIssue: tagCheck.issue,
            };
          }
          normalizedTag = tagCheck.tag;
        }
      }

      const packingPrefExplicit = Object.prototype.hasOwnProperty.call(
        params.updates as object,
        'packing_pref_code'
      );
      const packingCfExplicit = Object.prototype.hasOwnProperty.call(
        params.updates as object,
        'packing_pref_cf_id'
      );
      const newPackingCode = packingPrefExplicit
        ? (params.updates as { packing_pref_code?: string | null }).packing_pref_code ?? null
        : undefined;
      const packingCfId = packingCfExplicit
        ? (params.updates as { packing_pref_cf_id?: string | null }).packing_pref_cf_id ?? null
        : undefined;

      const updateData: any = {
        ...params.updates,
        updated_at: new Date().toISOString(),
      };
      if (normalizedTag !== undefined) {
        updateData.barcode = normalizedTag;
      }
      if (packingPrefExplicit) {
        delete updateData.packing_pref_code;
      }
      if (packingCfExplicit) {
        delete updateData.packing_pref_cf_id;
      }

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
        // A tag taken by another request at the same instant is refused by the DB (uq_ord_piece_barcode).
        const tagDbCode = mapPieceTagDbError(error.message);
        if (tagDbCode) {
          return {
            success: false,
            error: tagDbCode === PIECE_TAG_ERROR_CODES.IN_USE ? 'Piece tag already in use' : 'Invalid piece tag',
            code: tagDbCode,
          };
        }
        return { success: false, error: error.message };
      }

      if (beforeRow && piece) {
        const doneBy =
          typeof params.updates.updated_by === 'string' ? params.updates.updated_by : null;
        await OrderPieceService.recordPieceFieldChanges(
          supabase,
          params.tenantId,
          params.pieceId,
          beforeRow as Record<string, unknown>,
          piece as unknown as Record<string, unknown>,
          doneBy
        );
      }

      // Sync quantity_ready on parent item if status changed
      if (params.updates.piece_status || params.updates.is_rejected) {
        const pieceData = mapOrderPieceFromDb(piece as OrderPieceDbModel);
        await this.syncItemQuantityReady(params.tenantId, pieceData.order_item_id);
      }

      const mappedPiece = mapOrderPieceFromDb(piece as OrderPieceDbModel);

      if (packingPrefExplicit && typeof params.updates.updated_by === 'string') {
        const syncPacking = await OrderPiecePreferenceService.replacePiecePacking(
          supabase,
          params.tenantId,
          mappedPiece.order_id,
          mappedPiece.order_item_id,
          params.pieceId,
          newPackingCode ?? null,
          params.updates.updated_by,
          packingCfId
        );
        if (!syncPacking.success) {
          return { success: false, error: syncPacking.error ?? 'Failed to sync packing preference' };
        }
        const { data: freshPiece } = await supabase
          .from('org_order_item_pieces_dtl')
          .select()
          .eq('id', params.pieceId)
          .eq('tenant_org_id', params.tenantId)
          .single();
        if (freshPiece) {
          const mappedFresh = mapOrderPieceFromDb(freshPiece as OrderPieceDbModel);
          const enrichedFresh = await this.enrichSinglePieceFromDtl(
            supabase,
            params.tenantId,
            mappedFresh
          );
          return { success: true, piece: enrichedFresh };
        }
      }

      const enrichedPiece = await this.enrichSinglePieceFromDtl(
        supabase,
        params.tenantId,
        mappedPiece
      );
      return { success: true, piece: enrichedPiece };
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
   * Batch update multiple pieces with one history batch insert and one
   * quantity_ready sync per touched order item (Processing batch-update path).
   */
  static async batchUpdatePiecesBulk(
    params: BatchUpdatePiecesBulkParams
  ): Promise<{
    success: boolean;
    updated?: number;
    errors?: Array<{ pieceId: string; error: string }>;
  }> {
    if (params.updates.length === 0) {
      return { success: true, updated: 0 };
    }

    try {
      const supabase = await createClient();
      const pieceIds = params.updates.map((entry) => entry.pieceId);

      const { data: existingPieces, error: fetchError } = await supabase
        .from('org_order_item_pieces_dtl')
        .select(
          'id, order_item_id, piece_status, is_ready, is_rejected, scan_state, rack_location, piece_stage, barcode, notes'
        )
        .eq('tenant_org_id', params.tenantId)
        .eq('order_id', params.orderId)
        .in('id', pieceIds);

      if (fetchError) {
        return {
          success: false,
          updated: 0,
          errors: [{ pieceId: 'unknown', error: fetchError.message }],
        };
      }

      const beforeById = new Map(
        (existingPieces ?? []).map((row) => [row.id as string, row as Record<string, unknown>])
      );

      const errors: Array<{ pieceId: string; error: string }> = [];
      const historyRows: Array<{
        tenant_org_id: string;
        order_id: string;
        order_item_id: string;
        order_piece_id: string;
        action_code: string;
        from_value: string | null;
        to_value: string | null;
        done_by: string | null;
      }> = [];
      const touchedItemIds = new Set<string>();
      let updatedCount = 0;

      for (const entry of params.updates) {
        const before = beforeById.get(entry.pieceId);
        if (!before) {
          errors.push({ pieceId: entry.pieceId, error: 'Piece not found' });
          continue;
        }

        const updateData: Record<string, unknown> = {
          ...entry.updates,
          updated_at: entry.updates.updated_at ?? new Date().toISOString(),
        };

        if (updateData.last_step_at instanceof Date) {
          updateData.last_step_at = updateData.last_step_at.toISOString();
        }

        const { data: after, error: updateError } = await supabase
          .from('org_order_item_pieces_dtl')
          .update(updateData)
          .eq('id', entry.pieceId)
          .eq('tenant_org_id', params.tenantId)
          .eq('order_id', params.orderId)
          .select(
            'piece_status, is_ready, is_rejected, scan_state, rack_location, piece_stage, barcode, notes'
          )
          .single();

        if (updateError || !after) {
          errors.push({
            pieceId: entry.pieceId,
            error: updateError?.message ?? 'Update failed',
          });
          continue;
        }

        updatedCount++;
        touchedItemIds.add(entry.orderItemId);

        const doneBy =
          typeof entry.updates.updated_by === 'string' ? entry.updates.updated_by : null;

        for (const key of PIECE_HISTORY_TRACKED_KEYS) {
          const prev = before[key];
          const next = (after as Record<string, unknown>)[key];
          if (prev === next) continue;
          historyRows.push({
            tenant_org_id: params.tenantId,
            order_id: params.orderId,
            order_item_id: entry.orderItemId,
            order_piece_id: entry.pieceId,
            action_code: key,
            from_value: prev == null ? null : String(prev),
            to_value: next == null ? null : String(next),
            done_by: doneBy,
          });
        }
      }

      if (historyRows.length > 0) {
        const { error: histError } = await supabase
          .from('org_order_piece_hist_tr')
          .insert(historyRows);
        if (histError) {
          log.error(
            '[OrderPieceService] batchUpdatePiecesBulk history insert failed',
            new Error(histError.message),
            { tenantId: params.tenantId, orderId: params.orderId, rowCount: historyRows.length }
          );
        }
      }

      for (const itemId of touchedItemIds) {
        await this.syncItemQuantityReady(params.tenantId, itemId);
      }

      return {
        success: errors.length === 0,
        updated: updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      log.error(
        '[OrderPieceService] Exception in batchUpdatePiecesBulk',
        error instanceof Error ? error : new Error(String(error)),
        {
          feature: 'order_pieces',
          action: 'batch_update_pieces_bulk',
          tenantId: params.tenantId,
          orderId: params.orderId,
          updateCount: params.updates.length,
        }
      );
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

      // Only live items may contribute to readiness; removed rows remain historical Change evidence.
      const { data: items, error: itemsError } = await supabase
        .from('org_order_items_dtl')
        .select('id')
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .eq('rec_status', 1);

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

      // Count live ready pieces only; removed rows cannot inflate operational readiness.
      const { count, error: countError } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId)
        .eq('rec_status', 1)
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

