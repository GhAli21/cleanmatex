'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { createClient } from '@/lib/supabase/server';

/** Columns loaded and shown for org_order_preferences_dtl (full row mirror). */
export const ORDER_PREF_DTL_DISPLAY_COLUMNS = [
  'id',
  'tenant_org_id',
  'order_id',
  'branch_id',
  'prefs_no',
  'prefs_level',
  'order_item_id',
  'order_item_piece_id',
  'preference_id',
  'preference_code',
  'preference_sys_kind',
  'preference_category',
  'prefs_owner_type',
  'prefs_source',
  'extra_price',
  'processing_confirmed',
  'confirmed_by',
  'confirmed_at',
  'rec_status',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

/** Column key union for `org_order_preferences_dtl` detail rows. */
export type OrderPreferenceDtlColumn = (typeof ORDER_PREF_DTL_DISPLAY_COLUMNS)[number];

/** One preference detail row aligned with `org_order_preferences_dtl`. */
export interface OrderPreferenceRow {
  id: string;
  tenant_org_id: string;
  order_id: string;
  branch_id: string | null;
  prefs_no: number;
  prefs_level: string;
  order_item_id: string | null;
  order_item_piece_id: string | null;
  preference_id: string | null;
  preference_code: string;
  preference_sys_kind: string | null;
  preference_category: string | null;
  prefs_owner_type: string;
  prefs_source: string;
  extra_price: number;
  processing_confirmed: boolean | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  rec_status: number | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

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
