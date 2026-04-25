'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { createClient } from '@/lib/supabase/server';

export interface OrderPreferenceRow {
  id: string;
  prefs_no: number;
  prefs_level: string;
  order_item_id: string | null;
  order_item_piece_id: string | null;
  preference_code: string;
  preference_sys_kind: string | null;
  preference_category: string | null;
  prefs_owner_type: string;
  prefs_source: string;
  extra_price: number;
  processing_confirmed: boolean | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string | null;
  created_by: string | null;
}

export async function getOrderPreferencesAction(
  orderId: string
): Promise<{ success: boolean; data?: OrderPreferenceRow[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('org_order_preferences_dtl')
      .select(
        'id, prefs_no, prefs_level, order_item_id, order_item_piece_id, preference_code, preference_sys_kind, preference_category, prefs_owner_type, prefs_source, extra_price, processing_confirmed, confirmed_by, confirmed_at, created_at, created_by'
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
      prefs_no: r.prefs_no,
      prefs_level: r.prefs_level,
      order_item_id: r.order_item_id ?? null,
      order_item_piece_id: r.order_item_piece_id ?? null,
      preference_code: r.preference_code,
      preference_sys_kind: r.preference_sys_kind ?? null,
      preference_category: r.preference_category ?? null,
      prefs_owner_type: r.prefs_owner_type,
      prefs_source: r.prefs_source,
      extra_price: Number(r.extra_price),
      processing_confirmed: r.processing_confirmed ?? null,
      confirmed_by: r.confirmed_by ?? null,
      confirmed_at: r.confirmed_at ?? null,
      created_at: r.created_at ?? null,
      created_by: r.created_by ?? null,
    }));

    return { success: true, data: rows };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load order preferences',
    };
  }
}
