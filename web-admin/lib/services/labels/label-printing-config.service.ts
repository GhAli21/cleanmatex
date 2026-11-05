/**
 * Label printing config (HFC P4, migration 0685, decisions A-46..A-49).
 *
 * - Platform defaults: sys_label_printing_cf (one row per label type).
 * - Tenant / branch overrides: org_label_printing_cf (branch_id NULL = tenant-wide). NULL value = inherit.
 * - Effective values: fn_label_printing_resolve(tenant, branch) = branch -> tenant -> system per column;
 *   the receipt barcode is also capped by the human_codes_scan_labels flag inside the function.
 *
 * Labels are available to every tenant (no label_printing flag). All queries are tenant scoped; pass the
 * request's Supabase client (RLS + the resolver's tenant guard apply).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LABEL_PRINTING_FIELDS,
  LABEL_TYPES,
  LABEL_TYPE_FIELDS,
  toLabelSettings,
  type LabelPrintingField,
  type LabelPrintingValues,
  type LabelSettings,
  type LabelType,
  type LabelValueSource,
  type ResolvedLabelPrinting,
} from '@/lib/services/labels/label-types';

const SYS_TABLE = 'sys_label_printing_cf';
const ORG_TABLE = 'org_label_printing_cf';
const RESOLVE_FN = 'fn_label_printing_resolve';
const VALUE_COLUMNS = 'label_type, size_code, show_qr, show_customer_name, show_order_barcode, copies';

/** DB column for each camelCase field. */
const COLUMN_OF: Record<LabelPrintingField, string> = {
  sizeCode: 'size_code',
  showQr: 'show_qr',
  showCustomerName: 'show_customer_name',
  showOrderBarcode: 'show_order_barcode',
  copies: 'copies',
};

interface DbValuesRow {
  label_type: string;
  size_code: string | null;
  show_qr: boolean | null;
  show_customer_name: boolean | null;
  show_order_barcode: boolean | null;
  copies: number | null;
}
interface DbResolvedRow extends DbValuesRow {
  show_order_barcode_configured: boolean | null;
  value_sources: Record<string, string> | null;
}

/** System defaults and the overrides of one scope, for the settings screen. */
export interface LabelPrintingConfig {
  systemDefaults: LabelPrintingValues[];
  tenantOverrides: LabelPrintingValues[];
  /** Overrides of the requested branch; empty when no branch was asked for. */
  branchOverrides: LabelPrintingValues[];
  /** Effective values for the requested scope (tenant-wide when branchId is null). */
  effective: ResolvedLabelPrinting[];
}

export class LabelPrintingConfigError extends Error {
  constructor(
    message: string,
    public readonly code: 'LOAD_FAILED' | 'SAVE_FAILED' | 'INVALID_INPUT',
  ) {
    super(message);
    this.name = 'LabelPrintingConfigError';
  }
}

function isLabelType(v: unknown): v is LabelType {
  return typeof v === 'string' && (LABEL_TYPES as readonly string[]).includes(v);
}

function toValues(r: DbValuesRow): LabelPrintingValues | null {
  if (!isLabelType(r.label_type)) return null;
  return {
    labelType: r.label_type,
    sizeCode: r.size_code ?? null,
    showQr: r.show_qr ?? null,
    showCustomerName: r.show_customer_name ?? null,
    showOrderBarcode: r.show_order_barcode ?? null,
    copies: r.copies ?? null,
  };
}

const SOURCE_KEY: Record<string, LabelPrintingField> = {
  size_code: 'sizeCode',
  show_qr: 'showQr',
  show_customer_name: 'showCustomerName',
  show_order_barcode: 'showOrderBarcode',
  copies: 'copies',
};
const SOURCES: readonly LabelValueSource[] = ['BRANCH', 'TENANT', 'SYSTEM', 'FEATURE_FLAG'];

/** One fn_label_printing_resolve row -> ResolvedLabelPrinting (unknown types are dropped). */
export function toResolved(r: DbResolvedRow): ResolvedLabelPrinting | null {
  const values = toValues(r);
  if (!values) return null;
  const sources: ResolvedLabelPrinting['sources'] = {};
  for (const [k, v] of Object.entries(r.value_sources ?? {})) {
    const field = SOURCE_KEY[k];
    if (field && (SOURCES as readonly string[]).includes(v)) sources[field] = v as LabelValueSource;
  }
  return { ...values, showOrderBarcodeConfigured: r.show_order_barcode_configured ?? null, sources };
}

/** Keeps only the fields that apply to the row's label type; the rest become null. */
export function normalizeOverride(row: LabelPrintingValues): LabelPrintingValues {
  const allowed = LABEL_TYPE_FIELDS[row.labelType];
  const out: LabelPrintingValues = { ...row };
  for (const f of LABEL_PRINTING_FIELDS) {
    if (!allowed.includes(f)) (out as unknown as Record<string, unknown>)[f] = null;
  }
  return out;
}

/** True when every value of the override is null (= nothing to keep, the row is deleted). */
export function isEmptyOverride(row: LabelPrintingValues): boolean {
  return LABEL_PRINTING_FIELDS.every((f) => row[f] === null || row[f] === undefined);
}

export const LabelPrintingConfigService = {
  /** Effective rows for a tenant, optionally for one branch (the order's branch when printing). */
  async resolve(supabase: SupabaseClient, tenantId: string, branchId: string | null): Promise<ResolvedLabelPrinting[]> {
    const { data, error } = await supabase.rpc(RESOLVE_FN, { p_tenant_id: tenantId, p_branch_id: branchId });
    if (error) throw new LabelPrintingConfigError(`label printing: resolve failed: ${error.message}`, 'LOAD_FAILED');
    return ((data ?? []) as DbResolvedRow[]).map(toResolved).filter((r): r is ResolvedLabelPrinting => r !== null);
  },

  /** Effective LabelSettings for printing. */
  async resolveLabelSettings(supabase: SupabaseClient, tenantId: string, branchId: string | null): Promise<LabelSettings> {
    return toLabelSettings(await this.resolve(supabase, tenantId, branchId));
  },

  /** Active platform defaults, in display order. */
  async getSystemDefaults(supabase: SupabaseClient): Promise<LabelPrintingValues[]> {
    const { data, error } = await supabase
      .from(SYS_TABLE)
      .select(VALUE_COLUMNS)
      .eq('is_active', true)
      .eq('rec_status', 1)
      .order('rec_order', { ascending: true });
    if (error) throw new LabelPrintingConfigError(`label printing: defaults failed: ${error.message}`, 'LOAD_FAILED');
    return ((data ?? []) as DbValuesRow[]).map(toValues).filter((r): r is LabelPrintingValues => r !== null);
  },

  /** Active overrides of one scope: branchId null = tenant-wide rows. */
  async getOverrides(supabase: SupabaseClient, tenantId: string, branchId: string | null): Promise<LabelPrintingValues[]> {
    let q = supabase
      .from(ORG_TABLE)
      .select(VALUE_COLUMNS)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .eq('rec_status', 1);
    q = branchId ? q.eq('branch_id', branchId) : q.is('branch_id', null);
    const { data, error } = await q;
    if (error) throw new LabelPrintingConfigError(`label printing: overrides failed: ${error.message}`, 'LOAD_FAILED');
    return ((data ?? []) as DbValuesRow[]).map(toValues).filter((r): r is LabelPrintingValues => r !== null);
  },

  /** Defaults, tenant overrides, the branch's overrides and the effective values, for the settings screen. */
  async getConfig(supabase: SupabaseClient, tenantId: string, branchId: string | null): Promise<LabelPrintingConfig> {
    const [systemDefaults, tenantOverrides, branchOverrides, effective] = await Promise.all([
      this.getSystemDefaults(supabase),
      this.getOverrides(supabase, tenantId, null),
      branchId ? this.getOverrides(supabase, tenantId, branchId) : Promise.resolve([]),
      this.resolve(supabase, tenantId, branchId),
    ]);
    return { systemDefaults, tenantOverrides, branchOverrides, effective };
  },

  /**
   * Saves the overrides of one scope. A row whose values are all null is removed (the scope inherits again).
   * Fields that do not apply to the label type are cleared. Rows are written one by one (at most 3).
   */
  async saveOverrides(
    supabase: SupabaseClient,
    params: { tenantId: string; branchId: string | null; userId: string | null; userInfo?: string; rows: LabelPrintingValues[] },
  ): Promise<void> {
    const { tenantId, branchId, userId, userInfo, rows } = params;
    const seen = new Set<LabelType>();
    for (const raw of rows) {
      if (!isLabelType(raw.labelType) || seen.has(raw.labelType)) {
        throw new LabelPrintingConfigError('label printing: invalid or repeated label type', 'INVALID_INPUT');
      }
      seen.add(raw.labelType);
      const row = normalizeOverride(raw);

      let existingQ = supabase
        .from(ORG_TABLE)
        .select('id')
        .eq('tenant_org_id', tenantId)
        .eq('label_type', row.labelType);
      existingQ = branchId ? existingQ.eq('branch_id', branchId) : existingQ.is('branch_id', null);
      const { data: existing, error: findError } = await existingQ.maybeSingle();
      if (findError) throw new LabelPrintingConfigError(`label printing: lookup failed: ${findError.message}`, 'SAVE_FAILED');
      const existingId = (existing as { id: string } | null)?.id ?? null;

      if (isEmptyOverride(row)) {
        if (existingId) {
          const { error } = await supabase.from(ORG_TABLE).delete().eq('tenant_org_id', tenantId).eq('id', existingId);
          if (error) throw new LabelPrintingConfigError(`label printing: reset failed: ${error.message}`, 'SAVE_FAILED');
        }
        continue;
      }

      const values: Record<string, unknown> = {};
      for (const f of LABEL_PRINTING_FIELDS) values[COLUMN_OF[f]] = row[f];

      if (existingId) {
        const { error } = await supabase
          .from(ORG_TABLE)
          .update({ ...values, is_active: true, rec_status: 1, updated_by: userId, updated_info: userInfo ?? null })
          .eq('tenant_org_id', tenantId)
          .eq('id', existingId);
        if (error) throw new LabelPrintingConfigError(`label printing: update failed: ${error.message}`, 'SAVE_FAILED');
      } else {
        const { error } = await supabase.from(ORG_TABLE).insert({
          ...values,
          tenant_org_id: tenantId,
          branch_id: branchId,
          label_type: row.labelType,
          created_by: userId,
          created_info: userInfo ?? null,
        });
        if (error) throw new LabelPrintingConfigError(`label printing: insert failed: ${error.message}`, 'SAVE_FAILED');
      }
    }
  },
};
