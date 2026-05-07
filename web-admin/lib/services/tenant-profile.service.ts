/**
 * Tenant profile service — backs the Settings → General and Settings →
 * Branding pages by reading and writing first-class columns on
 * `org_tenants_mst`.
 *
 * NOT to be confused with `tenant-settings.service.ts`, which deals with the
 * extensible per-tenant settings catalog (`sys_tenant_settings_cd`) resolved
 * via the layered RPC. Profile fields (name, contact, branding, hours) are
 * row-level columns on the tenant master and live here.
 *
 * Tenant scoping: all reads/writes filter by the caller-derived `tenantOrgId`
 * (NEVER by an id supplied in a request body). RLS policy
 * `tenant_access_own_tenant` (migration 0004) provides defence-in-depth: the
 * Supabase client cannot mutate any tenant other than the one in the JWT.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type {
  BrandingSettingsDto,
  BrandingSettingsInput,
  DbBusinessHours,
  DbDayHours,
  GeneralSettingsDto,
  GeneralSettingsInput,
  UiBusinessHours,
  UiDayHours,
} from '@/lib/types/tenant-profile';

// =============================================================================
// Business-hours normalizers
// =============================================================================

const DEFAULT_DAY: UiDayHours = { open: '09:00', close: '18:00', closed: false };

const DEFAULT_UI_HOURS: UiBusinessHours = {
  monday: DEFAULT_DAY,
  tuesday: DEFAULT_DAY,
  wednesday: DEFAULT_DAY,
  thursday: DEFAULT_DAY,
  friday: DEFAULT_DAY,
  saturday: { open: '09:00', close: '14:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

// UI key → DB key. The DB seeded in migration 0006 uses 3-letter keys.
const UI_TO_DB_KEY: Record<keyof UiBusinessHours, keyof DbBusinessHours> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

const DB_TO_UI_KEY: Record<keyof DbBusinessHours, keyof UiBusinessHours> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

/**
 * Convert UI hours to the DB JSONB shape. Closed days collapse to `null`
 * (matching the seed in 0006_tenant_enhancements). Open/close times are kept
 * verbatim — caller is expected to validate HH:mm format.
 */
export function toDbHours(hours: UiBusinessHours): DbBusinessHours {
  const out: DbBusinessHours = {};
  for (const uiKey of Object.keys(UI_TO_DB_KEY) as (keyof UiBusinessHours)[]) {
    const dbKey = UI_TO_DB_KEY[uiKey];
    const day = hours[uiKey];
    out[dbKey] = day.closed ? null : { open: day.open, close: day.close };
  }
  return out;
}

/**
 * Convert DB hours to the UI shape. Missing or `null` day entries are
 * surfaced as `closed: true` with neutral open/close times so the editor
 * has something to render when the user toggles the day back on.
 */
export function fromDbHours(hours: DbBusinessHours | null | undefined): UiBusinessHours {
  if (!hours) return DEFAULT_UI_HOURS;
  const out: UiBusinessHours = { ...DEFAULT_UI_HOURS };
  for (const dbKey of Object.keys(DB_TO_UI_KEY) as (keyof DbBusinessHours)[]) {
    const uiKey = DB_TO_UI_KEY[dbKey];
    const day = hours[dbKey] as DbDayHours | null | undefined;
    if (day == null) {
      out[uiKey] = { open: '00:00', close: '00:00', closed: true };
    } else {
      out[uiKey] = { open: day.open, close: day.close, closed: false };
    }
  }
  return out;
}

// =============================================================================
// Profile read
// =============================================================================

const PROFILE_COLUMNS =
  'id, name, name2, email, phone, address, city, country, currency, timezone, language, business_hours, logo_url, brand_color_primary, brand_color_secondary, brand_color_accent';

/**
 * Load the General + Branding view of a tenant in one round-trip, plus the
 * lock flags driven by whether any orders already exist for the tenant.
 *
 * @param tenantOrgId — tenant id, MUST come from the authenticated session,
 *                       never from request input.
 */
export async function getTenantProfile(
  tenantOrgId: string
): Promise<{ general: GeneralSettingsDto; branding: BrandingSettingsDto }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('org_tenants_mst')
    .select(PROFILE_COLUMNS)
    .eq('id', tenantOrgId)
    .single();

  if (error) {
    logger.error('tenant-profile: getTenantProfile failed', { tenantOrgId, error });
    throw new Error('Failed to load tenant profile');
  }

  // Lock flags: currency/country can't be changed once orders exist.
  const hasOrders = await tenantHasOrders(tenantOrgId);

  const general: GeneralSettingsDto = {
    businessName: data.name ?? '',
    businessNameAr: data.name2 ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    address: data.address ?? '',
    city: data.city ?? '',
    country: data.country ?? '',
    timezone: data.timezone ?? '',
    currency: data.currency ?? '',
    defaultLanguage: data.language ?? 'en',
    businessHours: fromDbHours(data.business_hours as DbBusinessHours | null),
    isLocked: { currency: hasOrders, country: hasOrders },
  };

  const branding: BrandingSettingsDto = {
    logo: data.logo_url ?? '',
    primaryColor: data.brand_color_primary ?? '#3B82F6',
    secondaryColor: data.brand_color_secondary ?? '#10B981',
    accentColor: data.brand_color_accent ?? '#F59E0B',
  };

  return { general, branding };
}

async function tenantHasOrders(tenantOrgId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from('org_orders_mst')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantOrgId)
    .limit(1);
  if (error) {
    // Fail closed: if we cannot determine, treat as locked to avoid a
    // currency mismatch on top of broken data. Surface a log line.
    logger.error('tenant-profile: tenantHasOrders count failed', { tenantOrgId, error });
    return true;
  }
  return (count ?? 0) > 0;
}

// =============================================================================
// Profile updates
// =============================================================================

export interface AuditMeta {
  userId: string;
  userInfo?: string; // optional ip/user-agent stamp
}

/**
 * Discriminator for predictable error mapping in the API route. Lets the
 * route translate domain rules into the right HTTP status without parsing
 * raw Postgres error codes.
 */
export class TenantProfileError extends Error {
  constructor(
    public readonly code:
      | 'EMAIL_TAKEN'
      | 'CURRENCY_LOCKED'
      | 'COUNTRY_LOCKED'
      | 'NOT_FOUND'
      | 'INTERNAL',
    message: string
  ) {
    super(message);
    this.name = 'TenantProfileError';
  }
}

export async function updateTenantGeneral(
  tenantOrgId: string,
  input: GeneralSettingsInput,
  audit: AuditMeta
): Promise<GeneralSettingsDto> {
  const supabase = await createServerSupabaseClient();

  // Load current row to enforce currency/country lock and to detect orphaned
  // change attempts. RLS guarantees this returns the caller's tenant only.
  const { data: current, error: readErr } = await supabase
    .from('org_tenants_mst')
    .select('currency, country, email')
    .eq('id', tenantOrgId)
    .single();

  if (readErr || !current) {
    throw new TenantProfileError('NOT_FOUND', 'Tenant not found');
  }

  // Enforce currency/country lock once the tenant has any orders.
  if (input.currency !== current.currency || input.country !== current.country) {
    if (await tenantHasOrders(tenantOrgId)) {
      if (input.currency !== current.currency) {
        throw new TenantProfileError(
          'CURRENCY_LOCKED',
          'Currency cannot be changed after orders have been created'
        );
      }
      if (input.country !== current.country) {
        throw new TenantProfileError(
          'COUNTRY_LOCKED',
          'Country cannot be changed after orders have been created'
        );
      }
    }
  }

  const update = {
    name: input.businessName,
    name2: input.businessNameAr ?? null,
    email: input.email,
    phone: input.phone,
    address: input.address ?? null,
    city: input.city ?? null,
    country: input.country,
    timezone: input.timezone,
    currency: input.currency,
    language: input.defaultLanguage,
    business_hours: toDbHours(input.businessHours),
    updated_at: new Date().toISOString(),
    updated_by: audit.userId,
    updated_info: audit.userInfo ?? null,
  };

  const { error } = await supabase
    .from('org_tenants_mst')
    .update(update)
    .eq('id', tenantOrgId);

  if (error) {
    // 23505 = unique_violation; only `email` and `slug` carry that constraint
    // on this table, and slug isn't editable here.
    if ((error as { code?: string }).code === '23505') {
      throw new TenantProfileError('EMAIL_TAKEN', 'Email is already in use');
    }
    logger.error('tenant-profile: updateTenantGeneral failed', { tenantOrgId, error });
    throw new TenantProfileError('INTERNAL', 'Failed to update general settings');
  }

  const { general } = await getTenantProfile(tenantOrgId);
  return general;
}

export interface UpdateBrandingResult {
  branding: BrandingSettingsDto;
  /**
   * URL of the previous logo (if any) that the route may delete from
   * storage as a best-effort cleanup. Surfaced from the service so that
   * the storage layer stays out of the service module — keeps build-time
   * import graphs clean and keeps layers honest.
   */
  previousLogoUrl: string | null;
}

export async function updateTenantBranding(
  tenantOrgId: string,
  input: BrandingSettingsInput,
  audit: AuditMeta
): Promise<UpdateBrandingResult> {
  const supabase = await createServerSupabaseClient();

  // Capture the previous logo so the route can clean it up after success.
  const { data: current, error: readErr } = await supabase
    .from('org_tenants_mst')
    .select('logo_url')
    .eq('id', tenantOrgId)
    .single();

  if (readErr || !current) {
    throw new TenantProfileError('NOT_FOUND', 'Tenant not found');
  }

  const update = {
    logo_url: input.logo || null,
    brand_color_primary: input.primaryColor,
    brand_color_secondary: input.secondaryColor,
    brand_color_accent: input.accentColor,
    updated_at: new Date().toISOString(),
    updated_by: audit.userId,
    updated_info: audit.userInfo ?? null,
  };

  const { error } = await supabase
    .from('org_tenants_mst')
    .update(update)
    .eq('id', tenantOrgId);

  if (error) {
    logger.error('tenant-profile: updateTenantBranding failed', { tenantOrgId, error });
    throw new TenantProfileError('INTERNAL', 'Failed to update branding settings');
  }

  const previousLogoUrl = (current.logo_url as string | null) ?? null;
  const replaced = previousLogoUrl && previousLogoUrl !== input.logo;
  const { branding } = await getTenantProfile(tenantOrgId);
  return { branding, previousLogoUrl: replaced ? previousLogoUrl : null };
}
