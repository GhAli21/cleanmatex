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
import { getConditionPrefKind, toUICode } from '@/lib/utils/condition-codes';
import { effectivePieceColorsForPersist } from '@/lib/utils/order-piece-color-persist';
import { OrderPiecePreferenceService } from '@/lib/services/order-piece-preference.service';
import {
  fetchOrgServicePreferenceCfIdsByCodesPrismaTx,
  fetchOrgServicePreferenceCfIdsByCodesSupabase,
} from '@/lib/utils/org-service-preference-cf-lookup';

/** Default for piece/item preference rows created in create vs edit-order flows */
export type OrderPreferencesSourceDefault = 'ORDER_CREATE' | 'ORDER_EDIT';

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

export class OrderPieceService {
  /**
   * Merge PIECE-level `org_order_preferences_dtl` rows into mapped pieces (`service_prefs`, `conditions`).
   * Shared by `getPiecesByItem` and `getPiecesByOrder` so all piece list APIs return the same pref shape.
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
   * Create pieces for an order item
   * Auto-creates pieces 1..quantity for order items (pieces are always used)
   * @param tenantId - Tenant organization ID
   * @param orderId - Parent order ID
   * @param orderItemId - Order line item ID
   * @param quantity - Number of pieces to create
   * @param baseData - Default field values applied to each piece
   * @param piecesData - Optional per-piece overrides; length must match quantity when provided
   * @param branchId - Optional branch scope for preferences
   * @param supabaseClient - Optional service-role client when caller has no staff JWT
   * @param packingExtraByCode - Optional packing surcharge lookup
   * @param preferencesSourceDefault - Preference source stamped on new piece rows
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
      colorCodes?: string[];
      colorCfIds?: (string | null | undefined)[];
      brand?: string;
      hasStain?: boolean;
      hasDamage?: boolean;
      notes?: string;
      rackLocation?: string;
      metadata?: Record<string, any>;
      packingPrefCode?: string;
      packingCfId?: string | null;
      servicePrefs?: Array<{ preference_code: string; source?: string; extra_price?: number; preferenceCfId?: string | null }>;
      conditions?: string[];
    }>,
    branchId?: string,
    supabaseClient?: SupabaseClient,
    packingExtraByCode?: Map<string, number>,
    preferencesSourceDefault: OrderPreferencesSourceDefault = 'ORDER_CREATE'
  ): Promise<{ success: boolean; pieces?: OrderItemPiece[]; error?: string }> {
    try {
      const supabase = supabaseClient ?? (await createClient());

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
        const packingExtra =
          pieceData?.packingPrefCode != null && pieceData.packingPrefCode !== ''
            ? packingExtraByCode?.get(pieceData.packingPrefCode) ?? 0
            : 0;

        const pieceColors = pieceData ? effectivePieceColorsForPersist(pieceData) : effectivePieceColorsForPersist(
          baseData.color ? { color: baseData.color } : undefined
        );
        const colorJson =
          pieceColors.codes.length > 0
            ? { codes: pieceColors.codes, primary: pieceColors.codes[0] }
            : null;

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
          color: colorJson,
          brand: pieceData?.brand || baseData.brand || null,
          has_stain: pieceData?.hasStain ?? baseData.hasStain ?? false,
          has_damage: pieceData?.hasDamage ?? baseData.hasDamage ?? false,
          metadata: pieceData?.metadata || baseData.metadata || {},
          packing_pref_code: pieceData?.packingPrefCode || null,
          service_pref_charge: servicePrefCharge + packingExtra,
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

      const allConditionCatalogCodes = new Set<string>();
      for (const pd of piecesData ?? []) {
        for (const c of pd.conditions ?? []) {
          allConditionCatalogCodes.add(getConditionPrefKind(c).preference_code);
        }
      }
      const conditionCfByCode =
        allConditionCatalogCodes.size > 0
          ? await fetchOrgServicePreferenceCfIdsByCodesSupabase(supabase, tenantId, [...allConditionCatalogCodes])
          : new Map<string, string>();

      // Insert piece-level preferences (org_order_preferences_dtl, prefs_level=PIECE).
      // Order and prefs_no match Prisma createOrderInTransaction: conditions, then service_prefs, then packing.
      const createdPieces = pieces as Array<{ id: string; piece_seq: number }>;
      for (const pieceData of piecesData ?? []) {
        const createdPiece = createdPieces.find((p) => p.piece_seq === pieceData.pieceSeq);
        if (!createdPiece) continue;

        const conditions = pieceData.conditions ?? [];
        const prefs = pieceData.servicePrefs ?? [];
        const condCount = conditions.length;
        const svcCount = prefs.length;

        if (conditions.length > 0) {
          const condRows = conditions.map((code, idx) => {
            const { preference_code, preference_sys_kind } = getConditionPrefKind(code);
            const prefCfId = conditionCfByCode.get(preference_code);
            return {
              tenant_org_id: tenantId,
              order_id: orderId,
              prefs_no: idx + 1,
              prefs_level: 'PIECE' as const,
              order_item_id: orderItemId,
              order_item_piece_id: createdPiece.id,
              preference_code,
              preference_content: preference_code,
              preference_sys_kind,
              prefs_source: preferencesSourceDefault,
              branch_id: branchId ?? null,
              ...(prefCfId ? { preference_id: prefCfId } : {}),
            };
          });
          const { error: condError } = await supabase.from('org_order_preferences_dtl').insert(condRows);
          if (condError) {
            log.warn('[OrderPieceService] Failed to insert piece conditions', {
              feature: 'order_pieces',
              action: 'create_piece_conditions',
              pieceId: createdPiece.id,
              error: condError.message,
            });
          }
        }

        if (prefs.length > 0) {
          const rows = prefs.map((p, idx) => ({
            tenant_org_id: tenantId,
            order_id: orderId,
            prefs_no: condCount + idx + 1,
            prefs_level: 'PIECE' as const,
            order_item_id: orderItemId,
            order_item_piece_id: createdPiece.id,
            preference_code: p.preference_code,
            preference_content: p.preference_code,
            preference_sys_kind: 'service_prefs',
            prefs_source: p.source ?? preferencesSourceDefault,
            extra_price: Number(p.extra_price ?? 0),
            branch_id: branchId ?? null,
            ...(p.preferenceCfId ? { preference_id: p.preferenceCfId } : {}),
          }));
          const { error: prefsError } = await supabase.from('org_order_preferences_dtl').insert(rows);
          if (prefsError) {
            log.warn('[OrderPieceService] Failed to insert piece service prefs', {
              feature: 'order_pieces',
              action: 'create_piece_prefs',
              pieceId: createdPiece.id,
              error: prefsError.message,
            });
          }
        }

        if (pieceData.packingPrefCode) {
          const packExtra = packingExtraByCode?.get(pieceData.packingPrefCode) ?? 0;
          const { error: packError } = await supabase.from('org_order_preferences_dtl').insert({
            tenant_org_id: tenantId,
            order_id: orderId,
            prefs_no: condCount + svcCount + 1,
            prefs_level: 'PIECE',
            order_item_id: orderItemId,
            order_item_piece_id: createdPiece.id,
            preference_code: pieceData.packingPrefCode,
            preference_content: pieceData.packingPrefCode,
            preference_sys_kind: 'packing_prefs',
            prefs_owner_type: 'SYSTEM',
            prefs_source: preferencesSourceDefault,
            extra_price: packExtra,
            branch_id: branchId ?? null,
            ...(pieceData.packingCfId ? { preference_id: pieceData.packingCfId } : {}),
          });
          if (packError) {
            log.warn('[OrderPieceService] Failed to insert piece packing pref', {
              feature: 'order_pieces',
              action: 'create_piece_packing_pref',
              pieceId: createdPiece.id,
              error: packError.message,
            });
          }
        }

        const packingOffset = pieceData.packingPrefCode ? 1 : 0;

        const pieceColors = effectivePieceColorsForPersist(pieceData);
        if (pieceColors.codes.length > 0) {
          const colorRows = pieceColors.codes.map((code, ci) => ({
            tenant_org_id: tenantId,
            order_id: orderId,
            prefs_no: condCount + svcCount + packingOffset + ci + 1,
            prefs_level: 'PIECE',
            order_item_id: orderItemId,
            order_item_piece_id: createdPiece.id,
            preference_code: code,
            preference_content: code,
            preference_sys_kind: 'color',
            prefs_source: preferencesSourceDefault,
            extra_price: 0,
            branch_id: branchId ?? null,
            ...(pieceColors.cfIds[ci] ? { preference_id: pieceColors.cfIds[ci] as string } : {}),
          }));
          const { error: colorError } = await supabase.from('org_order_preferences_dtl').insert(colorRows);
          if (colorError) {
            log.warn('[OrderPieceService] Failed to insert piece color pref', {
              feature: 'order_pieces',
              action: 'create_piece_color',
              pieceId: createdPiece.id,
              error: colorError.message,
            });
          }
        }

        const colorOffset = pieceColors.codes.length;

        if (pieceData.notes) {
          const { error: noteError } = await supabase.from('org_order_preferences_dtl').insert({
            tenant_org_id: tenantId,
            order_id: orderId,
            prefs_no: condCount + svcCount + packingOffset + colorOffset + 1,
            prefs_level: 'PIECE',
            order_item_id: orderItemId,
            order_item_piece_id: createdPiece.id,
            preference_code: pieceData.notes,
            preference_content: pieceData.notes,
            preference_sys_kind: 'note',
            prefs_source: preferencesSourceDefault,
            extra_price: 0,
            branch_id: branchId ?? null,
          });
          if (noteError) {
            log.warn('[OrderPieceService] Failed to insert piece note pref', {
              feature: 'order_pieces',
              action: 'create_piece_note',
              pieceId: createdPiece.id,
              error: noteError.message,
            });
          }
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
      colorCodes?: string[];
      colorCfIds?: (string | null | undefined)[];
      brand?: string;
      hasStain?: boolean;
      hasDamage?: boolean;
      notes?: string;
      rackLocation?: string;
      metadata?: Record<string, any>;
      packingPrefCode?: string;
      packingCfId?: string | null;
      servicePrefs?: Array<{ preference_code: string; source?: string; extra_price?: number; preferenceCfId?: string | null }>;
      conditions?: string[];
    }>,
    branchId?: string,
    packingExtraByCode?: Map<string, number>,
    preferencesSourceDefault: OrderPreferencesSourceDefault = 'ORDER_CREATE'
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
        const packingExtra =
          pieceData?.packingPrefCode != null && pieceData.packingPrefCode !== ''
            ? packingExtraByCode?.get(pieceData.packingPrefCode) ?? 0
            : 0;

        const pieceColors = pieceData ? effectivePieceColorsForPersist(pieceData) : effectivePieceColorsForPersist(
          baseData.color ? { color: baseData.color } : undefined
        );
        const colorJson =
          pieceColors.codes.length > 0
            ? { codes: pieceColors.codes, primary: pieceColors.codes[0] }
            : undefined;

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
          color: colorJson,
          brand: pieceData?.brand ?? baseData.brand ?? null,
          has_stain: pieceData?.hasStain ?? baseData.hasStain ?? false,
          has_damage: pieceData?.hasDamage ?? baseData.hasDamage ?? false,
          metadata: (pieceData?.metadata ?? baseData.metadata ?? {}) as object,
          packing_pref_code: pieceData?.packingPrefCode ?? null,
          service_pref_charge: servicePrefCharge + packingExtra,
          created_by: null,
          created_info: null,
          rec_status: 1,
        };
      });

      await tx.org_order_item_pieces_dtl.createMany({ data: piecesToInsert });

      const allConditionCatalogCodesTx = new Set<string>();
      for (const pd of piecesData ?? []) {
        for (const c of pd.conditions ?? []) {
          allConditionCatalogCodesTx.add(getConditionPrefKind(c).preference_code);
        }
      }
      const conditionCfByCodeTx =
        allConditionCatalogCodesTx.size > 0
          ? await fetchOrgServicePreferenceCfIdsByCodesPrismaTx(tx, tenantId, [...allConditionCatalogCodesTx])
          : new Map<string, string>();

      // Insert piece-level service prefs and conditions (org_order_preferences_dtl)
      if (piecesData && piecesData.length > 0) {
        const createdPieces = await tx.org_order_item_pieces_dtl.findMany({
          where: {
            tenant_org_id: tenantId,
            order_id: orderId,
            order_item_id: orderItemId,
          },
          orderBy: { piece_seq: 'asc' },
          select: { id: true, piece_seq: true },
        });

        for (const pieceData of piecesData) {
          const createdPiece = createdPieces.find((p) => p.piece_seq === pieceData.pieceSeq);
          if (!createdPiece) continue;

          const packExtraRow =
            pieceData.packingPrefCode != null && pieceData.packingPrefCode !== ''
              ? packingExtraByCode?.get(pieceData.packingPrefCode) ?? 0
              : 0;

          const conditions = pieceData.conditions ?? [];
          const pieceSvcPrefs = pieceData.servicePrefs ?? [];
          const condCount = conditions.length;
          const svcCount = pieceSvcPrefs.length;

          if (conditions.length > 0) {
            const condData = conditions.map((code, idx) => {
              const { preference_code, preference_sys_kind } = getConditionPrefKind(code);
              const prefCfId = conditionCfByCodeTx.get(preference_code);
              return {
                tenant_org_id: tenantId,
                order_id: orderId,
                prefs_no: idx + 1,
                prefs_level: 'PIECE',
                order_item_id: orderItemId,
                order_item_piece_id: createdPiece.id,
                preference_code,
                preference_content: preference_code,
                preference_sys_kind,
                prefs_source: preferencesSourceDefault,
                extra_price: 0,
                branch_id: branchId ?? null,
                ...(prefCfId ? { preference_id: prefCfId } : {}),
              };
            });
            await tx.org_order_preferences_dtl.createMany({ data: condData });
          }

          if (pieceSvcPrefs.length > 0) {
            await tx.org_order_preferences_dtl.createMany({
              data: pieceSvcPrefs.map((p, idx) => ({
                tenant_org_id: tenantId,
                order_id: orderId,
                prefs_no: condCount + idx + 1,
                prefs_level: 'PIECE',
                order_item_id: orderItemId,
                order_item_piece_id: createdPiece.id,
                preference_code: p.preference_code,
                preference_content: p.preference_code,
                preference_sys_kind: 'service_prefs',
                prefs_source: p.source ?? preferencesSourceDefault,
                extra_price: p.extra_price ?? 0,
                branch_id: branchId ?? null,
                ...(p.preferenceCfId ? { preference_id: p.preferenceCfId } : {}),
              })),
            });
          }

          if (pieceData.packingPrefCode) {
            await tx.org_order_preferences_dtl.create({
              data: {
                tenant_org_id: tenantId,
                order_id: orderId,
                prefs_no: condCount + svcCount + 1,
                prefs_level: 'PIECE',
                order_item_id: orderItemId,
                order_item_piece_id: createdPiece.id,
                preference_code: pieceData.packingPrefCode,
                preference_content: pieceData.packingPrefCode,
                preference_sys_kind: 'packing_prefs',
                prefs_owner_type: 'SYSTEM',
                prefs_source: preferencesSourceDefault,
                extra_price: packExtraRow,
                branch_id: branchId ?? null,
                ...(pieceData.packingCfId ? { preference_id: pieceData.packingCfId } : {}),
              },
            });
          }

          const packingOffset = pieceData.packingPrefCode ? 1 : 0;

          const pieceColorsPersist = effectivePieceColorsForPersist(pieceData);
          if (pieceColorsPersist.codes.length > 0) {
            await tx.org_order_preferences_dtl.createMany({
              data: pieceColorsPersist.codes.map((code, ci) => ({
                tenant_org_id: tenantId,
                order_id: orderId,
                prefs_no: condCount + svcCount + packingOffset + ci + 1,
                prefs_level: 'PIECE',
                order_item_id: orderItemId,
                order_item_piece_id: createdPiece.id,
                preference_code: code,
                preference_content: code,
                preference_sys_kind: 'color',
                prefs_source: preferencesSourceDefault,
                extra_price: 0,
                branch_id: branchId ?? null,
                ...(pieceColorsPersist.cfIds[ci]
                  ? { preference_id: pieceColorsPersist.cfIds[ci] as string }
                  : {}),
              })),
            });
          }

          const colorOffset = pieceColorsPersist.codes.length;

          if (pieceData.notes) {
            await tx.org_order_preferences_dtl.create({
              data: {
                tenant_org_id: tenantId,
                order_id: orderId,
                prefs_no: condCount + svcCount + packingOffset + colorOffset + 1,
                prefs_level: 'PIECE',
                order_item_id: orderItemId,
                order_item_piece_id: createdPiece.id,
                preference_code: pieceData.notes,
                preference_content: pieceData.notes,
                preference_sys_kind: 'note',
                prefs_source: preferencesSourceDefault,
                extra_price: 0,
                branch_id: branchId ?? null,
              },
            });
          }
        }
      }

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
   * Get pieces by order ID
   * Includes packing_pref_code from pieces table and service_prefs from org_order_preferences_dtl
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

      const mapped = mapOrderPiecesFromDb(pieces as OrderPieceDbModel[]);
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
  ): Promise<{ success: boolean; piece?: OrderItemPiece; error?: string }> {
    try {
      const supabase = await createClient();

      const { data: beforeRow } = await supabase
        .from('org_order_item_pieces_dtl')
        .select(
          'piece_status,is_ready,is_rejected,scan_state,rack_location,piece_stage,barcode,notes'
        )
        .eq('id', params.pieceId)
        .eq('tenant_org_id', params.tenantId)
        .maybeSingle();

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

