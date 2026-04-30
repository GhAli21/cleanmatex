/** Columns loaded and shown for org_order_preferences_dtl (full row mirror). Kept outside `use server` modules — Next only allows async exports there. */
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
