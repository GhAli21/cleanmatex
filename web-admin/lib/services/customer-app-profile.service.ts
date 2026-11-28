import 'server-only';

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { normalizePhone } from './customers.service';
import { getTenantPrimaryColor } from './ui-theme.service';

/** Storage provenance for a customer address row. */
export type CustomerAddressSource = 'SYS' | 'ORG';

/** Canonical customer address DTO returned to Customer App endpoints. */
export interface CustomerAppAddressDto {
  id: string;
  source: CustomerAddressSource;
  addressType: string;
  label: string;
  description: string;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  street: string | null;
  area: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryNotes: string | null;
  isDefault: boolean;
}

/** Input payload for creating a customer address in SYS or ORG scope. */
export interface CreateCustomerAppAddressInput {
  addressType?: 'home' | 'work' | 'other';
  label: string;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  street?: string | null;
  area?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deliveryNotes?: string | null;
  isDefault?: boolean;
}

/** Full registered customer profile exposed to the authenticated customer. */
export interface CustomerAppProfileDto {
  orgCustomerId: string;
  sysCustomerId: string | null;
  hasSysCustomerId: boolean;
  customerCode: string | null;
  name: string | null;
  name2: string | null;
  displayName: string | null;
  mobile: string | null;
  mobileVerified: boolean;
  email: string | null;
  emailVerified: boolean;
  profileStatus: string;
  loyaltyPoints: number;
  memberSince: string | null;
  preferredLanguage: string | null;
  preferences: Record<string, unknown>;
  defaultOrderNote: string | null;
  autoApplyOrderDefaultNote: boolean;
  lastBranchId: string | null;
  lastBranchName: string | null;
  lastBranchName2: string | null;
}

/** Patch payload for customer-initiated profile, contact, and preference edits. */
export interface UpdateCustomerAppProfileInput {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  preferredLanguage?: 'en' | 'ar' | null;
  preferences?: Record<string, unknown>;
  defaultOrderNote?: string | null;
  autoApplyOrderDefaultNote?: boolean;
}

/** Branch option eligible for Customer App ordering. */
export interface CustomerAppBranchDto {
  id: string;
  name: string;
  name2: string | null;
  timeZone: string | null;
  deliveryFee: number;
  isMain: boolean;
}

/** Linked Organization summary including active/hidden flag and last branch. */
export interface CustomerAppTenantDto {
  tenantOrgId: string;
  orgCustomerId: string;
  name: string;
  name2: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  isHiddenByCustomer: boolean;
  lastBranchId: string | null;
  lastBranchName: string | null;
  lastBranchName2: string | null;
  activeOrderCount: number;
  branches: CustomerAppBranchDto[];
}

/** Typed domain error for profile/contact uniqueness and validation guards. */
export class CustomerAppProfileError extends Error {
  constructor(
    public readonly code:
      | 'CONTACT_ALREADY_IN_USE'
      | 'INVALID_MOBILE'
      | 'INVALID_EMAIL'
      | 'BRANCH_NOT_ELIGIBLE'
      | 'ADDRESS_LIMIT_REACHED'
      | 'ADDRESS_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'CustomerAppProfileError';
  }
}

function buildAddressDescription(parts: {
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  street?: string | null;
  area?: string | null;
  city?: string | null;
}): string {
  return [parts.building, parts.floor, parts.apartment, parts.street, parts.area, parts.city]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
}

function mapAddressRow(
  row: Record<string, unknown>,
  source: CustomerAddressSource,
): CustomerAppAddressDto {
  const building = (row.building as string | null) ?? null;
  const floor = (row.floor as string | null) ?? null;
  const apartment = (row.apartment as string | null) ?? null;
  const street = (row.street as string | null) ?? null;
  const area = (row.area as string | null) ?? null;
  const city = (row.city as string | null) ?? null;
  const label = ((row.label as string | null) ?? '').trim() || 'Address';
  const desc = buildAddressDescription({ building, floor, apartment, street, area, city });

  return {
    id: String(row.id),
    source,
    addressType: ((row.address_type as string | null) ?? 'home').toLowerCase(),
    label,
    description: desc.length > 0 ? desc : label,
    building,
    floor,
    apartment,
    street,
    area,
    city,
    country: (row.country as string | null) ?? null,
    postalCode: (row.postal_code as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    deliveryNotes: (row.delivery_notes as string | null) ?? null,
    isDefault: row.is_default === true,
  };
}

/**
 * Syncs `org_customers_mst.last_branch_id` only when the branch belongs to the
 * tenant, is active and customer-app-enabled, and differs from the stored value.
 *
 * @param tenantOrgId - Organization tenant_org_id (enforced explicitly in every query).
 * @param orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @param branchId - Selected branch UUID.
 * @example
 * await syncCustomerLastBranch(tenantOrgId, session.customerId, branchId);
 */
export async function syncCustomerLastBranch(
  tenantOrgId: string,
  orgCustomerId: string,
  branchId: string | null | undefined,
): Promise<void> {
  if (!branchId) return;

  const supabase = createAdminSupabaseClient();

  const { data: branch } = await supabase
    .from('org_branches_mst')
    .select('id')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', branchId)
    .eq('is_active', true)
    .eq('is_customer_app_enabled', true)
    .maybeSingle();

  if (!branch) return;

  const { data: existing } = await supabase
    .from('org_customers_mst')
    .select('last_branch_id')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', orgCustomerId)
    .maybeSingle();

  if (!existing || existing.last_branch_id === branchId) return;

  const { error } = await supabase
    .from('org_customers_mst')
    .update({
      last_branch_id: branchId,
      updated_at: new Date().toISOString(),
      updated_info: 'customer_app_last_branch_sync',
    })
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', orgCustomerId);

  if (error) {
    logger.warn('Failed to sync customer last_branch_id', {
      feature: 'customer_app_profile',
      tenantOrgId,
      orgCustomerId,
      branchId,
      error: error.message,
    });
  }
}

/**
 * Reads the complete Customer App profile combining global `sys_customers_mst`
 * data (when linked) with tenant-scoped `org_customers_mst` data.
 *
 * @param params.tenantOrgId - Active Organization tenant_org_id.
 * @param params.orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @param params.sysCustomerId - Optional global sys_customers_mst.id.
 * @returns Full customer profile DTO with validated lastBranchId.
 * @example
 * const profile = await getCustomerAppProfile({ tenantOrgId, orgCustomerId, sysCustomerId });
 */
export async function getCustomerAppProfile(params: {
  tenantOrgId: string;
  orgCustomerId: string;
  sysCustomerId: string | null;
}): Promise<CustomerAppProfileDto> {
  const supabase = createAdminSupabaseClient();

  const { data: orgRow, error: orgError } = await supabase
    .from('org_customers_mst')
    .select(
      'id, customer_id, name, name2, display_name, phone, email, loyalty_points, s_date, preferred_language, preferences, default_order_note, auto_apply_order_default_note, last_branch_id',
    )
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.orgCustomerId)
    .maybeSingle();

  if (orgError || !orgRow) {
    throw new Error(orgError?.message ?? 'Customer profile not found');
  }

  const effectiveSysId = (params.sysCustomerId ?? orgRow.customer_id ?? null) as string | null;
  let sysRow: Record<string, unknown> | null = null;

  if (effectiveSysId) {
    const { data } = await supabase
      .from('sys_customers_mst')
      .select(
        'id, customer_number, name, name2, display_name, phone, mobile_e164, email, email_normalized, phone_verified, email_verified, profile_status, created_at, preferences, default_order_note, auto_apply_order_default_note',
      )
      .eq('id', effectiveSysId)
      .maybeSingle();
    sysRow = (data as Record<string, unknown> | null) ?? null;
  }

  // Validate last_branch_id against active + customer-app-enabled branches so
  // disabled branches are never returned as pre-selected defaults.
  let validLastBranchId: string | null = null;
  let lastBranchName: string | null = null;
  let lastBranchName2: string | null = null;

  if (orgRow.last_branch_id) {
    const { data: branchRow } = await supabase
      .from('org_branches_mst')
      .select('id, name, name2')
      .eq('tenant_org_id', params.tenantOrgId)
      .eq('id', orgRow.last_branch_id)
      .eq('is_active', true)
      .eq('is_customer_app_enabled', true)
      .maybeSingle();

    if (branchRow) {
      validLastBranchId = branchRow.id;
      lastBranchName = branchRow.name ?? null;
      lastBranchName2 = branchRow.name2 ?? null;
    }
  }

  const rawPrefs = (sysRow?.preferences ?? orgRow.preferences ?? {}) as Record<string, unknown>;
  const defaultOrderNote =
    (sysRow?.default_order_note as string | null | undefined) ??
    (orgRow.default_order_note as string | null | undefined) ??
    null;
  const autoApplyOrderDefaultNote = effectiveSysId
    ? sysRow?.auto_apply_order_default_note === true
    : orgRow.auto_apply_order_default_note === true;

  return {
    orgCustomerId: orgRow.id,
    sysCustomerId: effectiveSysId,
    hasSysCustomerId: Boolean(effectiveSysId),
    customerCode: (sysRow?.customer_number as string | null | undefined) ?? null,
    name: (sysRow?.name as string | null | undefined) ?? orgRow.name ?? null,
    name2: (sysRow?.name2 as string | null | undefined) ?? orgRow.name2 ?? null,
    displayName:
      (sysRow?.display_name as string | null | undefined) ??
      orgRow.display_name ??
      orgRow.name ??
      null,
    mobile:
      (sysRow?.mobile_e164 as string | null | undefined) ??
      (sysRow?.phone as string | null | undefined) ??
      orgRow.phone ??
      null,
    mobileVerified: sysRow?.phone_verified === true,
    email:
      (sysRow?.email as string | null | undefined) ??
      (sysRow?.email_normalized as string | null | undefined) ??
      orgRow.email ??
      null,
    emailVerified: sysRow?.email_verified === true,
    profileStatus: ((sysRow?.profile_status as string | null | undefined) ?? 'full').toLowerCase(),
    loyaltyPoints: Number(orgRow.loyalty_points ?? 0),
    memberSince:
      (sysRow?.created_at as string | null | undefined) ??
      (orgRow.s_date as string | null | undefined) ??
      null,
    preferredLanguage: (orgRow.preferred_language as string | null | undefined) ?? null,
    preferences: typeof rawPrefs === 'object' && rawPrefs !== null ? rawPrefs : {},
    defaultOrderNote,
    autoApplyOrderDefaultNote,
    lastBranchId: validLastBranchId,
    lastBranchName,
    lastBranchName2,
  };
}

/**
 * Updates customer profile, contact details, care preferences, and saved default
 * order note. Persists to `sys_customers_mst` when the customer has a global ID,
 * otherwise to `org_customers_mst` (explicit `tenant_org_id`).
 *
 * @param params.tenantOrgId - Active Organization tenant_org_id.
 * @param params.orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @param params.sysCustomerId - Optional global sys_customers_mst.id.
 * @param params.patch - Validated profile changes.
 * @returns Updated CustomerAppProfileDto.
 * @throws CustomerAppProfileError on invalid contact format or duplicate global contact.
 */
export async function updateCustomerAppProfile(params: {
  tenantOrgId: string;
  orgCustomerId: string;
  sysCustomerId: string | null;
  patch: UpdateCustomerAppProfileInput;
}): Promise<CustomerAppProfileDto> {
  const supabase = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();

  // ─── Validate & Normalize Contact Fields ──────────────────────────────────
  let normalizedMobile: string | null | undefined = undefined;
  if (params.patch.mobile !== undefined) {
    const rawMobile = (params.patch.mobile ?? '').trim();
    if (rawMobile.length === 0) {
      normalizedMobile = null;
    } else {
      const parsed = normalizePhone(rawMobile);
      if (!parsed.isValid) {
        throw new CustomerAppProfileError('INVALID_MOBILE', 'Mobile number format is invalid');
      }
      normalizedMobile = parsed.normalized;
    }
  }

  let normalizedEmail: string | null | undefined = undefined;
  if (params.patch.email !== undefined) {
    const rawEmail = (params.patch.email ?? '').trim().toLowerCase();
    if (rawEmail.length === 0) {
      normalizedEmail = null;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      throw new CustomerAppProfileError('INVALID_EMAIL', 'Email address format is invalid');
    } else {
      normalizedEmail = rawEmail;
    }
  }

  // ─── Global Target: sys_customers_mst ─────────────────────────────────────
  if (params.sysCustomerId) {
    if (normalizedMobile) {
      const { data: conflict } = await supabase
        .from('sys_customers_mst')
        .select('id')
        .eq('mobile_e164', normalizedMobile)
        .neq('id', params.sysCustomerId)
        .maybeSingle();
      if (conflict) {
        throw new CustomerAppProfileError(
          'CONTACT_ALREADY_IN_USE',
          'This mobile number is already linked to another account',
        );
      }
    }

    if (normalizedEmail) {
      const { data: conflict } = await supabase
        .from('sys_customers_mst')
        .select('id')
        .eq('email_normalized', normalizedEmail)
        .neq('id', params.sysCustomerId)
        .maybeSingle();
      if (conflict) {
        throw new CustomerAppProfileError(
          'CONTACT_ALREADY_IN_USE',
          'This email address is already linked to another account',
        );
      }
    }

    const sysUpdate: Record<string, unknown> = {
      updated_at: nowIso,
      updated_info: 'customer_app_profile_patch',
    };
    if (params.patch.name !== undefined) {
      const trimmedName = (params.patch.name ?? '').trim() || null;
      sysUpdate.name = trimmedName;
      sysUpdate.display_name = trimmedName;
    }
    if (normalizedMobile !== undefined) {
      sysUpdate.phone = normalizedMobile;
      sysUpdate.mobile_e164 = normalizedMobile;
      sysUpdate.phone_verified = false;
    }
    if (normalizedEmail !== undefined) {
      sysUpdate.email = normalizedEmail;
      sysUpdate.email_normalized = normalizedEmail;
      sysUpdate.email_verified = false;
    }
    if (params.patch.preferences !== undefined) {
      sysUpdate.preferences = params.patch.preferences;
    }
    if (params.patch.defaultOrderNote !== undefined) {
      sysUpdate.default_order_note = (params.patch.defaultOrderNote ?? '').trim() || null;
    }
    if (params.patch.autoApplyOrderDefaultNote !== undefined) {
      sysUpdate.auto_apply_order_default_note = params.patch.autoApplyOrderDefaultNote;
    }

    const { error: sysErr } = await supabase
      .from('sys_customers_mst')
      .update(sysUpdate)
      .eq('id', params.sysCustomerId);

    if (sysErr) {
      if (sysErr.code === '23505') {
        throw new CustomerAppProfileError(
          'CONTACT_ALREADY_IN_USE',
          'This contact is already linked to another account',
        );
      }
      throw sysErr;
    }
  }

  // ─── Org Mirror / Org-Only Fallback: org_customers_mst ───────────────────
  const orgUpdate: Record<string, unknown> = {
    updated_at: nowIso,
    updated_info: 'customer_app_profile_patch',
  };
  if (params.patch.preferredLanguage !== undefined) {
    orgUpdate.preferred_language = params.patch.preferredLanguage;
  }
  if (params.patch.name !== undefined) {
    const trimmedName = (params.patch.name ?? '').trim() || null;
    orgUpdate.name = trimmedName;
    orgUpdate.display_name = trimmedName;
  }
  if (params.patch.preferences !== undefined) {
    orgUpdate.preferences = params.patch.preferences;
  }
  if (params.patch.defaultOrderNote !== undefined) {
    orgUpdate.default_order_note = (params.patch.defaultOrderNote ?? '').trim() || null;
  }
  if (params.patch.autoApplyOrderDefaultNote !== undefined) {
    orgUpdate.auto_apply_order_default_note = params.patch.autoApplyOrderDefaultNote;
  }
  // When org-only (no global sysCustomerId), org_customers_mst owns contact fields.
  if (!params.sysCustomerId) {
    if (normalizedMobile !== undefined) orgUpdate.phone = normalizedMobile;
    if (normalizedEmail !== undefined) orgUpdate.email = normalizedEmail;
  }

  const { error: orgErr } = await supabase
    .from('org_customers_mst')
    .update(orgUpdate)
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.orgCustomerId);

  if (orgErr) {
    throw orgErr;
  }

  return getCustomerAppProfile({
    tenantOrgId: params.tenantOrgId,
    orgCustomerId: params.orgCustomerId,
    sysCustomerId: params.sysCustomerId,
  });
}

/**
 * Lists customer addresses across `sys_customer_addresses_dtl` (when global
 * identity exists) merged with any legacy tenant `org_customer_addresses`.
 *
 * @param params.tenantOrgId - Active Organization tenant_org_id.
 * @param params.orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @param params.sysCustomerId - Optional global sys_customers_mst.id.
 * @returns Ordered list of customer addresses with explicit SYS/ORG source tag.
 */
export async function listCustomerAppAddresses(params: {
  tenantOrgId: string;
  orgCustomerId: string;
  sysCustomerId: string | null;
}): Promise<CustomerAppAddressDto[]> {
  const supabase = createAdminSupabaseClient();
  const results: CustomerAppAddressDto[] = [];

  if (params.sysCustomerId) {
    const { data: sysRows, error: sysErr } = await supabase
      .from('sys_customer_addresses_dtl')
      .select(
        'id, address_type, label, building, floor, apartment, street, area, city, country, postal_code, latitude, longitude, delivery_notes, is_default',
      )
      .eq('customer_id', params.sysCustomerId)
      .eq('is_active', true)
      .eq('rec_status', 1)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (sysErr) throw sysErr;
    for (const row of sysRows ?? []) {
      results.push(mapAddressRow(row as Record<string, unknown>, 'SYS'));
    }
  }

  const { data: orgRows, error: orgErr } = await supabase
    .from('org_customer_addresses')
    .select(
      'id, address_type, label, building, floor, apartment, street, area, city, country, postal_code, latitude, longitude, delivery_notes, is_default',
    )
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('customer_id', params.orgCustomerId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  if (orgErr) throw orgErr;
  const seenSignatures = new Set(
    results.map((r) => `${r.label.toLowerCase()}|${r.description.toLowerCase()}`),
  );
  for (const row of orgRows ?? []) {
    const mapped = mapAddressRow(row as Record<string, unknown>, 'ORG');
    const sig = `${mapped.label.toLowerCase()}|${mapped.description.toLowerCase()}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      results.push(mapped);
    }
  }

  return results;
}

/**
 * Creates a new customer address in `sys_customer_addresses_dtl` when the
 * customer has a global `sys_customers_mst.id`, otherwise in tenant-scoped
 * `org_customer_addresses`.
 *
 * @param params.tenantOrgId - Active Organization tenant_org_id.
 * @param params.orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @param params.sysCustomerId - Optional global sys_customers_mst.id.
 * @param params.input - Validated GCC address input.
 * @returns Newly created CustomerAppAddressDto.
 */
export async function createCustomerAppAddress(params: {
  tenantOrgId: string;
  orgCustomerId: string;
  sysCustomerId: string | null;
  input: CreateCustomerAppAddressInput;
}): Promise<CustomerAppAddressDto> {
  const supabase = createAdminSupabaseClient();
  const countryCode =
    typeof params.input.country === 'string' && /^[A-Za-z]{2}$/.test(params.input.country.trim())
      ? params.input.country.trim().toUpperCase()
      : null;

  if (params.sysCustomerId) {
    const { count } = await supabase
      .from('sys_customer_addresses_dtl')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', params.sysCustomerId)
      .eq('is_active', true)
      .eq('rec_status', 1);

    if ((count ?? 0) >= 20) {
      throw new CustomerAppProfileError('ADDRESS_LIMIT_REACHED', 'Maximum of 20 addresses reached');
    }

    const makeDefault = params.input.isDefault === true || (count ?? 0) === 0;
    if (makeDefault) {
      await supabase
        .from('sys_customer_addresses_dtl')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('customer_id', params.sysCustomerId)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('sys_customer_addresses_dtl')
      .insert({
        customer_id: params.sysCustomerId,
        address_type: params.input.addressType ?? 'home',
        label: params.input.label.trim(),
        building: params.input.building?.trim() || null,
        floor: params.input.floor?.trim() || null,
        apartment: params.input.apartment?.trim() || null,
        street: params.input.street?.trim() || null,
        area: params.input.area?.trim() || null,
        city: params.input.city?.trim() || null,
        country: countryCode,
        postal_code: params.input.postalCode?.trim() || null,
        latitude: params.input.latitude ?? null,
        longitude: params.input.longitude ?? null,
        delivery_notes: params.input.deliveryNotes?.trim() || null,
        is_default: makeDefault,
        is_active: true,
        rec_status: 1,
        created_by: params.sysCustomerId,
        created_info: 'customer_app_address_create',
      })
      .select(
        'id, address_type, label, building, floor, apartment, street, area, city, country, postal_code, latitude, longitude, delivery_notes, is_default',
      )
      .single();

    if (error || !data) throw error ?? new Error('Failed to create global customer address');
    return mapAddressRow(data as Record<string, unknown>, 'SYS');
  }

  // Fallback for org-only customers without a sys_customers_mst record.
  const { count } = await supabase
    .from('org_customer_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('customer_id', params.orgCustomerId)
    .eq('is_active', true);

  if ((count ?? 0) >= 20) {
    throw new CustomerAppProfileError('ADDRESS_LIMIT_REACHED', 'Maximum of 20 addresses reached');
  }

  const makeDefault = params.input.isDefault === true || (count ?? 0) === 0;
  if (makeDefault) {
    await supabase
      .from('org_customer_addresses')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_org_id', params.tenantOrgId)
      .eq('customer_id', params.orgCustomerId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('org_customer_addresses')
    .insert({
      tenant_org_id: params.tenantOrgId,
      customer_id: params.orgCustomerId,
      address_type: params.input.addressType ?? 'home',
      label: params.input.label.trim(),
      building: params.input.building?.trim() || null,
      floor: params.input.floor?.trim() || null,
      apartment: params.input.apartment?.trim() || null,
      street: params.input.street?.trim() || null,
      area: params.input.area?.trim() || null,
      city: params.input.city?.trim() || null,
      country: countryCode,
      postal_code: params.input.postalCode?.trim() || null,
      latitude: params.input.latitude ?? null,
      longitude: params.input.longitude ?? null,
      delivery_notes: params.input.deliveryNotes?.trim() || null,
      is_default: makeDefault,
      is_active: true,
      rec_status: 1,
      created_by: params.orgCustomerId,
      created_info: 'customer_app_address_create',
    })
    .select(
      'id, address_type, label, building, floor, apartment, street, area, city, country, postal_code, latitude, longitude, delivery_notes, is_default',
    )
    .single();

  if (error || !data) throw error ?? new Error('Failed to create org customer address');
  return mapAddressRow(data as Record<string, unknown>, 'ORG');
}

/**
 * Resolves a single customer address UUID across both `sys_customer_addresses_dtl`
 * and `org_customer_addresses` (always filtering by ownership + `tenant_org_id`).
 *
 * @param params.tenantOrgId - Organization tenant_org_id.
 * @param params.orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @param params.sysCustomerId - Optional global sys_customers_mst.id.
 * @param params.addressId - Address UUID to resolve.
 * @returns Resolved address DTO or null when not owned/inactive.
 */
export async function resolveCustomerAppAddress(params: {
  tenantOrgId: string;
  orgCustomerId: string;
  sysCustomerId: string | null;
  addressId: string;
}): Promise<CustomerAppAddressDto | null> {
  const supabase = createAdminSupabaseClient();

  if (params.sysCustomerId) {
    const { data: sysAddr } = await supabase
      .from('sys_customer_addresses_dtl')
      .select(
        'id, address_type, label, building, floor, apartment, street, area, city, country, postal_code, latitude, longitude, delivery_notes, is_default',
      )
      .eq('id', params.addressId)
      .eq('customer_id', params.sysCustomerId)
      .eq('is_active', true)
      .eq('rec_status', 1)
      .maybeSingle();

    if (sysAddr) {
      return mapAddressRow(sysAddr as Record<string, unknown>, 'SYS');
    }
  }

  const { data: orgAddr } = await supabase
    .from('org_customer_addresses')
    .select(
      'id, address_type, label, building, floor, apartment, street, area, city, country, postal_code, latitude, longitude, delivery_notes, is_default',
    )
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('customer_id', params.orgCustomerId)
    .eq('id', params.addressId)
    .eq('is_active', true)
    .maybeSingle();

  if (orgAddr) {
    return mapAddressRow(orgAddr as Record<string, unknown>, 'ORG');
  }

  return null;
}

/**
 * Lists all linked Organizations for an authenticated customer, cleanly split
 * into `activeTenants` and `hiddenTenants` so customers can always unhide a
 * previously hidden laundry while seeing each laundry's validated last branch.
 *
 * @param params.sysCustomerId - Global sys_customers_mst.id if available.
 * @param params.phoneFallback - Normalized E.164 phone for legacy OTP sessions.
 * @returns Active and hidden tenant arrays with eligible customer-app branches.
 */
export async function listAuthenticatedCustomerTenants(params: {
  sysCustomerId: string | null;
  phoneFallback: string | null;
}): Promise<{
  activeTenants: CustomerAppTenantDto[];
  hiddenTenants: CustomerAppTenantDto[];
}> {
  const supabase = createAdminSupabaseClient();

  let memberships: Array<{
    id: string;
    tenant_org_id: string;
    is_hidden_by_customer: boolean;
    last_branch_id: string | null;
  }> = [];

  if (params.sysCustomerId) {
    const { data, error } = await supabase
      .from('org_customers_mst')
      .select('id, tenant_org_id, is_hidden_by_customer, last_branch_id')
      .eq('customer_id', params.sysCustomerId)
      .eq('is_active', true);
    if (error) throw error;
    memberships = (data ?? []) as typeof memberships;
  } else if (params.phoneFallback) {
    const raw = params.phoneFallback.replace(/^\+/, '');
    const { data, error } = await supabase
      .from('org_customers_mst')
      .select('id, tenant_org_id, is_hidden_by_customer, last_branch_id')
      .in('phone', [params.phoneFallback, raw])
      .eq('is_active', true);
    if (error) throw error;
    memberships = (data ?? []) as typeof memberships;
  }

  if (memberships.length === 0) {
    return { activeTenants: [], hiddenTenants: [] };
  }

  const tenantIds = Array.from(new Set(memberships.map((m) => m.tenant_org_id)));

  const [{ data: tenantsData, error: tenantsErr }, { data: branchesData, error: branchesErr }] =
    await Promise.all([
      supabase
        .from('org_tenants_mst')
        .select('id, name, name2, logo_url')
        .in('id', tenantIds)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('org_branches_mst')
        .select('id, tenant_org_id, name, name2, timezone_code, is_main, is_active, is_customer_app_enabled')
        .in('tenant_org_id', tenantIds)
        .eq('is_active', true)
        .eq('is_customer_app_enabled', true)
        .order('is_main', { ascending: false })
        .order('name', { ascending: true }),
    ]);

  if (tenantsErr) throw tenantsErr;
  if (branchesErr) throw branchesErr;

  const membershipByTenant = new Map(memberships.map((m) => [m.tenant_org_id, m]));
  const branchesByTenant = new Map<string, CustomerAppBranchDto[]>();

  for (const b of branchesData ?? []) {
    const list = branchesByTenant.get(b.tenant_org_id) ?? [];
    list.push({
      id: b.id,
      name: b.name ?? '',
      name2: b.name2 ?? null,
      timeZone: (b.timezone_code as string | null) ?? null,
      deliveryFee: 0,
      isMain: b.is_main === true,
    });
    branchesByTenant.set(b.tenant_org_id, list);
  }

  const primaryColors = await Promise.all(
    (tenantsData ?? []).map(async (tenant) => ({
      id: tenant.id,
      color: await getTenantPrimaryColor(tenant.id).catch(() => null),
    })),
  );
  const colorByTenant = new Map(primaryColors.map((entry) => [entry.id, entry.color]));

  const activeTenants: CustomerAppTenantDto[] = [];
  const hiddenTenants: CustomerAppTenantDto[] = [];

  for (const tenant of tenantsData ?? []) {
    const membership = membershipByTenant.get(tenant.id);
    if (!membership) continue;
    const branches = branchesByTenant.get(tenant.id) ?? [];
    // Validate last_branch_id against currently eligible branches; fall back to first eligible.
    const matchedLastBranch =
      branches.find((b) => b.id === membership.last_branch_id) ?? branches[0] ?? null;

    const dto: CustomerAppTenantDto = {
      tenantOrgId: tenant.id,
      orgCustomerId: membership.id,
      name: tenant.name ?? '',
      name2: tenant.name2 ?? null,
      logoUrl: tenant.logo_url ?? null,
      primaryColor: colorByTenant.get(tenant.id) ?? null,
      isHiddenByCustomer: membership.is_hidden_by_customer === true,
      lastBranchId: matchedLastBranch?.id ?? null,
      lastBranchName: matchedLastBranch?.name ?? null,
      lastBranchName2: matchedLastBranch?.name2 ?? null,
      activeOrderCount: 0,
      branches,
    };

    if (dto.isHiddenByCustomer) {
      hiddenTenants.push(dto);
    } else {
      activeTenants.push(dto);
    }
  }

  return { activeTenants, hiddenTenants };
}

/**
 * Updates customer-controlled tenant visibility (`is_hidden_by_customer`) or
 * `last_branch_id` for one verified tenant membership.
 *
 * @param params.tenantOrgId - Organization tenant_org_id.
 * @param params.orgCustomerId - Verified org_customers_mst.id.
 * @param params.isHiddenByCustomer - Optional visibility toggle (true=hide, false=unhide).
 * @param params.lastBranchId - Optional selected active branch UUID.
 */
export async function updateCustomerTenantPreference(params: {
  tenantOrgId: string;
  orgCustomerId: string;
  isHiddenByCustomer?: boolean;
  lastBranchId?: string | null;
}): Promise<{ isHiddenByCustomer: boolean; lastBranchId: string | null }> {
  const supabase = createAdminSupabaseClient();

  if (params.lastBranchId) {
    const { data: validBranch } = await supabase
      .from('org_branches_mst')
      .select('id')
      .eq('tenant_org_id', params.tenantOrgId)
      .eq('id', params.lastBranchId)
      .eq('is_active', true)
      .eq('is_customer_app_enabled', true)
      .maybeSingle();

    if (!validBranch) {
      throw new CustomerAppProfileError(
        'BRANCH_NOT_ELIGIBLE',
        'Selected branch is not available in the Customer App',
      );
    }
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_info: 'customer_app_tenant_pref',
  };
  if (params.isHiddenByCustomer !== undefined) {
    updatePayload.is_hidden_by_customer = params.isHiddenByCustomer;
  }
  if (params.lastBranchId !== undefined) {
    updatePayload.last_branch_id = params.lastBranchId;
  }

  const { data, error } = await supabase
    .from('org_customers_mst')
    .update(updatePayload)
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.orgCustomerId)
    .select('is_hidden_by_customer, last_branch_id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update tenant preference');
  }

  return {
    isHiddenByCustomer: data.is_hidden_by_customer === true,
    lastBranchId: (data.last_branch_id as string | null) ?? null,
  };
}
