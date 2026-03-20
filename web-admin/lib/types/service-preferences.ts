/**
 * Service Preferences Types for CleanMateX Order System
 *
 * Types and interfaces for service preferences, packing preferences,
 * customer standing prefs, and order item/piece prefs.
 * Constants: single source in lib/constants/service-preferences.ts and re-exported here.
 */

import {
  type ServicePreferenceCode,
  type PackingPreferenceCode,
  type PreferenceCategory,
  type PreferenceSource,
  SERVICE_PREFERENCE_CODES,
  PACKING_PREFERENCE_CODES,
  PREFERENCE_CATEGORIES,
  PREFERENCE_SOURCES,
} from '../constants/service-preferences';

export type {
  ServicePreferenceCode,
  PackingPreferenceCode,
  PreferenceCategory,
  PreferenceSource,
};

export {
  SERVICE_PREFERENCE_CODES,
  PACKING_PREFERENCE_CODES,
  PREFERENCE_CATEGORIES,
  PREFERENCE_SOURCES,
};

// ============================================================================
// Preference Kind
// ============================================================================

export const PREFERENCE_MAIN_TYPES = {
  PREFERENCES: 'preferences',
  CONDITIONS:  'conditions',
  COLOR:       'color',
  NOTES:       'notes',
} as const;

export type PreferenceMainType = (typeof PREFERENCE_MAIN_TYPES)[keyof typeof PREFERENCE_MAIN_TYPES];

export interface PreferenceKind {
  kind_code:            string;
  name:                 string | null;
  name2:                string | null;
  kind_bg_color:        string | null;
  main_type_code:       PreferenceMainType | null;
  icon:                 string | null;
  is_show_in_quick_bar: boolean;
  is_show_for_customer: boolean;
  is_active:            boolean;
  rec_order:            number | null;
}

// ============================================================================
// Catalog Entities
// ============================================================================

export interface ServicePreference {
  code: ServicePreferenceCode;
  name: string;
  name2?: string | null;
  description?: string | null;
  preference_category: PreferenceCategory;
  preference_sys_kind?: string | null;
  color_hex?: string | null;
  applies_to_fabric_types?: string[] | null;
  is_incompatible_with?: string[] | null;
  default_extra_price: number;
  workflow_impact?: string | null;
  extra_turnaround_minutes?: number | null;
  sustainability_score?: number | null;
  icon?: string | null;
  display_order?: number | null;
  is_active: boolean;
}

export interface PackingPreference {
  code: PackingPreferenceCode;
  name: string;
  name2?: string | null;
  description?: string | null;
  maps_to_packaging_type?: string | null;
  sustainability_score?: number | null;
  display_order?: number | null;
  is_active: boolean;
}

// ============================================================================
// Tenant Config
// ============================================================================

export interface OrgServicePreferenceCf {
  id: string;
  tenant_org_id: string;
  preference_code: ServicePreferenceCode;
  is_system_code: boolean;
  name?: string | null;
  name2?: string | null;
  extra_price: number;
  is_included_in_base: boolean;
  is_active: boolean;
  display_order?: number | null;
}

export interface OrgPackingPreferenceCf {
  id: string;
  tenant_org_id: string;
  packing_pref_code: PackingPreferenceCode;
  is_system_code: boolean;
  name?: string | null;
  name2?: string | null;
  extra_price: number;
  is_active: boolean;
  display_order?: number | null;
}

export interface PreferenceBundle {
  id: string;
  tenant_org_id: string;
  bundle_code: string;
  name: string;
  name2?: string | null;
  preference_codes: string[];
  discount_percent?: number | null;
  discount_amount?: number | null;
  is_active: boolean;
}

// ============================================================================
// Order Item / Piece Prefs
// ============================================================================

export interface OrderItemServicePref {
  id?: string;
  order_item_id: string;
  preference_code: ServicePreferenceCode;
  preference_category?: PreferenceCategory | null;
  source: PreferenceSource;
  extra_price: number;
  branch_id?: string | null;
}

export interface OrderPieceServicePref {
  id?: string;
  order_item_piece_id: string;
  preference_code: ServicePreferenceCode;
  preference_category?: PreferenceCategory | null;
  source: PreferenceSource;
  extra_price: number;
  branch_id?: string | null;
}

// ============================================================================
// Customer Standing Prefs
// ============================================================================

export interface CustomerServicePref {
  id?: string;
  tenant_org_id: string;
  customer_id: string;
  preference_code: ServicePreferenceCode;
  source: PreferenceSource;
  is_active: boolean;
}

// ============================================================================
// Resolution / API
// ============================================================================

export interface ResolvedPreferences {
  servicePrefs: Array<{ code: ServicePreferenceCode; source: PreferenceSource }>;
  packingPref?: PackingPreferenceCode;
}
