/**
 * TypeScript interfaces for Extra Tenant Configuration (`sys_tenant_extra_config_cf` + `org_tenant_extra_config_cf`).
 *
 * @module lib/types/tenant-extra-config
 */

import type {
  ExtraConfigValueType,
  NumberGroupingLocale,
  NumberScript,
  PosStepperMinTarget,
  TableDensityOverride,
} from '@/lib/constants/tenant-extra-config';

/** Curated selectable choice stored inside `sys_tenant_extra_config_cf.allowed_values_json`. */
export interface ExtraConfigOption {
  value: string;
  label: string;
  label2: string;
  description?: string | null;
  description2?: string | null;
}

/** Normalized catalog row from `sys_tenant_extra_config_cf`. */
export interface SysExtraConfigRow {
  config_key: string;
  category_code: string;
  name: string;
  name2: string | null;
  description: string | null;
  description2: string | null;
  value_type: ExtraConfigValueType | string;
  default_value: string;
  allowed_values_json: ExtraConfigOption[] | null;
  validation_regex: string | null;
  min_num: number | null;
  max_num: number | null;
  is_editable_by_tenant: boolean;
  plan_flag_key: string | null;
  rec_order: number | null;
  rec_status: number;
  is_active: boolean;
}

/** Normalized per-Organization override row from `org_tenant_extra_config_cf`. */
export interface OrgExtraConfigOverride {
  id: string;
  tenant_org_id: string;
  config_key: string;
  config_value: string;
  rec_status: number;
  is_active: boolean;
  updated_at?: Date | string | null;
}

/** Typed effective extra configuration consumed by formatters, tables, POS, and UI context. */
export interface ResolvedExtraConfig {
  numberScript: NumberScript;
  dateDigits: NumberScript;
  numberGroupingLocale: NumberGroupingLocale;
  bdiIsolationEnabled: boolean;
  defaultTablePageSize: number;
  tableDensityOverride: TableDensityOverride;
  showCurrencyCodeInTables: boolean;
  posStepperMinTarget: PosStepperMinTarget;
  /** Raw string map of all resolved active config keys (including future HQ-seeded keys). */
  valuesByKey: Record<string, string>;
}

/** Metadata + effective state for a single catalog setting rendered in the Settings UI. */
export interface ExtraConfigItemView {
  config_key: string;
  category_code: string;
  name: string;
  name2: string | null;
  description: string | null;
  description2: string | null;
  value_type: ExtraConfigValueType | string;
  default_value: string;
  effective_value: string;
  override_value: string | null;
  is_overridden: boolean;
  source: 'SYSTEM' | 'TENANT';
  is_editable_by_tenant: boolean;
  plan_flag_key: string | null;
  plan_allowed: boolean;
  allowed_values: ExtraConfigOption[];
  validation_regex: string | null;
  min_num: number | null;
  max_num: number | null;
  rec_order: number | null;
}

/** Response payload for `GET /api/v1/settings/extra-config`. */
export interface ExtraConfigScreenPayload {
  resolved: ResolvedExtraConfig;
  items: ExtraConfigItemView[];
}

/** Single mutation entry sent to `PUT /api/v1/settings/extra-config`. */
export interface ExtraConfigSaveEntry {
  config_key: string;
  config_value: string;
}
