/**
 * Order Piece Preference Service
 * CRUD for order piece service prefs (org_order_item_pc_prefs).
 * Recalculates service_pref_charge on piece and parent item.
 * Enterprise-gated: per-piece service prefs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderPieceServicePref, PreferenceSource } from '@/lib/types/service-preferences';
import { PREFERENCE_SOURCES } from '@/lib/constants/service-preferences';
import { logger } from '@/lib/utils/logger';
import { OrderItemPreferenceService } from './order-item-preference.service';

export interface AddPieceServicePrefInput {
  preference_code: string;
  source?: PreferenceSource;
  extra_price: number;
  branch_id?: string | null;
}

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
      .from('org_order_item_pc_prefs')
      .select('id, order_item_piece_id, preference_code, preference_category, source, extra_price, branch_id')
      .eq('tenant_org_id', tenantId)
      .eq('order_item_piece_id', pieceId);

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
      source: (r.source || PREFERENCE_SOURCES.MANUAL) as PreferenceSource,
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

      const { error: insertError } = await supabase
        .from('org_order_item_pc_prefs')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId,
          order_item_piece_id: pieceId,
          preference_code: input.preference_code,
          source: input.source || PREFERENCE_SOURCES.MANUAL,
          extra_price: input.extra_price,
          branch_id: input.branch_id ?? null,
          created_by: userId,
          created_info: userName,
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
        .from('org_order_item_pc_prefs')
        .select('id, order_item_id')
        .eq('id', prefId)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
        .single();

      if (!pref) {
        return { success: false, error: 'Preference not found' };
      }

      const { error } = await supabase
        .from('org_order_item_pc_prefs')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId)
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
   * Sets processing_confirmed=true, confirmed_by, confirmed_at on org_order_item_pc_prefs.
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
        .from('org_order_item_pc_prefs')
        .select('id')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId);

      if (fetchError || !prefs?.length) {
        return { success: false, error: 'No service prefs to confirm' };
      }

      const { error: updateError } = await supabase
        .from('org_order_item_pc_prefs')
        .update({
          processing_confirmed: true,
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
          updated_by: userId,
          updated_info: userName,
        })
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId);

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
   * Recalculate service_pref_charge for order piece (sum of extra_price from piece prefs)
   */
  static async recalcPieceServicePrefCharge(
    supabase: SupabaseClient,
    tenantId: string,
    pieceId: string
  ): Promise<void> {
    try {
      const { data: prefs } = await supabase
        .from('org_order_item_pc_prefs')
        .select('extra_price')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_piece_id', pieceId);

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
