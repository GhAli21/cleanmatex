'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { createClient } from '@/lib/supabase/server';
import type { OrderPreferenceRow } from '@/lib/orders/order-preferences-dtl';

/**
 * Loads active preference detail rows for an order (tenant-scoped).
 * @param orderId - Target order UUID
 * @returns Success flag with mapped rows or error message
 */
export async function getOrderPreferencesAction(
  orderId: string
): Promise<{ success: boolean; data?: OrderPreferenceRow[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('org_order_preferences_dtl')
      .select(
        'id, tenant_org_id, order_id, branch_id, prefs_no, prefs_level, order_item_id, order_item_piece_id, preference_id, preference_code, preference_sys_kind, preference_category, prefs_owner_type, prefs_source, extra_price, processing_confirmed, confirmed_by, confirmed_at, rec_status, created_at, created_by, updated_at, updated_by'
      )
      .eq('tenant_org_id', tenantId)
      .eq('order_id', orderId)
      .eq('rec_status', 1)
      .order('prefs_level', { ascending: true })
      .order('prefs_no', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const rows: OrderPreferenceRow[] = (data ?? []).map((r) => ({
      id: r.id,
      tenant_org_id: r.tenant_org_id,
      order_id: r.order_id,
      branch_id: r.branch_id ?? null,
      prefs_no: r.prefs_no,
      prefs_level: r.prefs_level,
      order_item_id: r.order_item_id ?? null,
      order_item_piece_id: r.order_item_piece_id ?? null,
      preference_id: r.preference_id ?? null,
      preference_code: r.preference_code,
      preference_sys_kind: r.preference_sys_kind ?? null,
      preference_category: r.preference_category ?? null,
      prefs_owner_type: r.prefs_owner_type,
      prefs_source: r.prefs_source,
      extra_price: Number(r.extra_price),
      processing_confirmed: r.processing_confirmed ?? null,
      confirmed_by: r.confirmed_by ?? null,
      confirmed_at: r.confirmed_at ?? null,
      rec_status: r.rec_status != null ? Number(r.rec_status) : null,
      created_at: r.created_at ?? null,
      created_by: r.created_by ?? null,
      updated_at: r.updated_at ?? null,
      updated_by: r.updated_by ?? null,
    }));

    return { success: true, data: rows };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load order preferences',
    };
  }
}
