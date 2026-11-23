/**
 * UoM service: an Organization's units and conversions (org_uom_cf / org_uom_conv_cf).
 *
 * Tenants may only SELECT these tables (0813); every write goes through the admin
 * client, so each query here filters `tenant_org_id` itself. The database triggers
 * stay the last line of defence — their `UOM_*` messages are mapped to `UomRuleError`.
 * Tenant resolved by the caller from the authenticated session.
 */
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { catalogReadClient } from '@/lib/supabase/catalog-read';
import { createUomResolver, UomRuleError, type UomResolver } from '@/lib/uom';
import { parseUomErrorCode, UOM_ERROR_CODES, type UomDimension } from '@/lib/constants/uom';
import type { Database } from '@/types/database';
import type { UomConversion, UomOrigin, UomUnit } from '@/lib/types/uom';
import type {
  AddSystemUnitsInput, ConversionInput, CreateCustomUnitInput, UpdateUnitInput,
} from '@/lib/validations/uom-schemas';

type UnitRow = Database['public']['Tables']['org_uom_cf']['Row'];
type ConvRow = Database['public']['Tables']['org_uom_conv_cf']['Row'];

const UNIT_COLUMNS =
  'uom_code, sys_uom_code, is_customized, name, name2, symbol, symbol2, uom_dimension, is_base_unit, is_packaging, qty_decimals, unece_code, is_active, rec_order';
const CONV_COLUMNS =
  'id, product_id, from_uom_code, to_uom_code, multiply_rate, divide_rate, is_from_system, is_customized, is_active, rec_notes';

const toUnit = (r: Pick<UnitRow, 'uom_code' | 'sys_uom_code' | 'is_customized' | 'name' | 'name2' | 'symbol' | 'symbol2' | 'uom_dimension' | 'is_base_unit' | 'is_packaging' | 'qty_decimals' | 'unece_code' | 'is_active' | 'rec_order'>): UomUnit => ({
  code: r.uom_code,
  sysCode: r.sys_uom_code,
  origin: (r.sys_uom_code == null ? 'CUSTOM' : r.is_customized ? 'CUSTOMIZED' : 'SYSTEM') as UomOrigin,
  name: r.name, name2: r.name2, symbol: r.symbol, symbol2: r.symbol2,
  dimension: r.uom_dimension as UomDimension,
  isBaseUnit: r.is_base_unit, isPackaging: r.is_packaging, qtyDecimals: r.qty_decimals,
  uneceCode: r.unece_code, isActive: r.is_active, displayOrder: r.rec_order,
});

const toConversion = (r: Pick<ConvRow, 'id' | 'product_id' | 'from_uom_code' | 'to_uom_code' | 'multiply_rate' | 'divide_rate' | 'is_from_system' | 'is_customized' | 'is_active' | 'rec_notes'>): UomConversion => ({
  id: r.id, productId: r.product_id, fromCode: r.from_uom_code, toCode: r.to_uom_code,
  // numeric(28,12) arrives as a number or text; keep the text form so no digit is lost.
  multiplyRate: String(r.multiply_rate), divideRate: String(r.divide_rate),
  isFromSystem: r.is_from_system, isCustomized: r.is_customized, isActive: r.is_active, notes: r.rec_notes,
});

/** Maps a database error carrying a `UOM_*` code to a UomRuleError; rethrows anything else. */
function rethrow(error: { message: string }): never {
  const code = parseUomErrorCode(error.message);
  if (code) throw new UomRuleError(code, error.message.replace(/^[A-Z_]+:\s*/, ''));
  throw new Error(error.message);
}

const audit = (userId: string) => ({ updated_by: userId, updated_at: new Date().toISOString() });

/**
 * The Organization's units.
 * @param tenantOrgId the Organization
 * @param options.activeOnly true (default) hides switched-off units
 */
export async function listUnits(tenantOrgId: string, options: { activeOnly?: boolean } = {}): Promise<UomUnit[]> {
  const admin = createAdminSupabaseClient();
  let q = admin.from('org_uom_cf').select(UNIT_COLUMNS).eq('tenant_org_id', tenantOrgId).eq('rec_status', 1);
  if (options.activeOnly ?? true) q = q.eq('is_active', true);
  const { data, error } = await q.order('uom_dimension').order('rec_order', { nullsFirst: false }).order('uom_code');
  if (error) rethrow(error);
  return (data ?? []).map(toUnit);
}

/**
 * System units the Organization does not have yet ("Add from system catalog").
 * @param tenantOrgId the Organization
 */
export async function listAddableSystemUnits(tenantOrgId: string): Promise<Omit<UomUnit, 'origin' | 'isActive' | 'displayOrder' | 'sysCode'>[]> {
  const [{ data: sys, error }, { data: have, error: e2 }] = await Promise.all([
    catalogReadClient().from('sys_uom_cd')
      .select('uom_code, name, name2, symbol, symbol2, uom_dimension, is_base_unit, is_packaging, qty_decimals, unece_code')
      .eq('is_active', true).order('uom_dimension').order('uom_code'),
    createAdminSupabaseClient().from('org_uom_cf').select('sys_uom_code').eq('tenant_org_id', tenantOrgId).not('sys_uom_code', 'is', null),
  ]);
  if (error) rethrow(error);
  if (e2) rethrow(e2);
  const owned = new Set((have ?? []).map((r) => r.sys_uom_code));
  return (sys ?? []).filter((r) => !owned.has(r.uom_code)).map((r) => ({
    code: r.uom_code, name: r.name, name2: r.name2, symbol: r.symbol, symbol2: r.symbol2,
    dimension: r.uom_dimension as UomDimension, isBaseUnit: r.is_base_unit, isPackaging: r.is_packaging,
    qtyDecimals: r.qty_decimals, uneceCode: r.unece_code,
  }));
}

/**
 * Adds system units (and their system conversions) to the Organization.
 * @param tenantOrgId the Organization
 * @param input codes from the system catalog
 * @returns rows added
 */
export async function addSystemUnits(tenantOrgId: string, input: AddSystemUnitsInput): Promise<number> {
  const { data, error } = await createAdminSupabaseClient().rpc('fn_uom_seed_tenant', {
    p_tenant_org_id: tenantOrgId, p_uom_codes: input.codes,
  });
  if (error) rethrow(error);
  return Number(data ?? 0);
}

/**
 * Creates a custom unit.
 * @param tenantOrgId the Organization
 * @param userId the acting user (audit)
 */
export async function createCustomUnit(tenantOrgId: string, userId: string, input: CreateCustomUnitInput): Promise<UomUnit> {
  const { data, error } = await createAdminSupabaseClient().from('org_uom_cf').insert({
    tenant_org_id: tenantOrgId, uom_code: input.code, uom_dimension: input.dimension,
    name: input.name, name2: input.name2 ?? null, symbol: input.symbol, symbol2: input.symbol2 ?? null,
    qty_decimals: input.qtyDecimals, is_packaging: input.isPackaging, unece_code: input.uneceCode ?? null,
    rec_order: input.displayOrder ?? null, created_by: userId,
  }).select(UNIT_COLUMNS).single();
  if (error) rethrow(error);
  return toUnit(data as UnitRow);
}

/**
 * Edits a unit's presentation fields or switches it on/off.
 * @param tenantOrgId the Organization
 * @param code the unit code
 */
export async function updateUnit(tenantOrgId: string, userId: string, code: string, input: UpdateUnitInput): Promise<UomUnit> {
  const patch: Database['public']['Tables']['org_uom_cf']['Update'] = { ...audit(userId) };
  if (input.name !== undefined) patch.name = input.name;
  if (input.name2 !== undefined) patch.name2 = input.name2;
  if (input.symbol !== undefined) patch.symbol = input.symbol;
  if (input.symbol2 !== undefined) patch.symbol2 = input.symbol2;
  if (input.qtyDecimals !== undefined) patch.qty_decimals = input.qtyDecimals;
  if (input.displayOrder !== undefined) patch.rec_order = input.displayOrder;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const { data, error } = await createAdminSupabaseClient().from('org_uom_cf').update(patch)
    .eq('tenant_org_id', tenantOrgId).eq('uom_code', code).select(UNIT_COLUMNS).maybeSingle();
  if (error) rethrow(error);
  if (!data) throw new UomRuleError(UOM_ERROR_CODES.UOM_NOT_FOUND, `unit ${code} not found`, { code });
  return toUnit(data as UnitRow);
}

/** Resets a seeded unit's presentation fields to the system values ("Reset to system"). */
export async function resetUnit(tenantOrgId: string, userId: string, code: string): Promise<void> {
  const { error } = await createAdminSupabaseClient().rpc('fn_uom_reset_unit', { p_tenant_org_id: tenantOrgId, p_uom_code: code, p_user: userId });
  if (error) rethrow(error);
}

/**
 * The Organization's conversions (tenant-wide plus per-product when `productId` is given).
 * @param productId null/omitted = tenant-wide pairs only
 */
export async function listConversions(tenantOrgId: string, options: { productId?: string | null; activeOnly?: boolean } = {}): Promise<UomConversion[]> {
  let q = createAdminSupabaseClient().from('org_uom_conv_cf').select(CONV_COLUMNS).eq('tenant_org_id', tenantOrgId).eq('rec_status', 1);
  q = options.productId ? q.eq('product_id', options.productId) : q.is('product_id', null);
  if (options.activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q.order('from_uom_code').order('to_uom_code');
  if (error) rethrow(error);
  return (data ?? []).map(toConversion);
}

/** Creates a conversion pair. */
export async function createConversion(tenantOrgId: string, userId: string, input: ConversionInput): Promise<UomConversion> {
  const { data, error } = await createAdminSupabaseClient().from('org_uom_conv_cf').insert({
    tenant_org_id: tenantOrgId, product_id: input.productId ?? null,
    from_uom_code: input.fromCode, to_uom_code: input.toCode,
    multiply_rate: Number(input.multiplyRate), divide_rate: Number(input.divideRate),
    is_active: input.isActive, rec_notes: input.notes ?? null, created_by: userId,
  }).select(CONV_COLUMNS).single();
  if (error) rethrow(error);
  return toConversion(data as ConvRow);
}

/** Changes a conversion's rates / on-off / notes (the pair itself is immutable). */
export async function updateConversion(
  tenantOrgId: string, userId: string, id: string,
  input: Pick<ConversionInput, 'multiplyRate' | 'divideRate' | 'isActive' | 'notes'>,
): Promise<UomConversion> {
  const { data, error } = await createAdminSupabaseClient().from('org_uom_conv_cf').update({
    multiply_rate: Number(input.multiplyRate), divide_rate: Number(input.divideRate),
    is_active: input.isActive, rec_notes: input.notes ?? null, ...audit(userId),
  }).eq('tenant_org_id', tenantOrgId).eq('id', id).select(CONV_COLUMNS).maybeSingle();
  if (error) rethrow(error);
  if (!data) throw new UomRuleError(UOM_ERROR_CODES.UOM_CONVERSION_MISSING, `conversion ${id} not found`, { id });
  return toConversion(data as ConvRow);
}

/** Resets a seeded conversion to the system rates. */
export async function resetConversion(tenantOrgId: string, userId: string, id: string): Promise<void> {
  const { error } = await createAdminSupabaseClient().rpc('fn_uom_reset_conv', { p_tenant_org_id: tenantOrgId, p_conv_id: id, p_user: userId });
  if (error) rethrow(error);
}

/**
 * One resolver for the Organization (units + all active conversions, tenant-wide and
 * per-product) — build once per request, convert many lines in memory.
 */
export async function loadUomResolver(tenantOrgId: string): Promise<UomResolver> {
  const admin = createAdminSupabaseClient();
  const [units, convs] = await Promise.all([
    admin.from('org_uom_cf').select(UNIT_COLUMNS).eq('tenant_org_id', tenantOrgId).eq('rec_status', 1),
    admin.from('org_uom_conv_cf').select(CONV_COLUMNS).eq('tenant_org_id', tenantOrgId).eq('rec_status', 1).eq('is_active', true),
  ]);
  if (units.error) rethrow(units.error);
  if (convs.error) rethrow(convs.error);
  return createUomResolver((units.data ?? []).map(toUnit), (convs.data ?? []).map(toConversion));
}
