/**
 * Order Item Preference Service
 * CRUD for order item service prefs, packing pref, and service_pref_charge recalculation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderItemServicePref, PreferenceSource } from '@/lib/types/service-preferences';
import { PREFERENCE_SOURCES } from '@/lib/constants/service-preferences';
import { logger } from '@/lib/utils/logger';

export interface AddServicePrefInput {
  preference_code: string;
  source?: PreferenceSource;
  extra_price: number;
  branch_id?: string | null;
}

export class OrderItemPreferenceService {
  /**
   * Get service prefs for an order item
   */
  static async getItemServicePrefs(
    supabase: SupabaseClient,
    tenantId: string,
    orderItemId: string
  ): Promise<OrderItemServicePref[]> {
    const { data, error } = await supabase
      .from('org_order_item_service_prefs')
      .select('id, order_item_id, preference_code, preference_category, source, extra_price, branch_id')
      .eq('tenant_org_id', tenantId)
      .eq('order_item_id', orderItemId);

    if (error) {
      logger.error('Failed to get item service prefs', new Error(error.message), {
        tenantId,
        orderItemId,
        feature: 'order_item_preference',
      });
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      order_item_id: r.order_item_id,
      preference_code: r.preference_code,
      preference_category: r.preference_category,
      source: (r.source || PREFERENCE_SOURCES.MANUAL) as PreferenceSource,
      extra_price: Number(r.extra_price),
      branch_id: r.branch_id,
    }));
  }

  /**
   * Add service pref to order item and recalc service_pref_charge
   */
  static async addItemServicePref(
    supabase: SupabaseClient,
    tenantId: string,
    orderId: string,
    orderItemId: string,
    input: AddServicePrefInput,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: item } = await supabase
        .from('org_order_items_dtl')
        .select('id, tenant_org_id, order_id')
        .eq('id', orderItemId)
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (!item) {
        return { success: false, error: 'Order item not found' };
      }

      const { error: insertError } = await supabase
        .from('org_order_item_service_prefs')
        .insert({
          tenant_org_id: tenantId,
          order_id: orderId,
          order_item_id: orderItemId,
          preference_code: input.preference_code,
          source: input.source || PREFERENCE_SOURCES.MANUAL,
          extra_price: input.extra_price,
          branch_id: input.branch_id ?? null,
          created_by: userId,
          created_info: userName,
        });

      if (insertError) {
        logger.error('Failed to add item service pref', new Error(insertError.message), {
          tenantId,
          orderItemId,
          feature: 'order_item_preference',
        });
        return { success: false, error: insertError.message };
      }

      await this.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
      return { success: true };
    } catch (err) {
      logger.error('OrderItemPreferenceService.addItemServicePref failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        orderItemId,
        feature: 'order_item_preference',
      });
      return { success: false, error: 'Failed to add service preference' };
    }
  }

  /**
   * Remove service pref from order item and recalc service_pref_charge
   */
  static async removeItemServicePref(
    supabase: SupabaseClient,
    tenantId: string,
    orderItemId: string,
    prefId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('org_order_item_service_prefs')
        .delete()
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId)
        .eq('id', prefId);

      if (error) {
        logger.error('Failed to remove item service pref', new Error(error.message), {
          tenantId,
          orderItemId,
          feature: 'order_item_preference',
        });
        return { success: false, error: error.message };
      }

      await this.recalcItemServicePrefCharge(supabase, tenantId, orderItemId);
      return { success: true };
    } catch (err) {
      logger.error('OrderItemPreferenceService.removeItemServicePref failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        orderItemId,
        feature: 'order_item_preference',
      });
      return { success: false, error: 'Failed to remove service preference' };
    }
  }

  /**
   * Update packing preference for order item
   */
  static async updateItemPackingPref(
    supabase: SupabaseClient,
    tenantId: string,
    orderItemId: string,
    packingPrefCode: string,
    packingPrefIsOverride?: boolean,
    packingPrefSource?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('org_order_items_dtl')
        .update({
          packing_pref_code: packingPrefCode,
          packing_pref_is_override: packingPrefIsOverride ?? false,
          packing_pref_source: packingPrefSource ?? null,
        })
        .eq('tenant_org_id', tenantId)
        .eq('id', orderItemId);

      if (error) {
        logger.error('Failed to update item packing pref', new Error(error.message), {
          tenantId,
          orderItemId,
          feature: 'order_item_preference',
        });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      logger.error('OrderItemPreferenceService.updateItemPackingPref failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        orderItemId,
        feature: 'order_item_preference',
      });
      return { success: false, error: 'Failed to update packing preference' };
    }
  }

  /**
   * Recalculate service_pref_charge for order item (sum of extra_price from item prefs + piece prefs)
   */
  static async recalcItemServicePrefCharge(
    supabase: SupabaseClient,
    tenantId: string,
    orderItemId: string
  ): Promise<void> {
    try {
      const { data: itemPrefs } = await supabase
        .from('org_order_item_service_prefs')
        .select('extra_price')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId);

      const { data: piecePrefs } = await supabase
        .from('org_order_item_pc_prefs')
        .select('extra_price')
        .eq('tenant_org_id', tenantId)
        .eq('order_item_id', orderItemId);

      const itemSum = (itemPrefs || []).reduce((acc, p) => acc + Number(p.extra_price), 0);
      const pieceSum = (piecePrefs || []).reduce((acc, p) => acc + Number(p.extra_price), 0);
      const total = itemSum + pieceSum;

      await supabase
        .from('org_order_items_dtl')
        .update({ service_pref_charge: total })
        .eq('tenant_org_id', tenantId)
        .eq('id', orderItemId);
    } catch (err) {
      logger.error('OrderItemPreferenceService.recalcItemServicePrefCharge failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        orderItemId,
        feature: 'order_item_preference',
      });
    }
  }
}
