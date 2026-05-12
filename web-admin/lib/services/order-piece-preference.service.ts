/**
 * Order Piece Preference Service
 * CRUD for order piece service prefs (org_order_preferences_dtl, prefs_level=PIECE).
 * Recalculates service_pref_charge on piece and parent item.
 * Enterprise-gated: per-piece service prefs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderPieceServicePref, PreferenceSource } from '@/lib/types/service-preferences';
import { PREFERENCE_SOURCES } from '@/lib/constants/service-preferences';
import { logger } from '@/lib/utils/logger';
import { OrderItemPreferenceService } from './order-item-preference.service';
import type { AddPieceServicePrefInput } from '@/lib/validations/service-preferences-schemas';
import { getConditionPrefKind } from '@/lib/utils/condition-codes';
import { fetchOrgPackingExtraPriceByCodesSupabase } from '@/lib/utils/org-packing-extra-price';

export type { AddPieceServicePrefInput } from '@/lib/validations/service-preferences-schemas';

export class OrderPiecePreferenceService {
  /**
   * Get service prefs for an order piece
   */
  static async getPieceServicePrefs(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string
  ): Promise<OrderPieceServicePref[]> {
    const { data, error } = await supabase
      .from('org_order_preferences_dtl')
      .select('id, order_item_piece_id, preference_code, preference_category, prefs_source, extra_price, branch_id')
      .eq('tenant_org_id', tenantId)
      .eq('order_item_piece_id', pieceId)
      .eq('prefs_level', 'PIECE')
      .eq('preference_sys_kind', 'service_prefs');

    if (error) {
      logger.error('Failed to get piece service prefs', new Error(error.message), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      order_item_piece_id: r.order_item_piece_id,
      preference_code: r.preference_code,
      preference_category: r.preference_category,
      source: (r.prefs_source || PREFERENCE_SOURCES.MANUAL) as PreferenceSource,
      extra_price: Number(r.extra_price),
      branch_id: r.branch_id,
    }));
  }

  /**
   * Add service pref to order piece and recalc service_pref_charge
   */
  static async addPieceServicePref(
    supabase: SupabaseClient,
    tenantId: string,
    orderId: string,
    orderItemId: string,
    pieceId: string,
    input: AddPieceServicePrefInput,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: piece } = await supabase
        .from('org_order_item_pieces_dtl')
        .select('id, order_item_id')
        .eq('id', pieceId)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId)
        .single();

      if (!piece) {
        return { success: false, error: 'Order piece not found' };
      }

      const { data: maxNo } = await supabase
        .from('org_order_preferences_dtl')
        .select('prefs_no')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .order('prefs_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prefsNo = (maxNo?.prefs_no ?? 0) + 1;

      const { error: insertError } = await supabase
        .from('org_order_preferences_dtl')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          prefs_no: prefsNo,
          prefs_level: 'PIECE',
          order_item_id: orderItemId,
          order_item_piece_id: pieceId,
          preference_code: input.preference_code,
          preference_sys_kind: 'service_prefs',
          prefs_source: input.source || PREFERENCE_SOURCES.MANUAL,
          extra_price: input.extra_price,
          branch_id: input.branch_id ?? null,
          created_by: userId,
        });

      if (insertError) {
        logger.error('Failed to add piece service pref', new Error(insertError.message), {
          tenantId,
          pieceId,
          feature: 'order_piece_preference',
        });
        return { success: false, error: insertError.message };
      }

      await this.recalcPieceServicePrefCharge(supabase, tenantId, pieceId);
      await OrderItemPreferenceService.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
      return { success: true };
    } catch (err) {
      logger.error('OrderPiecePreferenceService.addPieceServicePref failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
      return { success: false, error: 'Failed to add service preference' };
    }
  }

  /**
   * Remove service pref from order piece and recalc service_pref_charge
   */
  static async removePieceServicePref(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string,
    prefId: string
  ): Promise<{ success: boolean; orderItemId?: string; error?: string }> {
    try {
      const { data: pref } = await supabase
        .from('org_order_preferences_dtl')
        .select('id, order_item_id')
        .eq('id', prefId)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .single();

      if (!pref) {
        return { success: false, error: 'Preference not found' };
      }

      const { error } = await supabase
        .from('org_order_preferences_dtl')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .eq('id', prefId);

      if (error) {
        logger.error('Failed to remove piece service pref', new Error(error.message), {
          tenantId,
          pieceId,
          feature: 'order_piece_preference',
        });
        return { success: false, error: error.message };
      }

      await this.recalcPieceServicePrefCharge(supabase, tenantId, pieceId);
      await OrderItemPreferenceService.recalcItemServicePrefCharge(supabase, tenantId, pref.order_item_id);
      return { success: true, orderItemId: pref.order_item_id };
    } catch (err) {
      logger.error('OrderPiecePreferenceService.removePieceServicePref failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
      return { success: false, error: 'Failed to remove service preference' };
    }
  }

  /**
   * Confirm processing for all service prefs on a piece.
   * Sets processing_confirmed=true, confirmed_by, confirmed_at on org_order_preferences_dtl.
   */
  static async confirmPiecePrefs(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: prefs, error: fetchError } = await supabase
        .from('org_order_preferences_dtl')
        .select('id')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE');

      if (fetchError || !prefs?.length) {
        return { success: false, error: 'No service prefs to confirm' };
      }

      const { error: updateError } = await supabase
        .from('org_order_preferences_dtl')
        .update({
          processing_confirmed: true,
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE');

      if (updateError) {
        logger.error('Failed to confirm piece prefs', new Error(updateError.message), {
          tenantId,
          pieceId,
          feature: 'order_piece_preference',
        });
        return { success: false, error: updateError.message };
      }
      return { success: true };
    } catch (err) {
      logger.error('OrderPiecePreferenceService.confirmPiecePrefs failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
      return { success: false, error: 'Failed to confirm preferences' };
    }
  }

  /**
   * Replace all condition-kind preference rows for a piece (stain / damage / special).
   * `conditionCodes` are UI codes (e.g. coffee, hole) as used by StainConditionToggles.
   */
  static async replacePieceConditions(
    supabase: SupabaseClient,
    tenantId: string,
    orderId: string,
    orderItemId: string,
    pieceId: string,
    conditionCodes: string[],
    userId: string,
    branchId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const CONDITION_KINDS = ['condition_stain', 'condition_damag', 'condition_special'] as const;

    const { error: delErr } = await supabase
      .from('org_order_preferences_dtl')
      .delete()
      .eq('tenant_org_id', tenantId)
      .eq('order_item_piece_id', pieceId)
      .eq('prefs_level', 'PIECE')
      .in('preference_sys_kind', [...CONDITION_KINDS]);

    if (delErr) {
      logger.error('replacePieceConditions delete failed', new Error(delErr.message), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
      return { success: false, error: delErr.message };
    }

    if (conditionCodes.length === 0) {
      await OrderItemPreferenceService.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
      return { success: true };
    }

    const { data: maxNo } = await supabase
      .from('org_order_preferences_dtl')
      .select('prefs_no')
      .eq('tenant_org_id', tenantId)
      .eq('order_item_piece_id', pieceId)
      .eq('prefs_level', 'PIECE')
      .order('prefs_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    let prefsNo = (maxNo?.prefs_no ?? 0);
    const rows = conditionCodes.map((code) => {
      const { preference_code, preference_sys_kind } = getConditionPrefKind(code);
      prefsNo += 1;
      return {
        tenant_org_id: tenantId,
        order_id: orderId,
        prefs_no: prefsNo,
        prefs_level: 'PIECE' as const,
        order_item_id: orderItemId,
        order_item_piece_id: pieceId,
        preference_code,
        preference_sys_kind,
        prefs_source: PREFERENCE_SOURCES.MANUAL,
        extra_price: 0,
        branch_id: branchId ?? null,
        created_by: userId,
      };
    });

    const { error: insErr } = await supabase.from('org_order_preferences_dtl').insert(rows);
    if (insErr) {
      logger.error('replacePieceConditions insert failed', new Error(insErr.message), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
      return { success: false, error: insErr.message };
    }

    await OrderItemPreferenceService.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
    return { success: true };
  }

  /**
   * Replace piece-level packing in `org_order_preferences_dtl` (`preference_sys_kind = packing_prefs`)
   * and keep `org_order_item_pieces_dtl.packing_pref_code` in sync (denormalized / legacy screens).
   * Canonical preference facts live in DTL per preferences-architecture-reference.md.
   */
  static async replacePiecePacking(
    supabase: SupabaseClient,
    tenantId: string,
    orderId: string,
    orderItemId: string,
    pieceId: string,
    packingPrefCode: string | null,
    userId: string,
    preferenceCfId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: delErr } = await supabase
        .from('org_order_preferences_dtl')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .eq('preference_sys_kind', 'packing_prefs');

      if (delErr) {
        logger.error('replacePiecePacking delete failed', new Error(delErr.message), {
          tenantId,
          pieceId,
          feature: 'order_piece_preference',
        });
        return { success: false, error: delErr.message };
      }

      const codeNorm = packingPrefCode?.trim() ? packingPrefCode.trim() : null;

      const { error: pieceUpdErr } = await supabase
        .from('org_order_item_pieces_dtl')
        .update({ packing_pref_code: codeNorm })
        .eq('tenant_org_id', tenantId)
        .eq('id', pieceId);

      if (pieceUpdErr) {
        logger.error('replacePiecePacking piece row update failed', new Error(pieceUpdErr.message), {
          tenantId,
          pieceId,
          feature: 'order_piece_preference',
        });
        return { success: false, error: pieceUpdErr.message };
      }

      if (!codeNorm) {
        await this.recalcPieceServicePrefCharge(supabase, tenantId, pieceId);
        await OrderItemPreferenceService.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
        return { success: true };
      }

      const priceMap = await fetchOrgPackingExtraPriceByCodesSupabase(supabase, tenantId, [codeNorm]);
      const packExtra = priceMap.get(codeNorm) ?? 0;

      let prefId = preferenceCfId ?? null;
      if (!prefId) {
        const { data: cf } = await supabase
          .from('org_packing_preference_cf')
          .select('id')
          .eq('tenant_org_id', tenantId)
          .eq('packing_pref_code', codeNorm)
          .maybeSingle();
        prefId = cf?.id ?? null;
      }

      const { data: ord } = await supabase
        .from('org_orders_mst')
        .select('branch_id')
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .maybeSingle();

      const { data: maxNo } = await supabase
        .from('org_order_preferences_dtl')
        .select('prefs_no')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .order('prefs_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prefsNo = (maxNo?.prefs_no ?? 0) + 1;

      const { error: insErr } = await supabase.from('org_order_preferences_dtl').insert({
        tenant_org_id: tenantId,
        order_id: orderId,
        prefs_no: prefsNo,
        prefs_level: 'PIECE',
        order_item_id: orderItemId,
        order_item_piece_id: pieceId,
        preference_code: codeNorm,
        preference_sys_kind: 'packing_prefs',
        prefs_source: PREFERENCE_SOURCES.MANUAL,
        extra_price: packExtra,
        branch_id: ord?.branch_id ?? null,
        created_by: userId,
        ...(prefId ? { preference_id: prefId } : {}),
      });

      if (insErr) {
        logger.error('replacePiecePacking insert failed', new Error(insErr.message), {
          tenantId,
          pieceId,
          feature: 'order_piece_preference',
        });
        return { success: false, error: insErr.message };
      }

      await this.recalcPieceServicePrefCharge(supabase, tenantId, pieceId);
      await OrderItemPreferenceService.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
      return { success: true };
    } catch (err) {
      logger.error(
        'OrderPiecePreferenceService.replacePiecePacking failed',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId, pieceId, feature: 'order_piece_preference' }
      );
      return { success: false, error: 'Failed to update piece packing preference' };
    }
  }

  /**
   * Recalculate service_pref_charge for order piece (sum of extra_price from piece service + packing prefs)
   */
  static async recalcPieceServicePrefCharge(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string
  ): Promise<void> {
    try {
      const { data: prefs } = await supabase
        .from('org_order_preferences_dtl')
        .select('extra_price')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .eq('prefs_level', 'PIECE')
        .in('preference_sys_kind', ['service_prefs', 'packing_prefs']);

      const total = (prefs || []).reduce((acc, p) => acc + Number(p.extra_price), 0);

      await supabase
        .from('org_order_item_pieces_dtl')
        .update({ service_pref_charge: total })
        .eq('tenant_org_id', tenantId)
        .eq('id', pieceId);
    } catch (err) {
      logger.error('OrderPiecePreferenceService.recalcPieceServicePrefCharge failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        pieceId,
        feature: 'order_piece_preference',
      });
    }
  }
}
