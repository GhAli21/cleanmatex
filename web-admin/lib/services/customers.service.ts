/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * PRD-003: Customer Management Service
 * Core business logic for progressive customer engagement.
 * When CONNECT_WITH_SYS_CUSTOMERS !== 'true', only org_ tables are used (org_customers_mst).
 * When CONNECT_WITH_SYS_CUSTOMERS=true, methods may use sys_customers_mst and org_customers_mst.
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { catalogReadClient } from '@/lib/supabase/catalog-read';
import {
  getCreditLimitPlanCap,
  capCreditLimitToPlan,
} from '@/lib/services/credit-limit-plan-cap.service';
import { logger } from '@/lib/utils/logger';
import {
  normalizeCustomerPhone,
  normalizeCustomerEmail,
  maskCustomerPhone,
  maskCustomerEmail,
} from '@/lib/utils/customer-identity';
import type { Database, Json } from '@/types/database';
import type {
  Customer,
  CustomerWithTenantData,
  CustomerListItem,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  CustomerSearchParams,
  MergeCustomersRequest,
  PhoneNormalizationResult,
  CustomerStatistics,
  CustomerType,
  CustomerPreferences,
  ProfileStatus,
  CustomerLookupRequest,
  CustomerLookupResponse,
  CustomerCreateOrConnectResult,
  CustomerCreateActionResult,
  CustomerAuditEntry,
  OrgCustomerAuditActionType,
} from '@/lib/types/customer';

type OrgCustomerInsert = Database['public']['Tables']['org_customers_mst']['Insert'];

/** When true, service uses sys_customers_mst + org_customers_mst; when false, only org_customers_mst. */
function shouldUseSysCustomers(): boolean {
  
  return false;

  if (process.env.CONNECT_WITH_SYS_CUSTOMERS === undefined) {
    return false;
  }
  if (process.env.CONNECT_WITH_SYS_CUSTOMERS?.toLowerCase() === 'true') {
    return true;
  }
  if (process.env.CONNECT_WITH_SYS_CUSTOMERS?.toLowerCase() === 'false') {
    return false;
  }
  return false; //process.env.CONNECT_WITH_SYS_CUSTOMERS === 'true';
}

/** Map org_customers_mst row to Customer. */
function mapFromOrgRow(row: Record<string, unknown>, tenantId: string): Customer {
  const customerCode = (row.customer_code as string) ?? null;
  return {
    id: row.id as string,
    customerCode,
    sysCustomerId: (row.customer_id as string) ?? null,
    customerNumber: customerCode ?? (row.customer_number as string) ?? (row.id as string),
    firstName: (row.first_name as string) || '',
    lastName: (row.last_name as string) ?? null,
    displayName: (row.display_name as string) ?? null,
    name: (row.name as string) ?? null,
    name2: (row.name2 as string) ?? null,
    phone: (row.phone as string) ?? null,
    phoneVerified: false,
    email: (row.email as string) ?? null,
    emailVerified: false,
    type: (row.type as CustomerType) ?? 'walk_in',
    profileStatus: Math.min(
      3,
      Math.max(0, Number(row.profile_status ?? 1))
    ) as ProfileStatus,
    avatarUrl: null,
    preferences: (row.preferences as CustomerPreferences) ?? {},
    preferredLanguage: (row.preferred_language as string) ?? null,
    address: (row.address as string) ?? null,
    area: (row.area as string) ?? null,
    building: (row.building as string) ?? null,
    floor: (row.floor as string) ?? null,
    firstTenantOrgId: tenantId,
    companyName: (row.company_name as string) ?? null,
    companyName2: (row.company_name2 as string) ?? null,
    taxId: (row.tax_id as string) ?? null,
    creditLimit: row.credit_limit != null ? Number(row.credit_limit) : null,
    paymentTermsDays: row.payment_terms_days != null ? Number(row.payment_terms_days) : null,
    costCenterCode: (row.cost_center_code as string) ?? null,
    customerCategoryId: (row.customer_category_id as string) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? (row.created_at as string) ?? new Date().toISOString(),
  };
}

// Define a reusable type for session context
export interface CurrentUserTenantSessionContext {
  userId: string;
  userRole: string;
  userTenantOrgId: string;
}
// ==================================================================
// PHONE NORMALIZATION
// ==================================================================

/**
 * Normalize phone number to E.164 format.
 * If the phone already contains a country code (starts with +), it is preserved; otherwise defaultCountryCode is used.
 * Examples:
 *   "+968 9012 3456" → "+96890123456"
 *   "90123456" → "+96890123456" (with default country code)
 *   "+968-90-12-34-56" → "+96890123456"
 */
export function normalizePhone(
  phone: string,
  defaultCountryCode: string = '+968'
): PhoneNormalizationResult {
  return normalizeCustomerPhone(phone, defaultCountryCode);
}

/**
 * Mask phone number for display
 * "+96890123456" → "+96890****56"
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  const normalized = normalizeCustomerPhone(phone).normalized;
  return maskCustomerPhone(normalized);
}

// ==================================================================
// CUSTOMER NUMBER GENERATION
// ==================================================================

async function getCurrentUserTenantSessionContext(): Promise<CurrentUserTenantSessionContext> {
  // Lazy: the session guard pulls in next/server, which this module must not load eagerly.
  const { getAuthContext } = await import('@/lib/auth/server-auth');
  const auth = await getAuthContext();
  return {
    userId: auth.userId,
    userRole: auth.userRole,
    userTenantOrgId: auth.tenantId,
  };
}

/** Default phone country code for current tenant (from tenant/branch settings). */
async function getDefaultCountryCodeForCurrentTenant(): Promise<string> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) return '+968';
  const supabase = await createClient();
  const tenantSettings = createTenantSettingsService(supabase);
  const uid = (await supabase.auth.getUser()).data?.user?.id;
  return tenantSettings.getDefaultPhoneCountryCode(tenantId, undefined, uid);
}

/**
 * Generate sequential customer number for tenant
 * Format: CUST-00001, CUST-00002, etc.
 */
export async function generateCustomerNumber(tenantOrgId: string): Promise<string> {
  const supabase = await createClient();

  // INVOKER function reads sys_customers_mst — must run as service role after lockdown.
  const { data, error } = await catalogReadClient(supabase).rpc('generate_customer_number', {
    p_tenant_org_id: tenantOrgId,
  });

  if (error) {
    logger.error('Error generating customer number', error as Error, { feature: 'customers' });
    throw new Error('Failed to generate customer number');
  }

  return data as string;
}

// ==================================================================
// CUSTOMER CRUD OPERATIONS
// ==================================================================

/**
 * Lookup customer identity by exact normalized mobile phone or email before creation.
 * Checks current tenant's org_customers_mst first, then global sys_customers_mst.
 * Never exposes other tenants, balances, or addresses on a global match.
 */
export async function lookupCustomerIdentity(
  request: CustomerLookupRequest
): Promise<CustomerLookupResponse> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;

  const rawPhone = request.phone?.trim() || '';
  const rawEmail = request.email?.trim() || '';

  if (!rawPhone && !rawEmail) {
    throw new Error('Mobile phone or email is required for lookup');
  }

  let normalizedPhone: string | null = null;
  if (rawPhone) {
    const defaultCountryCode = await getDefaultCountryCodeForCurrentTenant();
    const phoneResult = normalizeCustomerPhone(rawPhone, defaultCountryCode);
    if (!phoneResult.isValid) {
      throw new Error('Invalid phone number format');
    }
    normalizedPhone = phoneResult.normalized;
  }

  let normalizedEmail: string | null = null;
  if (rawEmail) {
    const emailResult = normalizeCustomerEmail(rawEmail);
    if (!emailResult.isValid) {
      throw new Error('Invalid email format');
    }
    normalizedEmail = emailResult.normalized;
  }

  // Step 1: Check current tenant's org_customers_mst (explicit tenant_org_id filter).
  const orgCandidates: Array<{
    id: string;
    customer_code: string | null;
    customer_id: string | null;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    phone: string | null;
    email: string | null;
    type: string | null;
    is_active: boolean;
  }> = [];

  if (normalizedPhone) {
    const { data: byPhone, error: phoneErr } = await supabase
      .from('org_customers_mst')
      .select('id, customer_code, customer_id, first_name, last_name, display_name, phone, email, type, is_active')
      .eq('tenant_org_id', tenantId)
      .eq('phone', normalizedPhone)
      .order('is_active', { ascending: false })
      .limit(2);
    if (phoneErr) {
      logger.error('Error looking up tenant customer by phone', phoneErr as Error, { feature: 'customers', action: 'lookup' });
      throw new Error('Failed to lookup customer');
    }
    if (byPhone) orgCandidates.push(...byPhone);
  }

  if (normalizedEmail) {
    const { data: byEmail, error: emailErr } = await supabase
      .from('org_customers_mst')
      .select('id, customer_code, customer_id, first_name, last_name, display_name, phone, email, type, is_active')
      .eq('tenant_org_id', tenantId)
      .ilike('email', normalizedEmail)
      .order('is_active', { ascending: false })
      .limit(5);
    if (emailErr) {
      logger.error('Error looking up tenant customer by email', emailErr as Error, { feature: 'customers', action: 'lookup' });
      throw new Error('Failed to lookup customer');
    }
    const exactEmailMatches = (byEmail ?? []).filter(
      (row) => (row.email ?? '').trim().toLowerCase() === normalizedEmail
    );
    for (const row of exactEmailMatches) {
      if (!orgCandidates.some((existing) => existing.id === row.id)) {
        orgCandidates.push(row);
      }
    }
  }

  if (orgCandidates.length > 0) {
    const activeMatch = orgCandidates.find((c) => c.is_active);
    const match = activeMatch ?? orgCandidates[0];
    return {
      status: match.is_active ? 'ALREADY_IN_TENANT' : 'INACTIVE_IN_TENANT',
      normalizedPhone,
      normalizedEmail,
      tenantCustomer: {
        id: match.id,
        customerCode: match.customer_code ?? null,
        sysCustomerId: match.customer_id ?? null,
        firstName: match.first_name ?? '',
        lastName: match.last_name ?? null,
        displayName: match.display_name ?? null,
        phone: match.phone ?? null,
        email: match.email ?? null,
        type: (match.type as CustomerType) ?? 'stub',
        isActive: match.is_active,
      },
    };
  }

  // Step 2: Check global sys_customers_mst by exact normalized phone and/or email (server-side only).
  type SysLookupRow = {
    id: string;
    customer_code: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    phone: string | null;
    email: string | null;
  };

  let sysByPhone: SysLookupRow | null = null;
  let sysByEmail: SysLookupRow | null = null;

  if (normalizedPhone) {
    const { data, error } = await catalogReadClient(supabase)
      .from('sys_customers_mst')
      .select('id, customer_code, first_name, last_name, display_name, phone, email')
      .eq('is_active', true)
      .or(`phone.eq.${normalizedPhone},mobile_e164.eq.${normalizedPhone}`)
      .limit(1)
      .maybeSingle();
    if (error) {
      logger.error('Error looking up global customer by phone', error as Error, { feature: 'customers', action: 'lookup' });
      throw new Error('Failed to lookup customer');
    }
    sysByPhone = (data as SysLookupRow | null) ?? null;
  }

  if (normalizedEmail) {
    const { data, error } = await catalogReadClient(supabase)
      .from('sys_customers_mst')
      .select('id, customer_code, first_name, last_name, display_name, phone, email')
      .eq('is_active', true)
      .or(`email_normalized.eq.${normalizedEmail},email.ilike.${normalizedEmail}`)
      .limit(5);
    if (error) {
      logger.error('Error looking up global customer by email', error as Error, { feature: 'customers', action: 'lookup' });
      throw new Error('Failed to lookup customer');
    }
    const exactMatch = ((data ?? []) as SysLookupRow[]).find(
      (row) => (row.email ?? '').trim().toLowerCase() === normalizedEmail
    );
    sysByEmail = exactMatch ?? ((data?.[0] as SysLookupRow | undefined) ?? null);
  }

  if (sysByPhone && sysByEmail && sysByPhone.id !== sysByEmail.id) {
    return {
      status: 'IDENTITY_CONFLICT',
      normalizedPhone,
      normalizedEmail,
      conflictMessage: 'Phone number and email address belong to two different global customer profiles.',
    };
  }

  const sysMatch = sysByPhone ?? sysByEmail;
  if (sysMatch) {
    // Also check if this global customer is already linked to the current tenant under another contact.
    const { data: linkedInTenant } = await supabase
      .from('org_customers_mst')
      .select('id, customer_code, customer_id, first_name, last_name, display_name, phone, email, type, is_active')
      .eq('tenant_org_id', tenantId)
      .eq('customer_id', sysMatch.id)
      .maybeSingle();

    if (linkedInTenant) {
      return {
        status: linkedInTenant.is_active ? 'ALREADY_IN_TENANT' : 'INACTIVE_IN_TENANT',
        normalizedPhone,
        normalizedEmail,
        tenantCustomer: {
          id: linkedInTenant.id,
          customerCode: linkedInTenant.customer_code ?? sysMatch.customer_code,
          sysCustomerId: linkedInTenant.customer_id ?? sysMatch.id,
          firstName: linkedInTenant.first_name ?? '',
          lastName: linkedInTenant.last_name ?? null,
          displayName: linkedInTenant.display_name ?? null,
          phone: linkedInTenant.phone ?? null,
          email: linkedInTenant.email ?? null,
          type: (linkedInTenant.type as CustomerType) ?? 'stub',
          isActive: linkedInTenant.is_active,
        },
      };
    }

    const matchedBy: 'phone' | 'email' | 'both' =
      sysByPhone && sysByEmail ? 'both' : sysByPhone ? 'phone' : 'email';

    return {
      status: 'GLOBAL_MATCH_FOUND',
      normalizedPhone,
      normalizedEmail,
      globalCustomer: {
        sysCustomerId: sysMatch.id,
        customerCode: sysMatch.customer_code,
        firstName: sysMatch.first_name ?? '',
        lastName: sysMatch.last_name ?? null,
        displayName:
          sysMatch.display_name ||
          `${sysMatch.first_name ?? ''} ${sysMatch.last_name ?? ''}`.trim() ||
          sysMatch.customer_code,
        maskedPhone: sysMatch.phone ? maskCustomerPhone(sysMatch.phone) : null,
        maskedEmail: sysMatch.email ? maskCustomerEmail(sysMatch.email) : null,
        matchedBy,
      },
    };
  }

  return {
    status: 'NOT_FOUND',
    normalizedPhone,
    normalizedEmail,
  };
}

/**
 * Atomically create a new customer or connect an existing sys_customers_mst identity
 * to the current tenant, propagating customer_code and writing dual audit logs.
 */
export async function createOrConnectCustomer(
  request: CustomerCreateRequest,
  sourceChannel: string = 'WEB_ADMIN'
): Promise<CustomerCreateOrConnectResult> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;

  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  let normalizedPhone: string | null = null;
  if ('phone' in request && request.phone && request.phone.trim().length > 0) {
    const defaultCountryCode = await getDefaultCountryCodeForCurrentTenant();
    const phoneResult = normalizeCustomerPhone(request.phone, defaultCountryCode);
    if (!phoneResult.isValid) {
      throw new Error('Invalid phone number format');
    }
    normalizedPhone = phoneResult.normalized;
  }

  let normalizedEmail: string | null = null;
  if ('email' in request && request.email && request.email.trim().length > 0) {
    const emailResult = normalizeCustomerEmail(request.email);
    if (!emailResult.isValid) {
      throw new Error('Invalid email format');
    }
    normalizedEmail = emailResult.normalized;
  }

  // B2B: validate categoryId is B2B when provided and cap credit limit to plan limit.
  let cappedCreditLimit: number | null = null;
  if (request.type === 'b2b') {
    if ('categoryId' in request && request.categoryId) {
      const { data: cat } = await supabase
        .from('org_customer_category_cf')
        .select('id, is_b2b')
        .eq('tenant_org_id', tenantId)
        .eq('id', request.categoryId)
        .single();
      if (!cat || !cat.is_b2b) {
        throw new Error('Invalid category: B2B customers must use a B2B category');
      }
    }
    if ('creditLimit' in request && request.creditLimit != null) {
      const planCap = await getCreditLimitPlanCap(tenantId);
      cappedCreditLimit = capCreditLimitToPlan(Number(request.creditLimit), planCap);
    }
  }

  const displayName =
    request.type === 'b2b' && 'companyName' in request
      ? (request.displayName?.trim() || request.companyName)
      : request.displayName?.trim() ||
        `${request.firstName ?? ''} ${('lastName' in request && request.lastName) || ''}`.trim();
  const name =
    request.type === 'b2b' && 'companyName' in request
      ? (request.name?.trim() || request.companyName)
      : request.name?.trim() || displayName;
  const name2 =
    request.type === 'b2b' && 'companyName2' in request
      ? (request.name2 ?? request.companyName2 ?? null)
      : request.name2 ?? null;
  const firstName =
    request.type === 'b2b' && 'companyName' in request
      ? (request.firstName?.trim() || request.companyName)
      : request.firstName?.trim() || '';

  const connectSysCustomerId =
    'connectSysCustomerId' in request && request.connectSysCustomerId
      ? request.connectSysCustomerId
      : null;

  const { data: rpcRows, error: rpcError } = await catalogReadClient(supabase).rpc(
    'org_cust_create_or_connect',
    {
      p_tenant_org_id: tenantId,
      p_actor_user_id: curUserId,
      p_type: request.type ?? 'stub',
      p_first_name: firstName || null,
      p_last_name: 'lastName' in request ? (request.lastName ?? null) : null,
      p_display_name: displayName || null,
      p_name: name || null,
      p_name2: name2,
      p_phone_e164: normalizedPhone,
      p_email_norm: normalizedEmail,
      p_address: 'address' in request ? (request.address ?? null) : null,
      p_area: 'area' in request ? (request.area ?? null) : null,
      p_building: 'building' in request ? (request.building ?? null) : null,
      p_floor: 'floor' in request ? (request.floor ?? null) : null,
      p_preferences: ('preferences' in request && request.preferences ? request.preferences : {}) as Json,
      p_customer_category_id: 'categoryId' in request ? (request.categoryId ?? null) : null,
      p_company_name: request.type === 'b2b' && 'companyName' in request ? request.companyName : null,
      p_company_name2: request.type === 'b2b' && 'companyName2' in request ? (request.companyName2 ?? null) : null,
      p_tax_id: request.type === 'b2b' && 'taxId' in request ? (request.taxId ?? null) : null,
      p_cr_id: null,
      p_credit_limit: cappedCreditLimit,
      p_payment_terms_days: request.type === 'b2b' && 'paymentTermsDays' in request ? (request.paymentTermsDays ?? null) : null,
      p_cost_center_code: request.type === 'b2b' && 'costCenterCode' in request ? (request.costCenterCode ?? null) : null,
      p_source_channel: sourceChannel,
      p_connect_sys_customer_id: connectSysCustomerId,
    }
  );

  if (rpcError) {
    logger.error('Error in org_cust_create_or_connect', rpcError as Error, { feature: 'customers', action: 'create' });
    if (rpcError.message.includes('CMX_IDENTITY_CONFLICT')) {
      throw new Error('Phone number and email address belong to two different global customer profiles');
    }
    if (rpcError.message.includes('CMX_SYS_CUSTOMER_NOT_FOUND')) {
      throw new Error('Requested global customer does not exist');
    }
    throw new Error('Failed to create customer: ' + rpcError.message);
  }

  const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!rpcResult?.org_customer_id) {
    throw new Error('Failed to create customer: empty RPC response');
  }

  const action = rpcResult.action_result as CustomerCreateActionResult;

  if (action === 'ALREADY_EXISTS') {
    const contactLabel = normalizedPhone
      ? maskCustomerPhone(normalizedPhone)
      : normalizedEmail ?? rpcResult.customer_code;
    throw new Error(`Customer with ${contactLabel} already exists (${rpcResult.customer_code})`);
  }

  if (action === 'INACTIVE_EXISTS') {
    throw new Error(`Customer already exists in this organization but is inactive (${rpcResult.customer_code})`);
  }

  const { data: orgRow, error: fetchError } = await supabase
    .from('org_customers_mst')
    .select('*')
    .eq('id', rpcResult.org_customer_id)
    .eq('tenant_org_id', tenantId)
    .single();

  if (fetchError || !orgRow) {
    logger.error('Error loading newly created customer', fetchError as Error, { feature: 'customers', action: 'create' });
    throw new Error('Customer created but failed to load record');
  }

  if (request.type === 'full' && 'addresses' in request && request.addresses) {
    const addressesService = await import('./customer-addresses.service');
    for (const addressReq of request.addresses) {
      try {
        await addressesService.createAddress(orgRow.id, addressReq);
      } catch (err) {
        logger.error('Error creating address', err as Error, { feature: 'customers', action: 'create' });
      }
    }
  }

  return {
    customer: mapFromOrgRow(orgRow as Record<string, unknown>, tenantId),
    action,
  };
}

/**
 * Create a new customer (guest, stub, full, or b2b) — backward-compatible wrapper.
 */
export async function createCustomer(
  request: CustomerCreateRequest
): Promise<Customer> {
  const result = await createOrConnectCustomer(request);
  return result.customer;
}

/**
 * Find customer by ID (org_customers_mst.id when org-only; sys or org id when CONNECT_WITH_SYS_CUSTOMERS).
 */
export async function findCustomerById(
  customerId: string
): Promise<CustomerWithTenantData | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  if (!shouldUseSysCustomers()) {
    const { data: orgRow, error } = await supabase
      .from('org_customers_mst')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();
    if (error) {
      logger.error('Error finding customer', error as Error, { feature: 'customers', action: 'findById' });
      return null;
    }
    if (!orgRow) return null;
    const { data: orderStats } = await supabase
      .from('org_orders_mst')
      .select('id, total:total_amount, delivered_at')
      .eq('customer_id', customerId)
      .eq('tenant_org_id', tenantId);
    const totalOrders = orderStats?.length || 0;
    const totalSpent = orderStats?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
    const lastOrderAt = orderStats
      ?.filter((o) => o.delivered_at)
      .sort((a, b) => new Date(b.delivered_at!).getTime() - new Date(a.delivered_at!).getTime())[0]
      ?.delivered_at ?? null;
    return {
      ...mapFromOrgRow(orgRow as Record<string, unknown>, tenantId),
      tenantData: {
        tenantOrgId: tenantId,
        loyaltyPoints: Number(orgRow.loyalty_points) || 0,
        totalOrders,
        totalSpent,
        lastOrderAt,
        joinedAt: (orgRow.created_at as string) ?? new Date().toISOString(),
      },
    };
  }

  const { data: orgCustomer } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id, tenant_org_id')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();
  let sysCustomerId = customerId;
  if (orgCustomer?.customer_id) sysCustomerId = orgCustomer.customer_id;

  const { data: customer, error } = await catalogReadClient(supabase)
    .from('sys_customers_mst')
    .select(
      `*,
      org_customers_mst!inner(id, tenant_org_id, loyalty_points, created_at)`
    )
    .eq('id', sysCustomerId)
    .eq('org_customers_mst.tenant_org_id', tenantId)
    .maybeSingle();
  if (error) {
    logger.error('Error finding customer', error as Error, { feature: 'customers', action: 'findById' });
    return null;
  }
  if (!customer) return null;

  const { data: orderStats } = await supabase
    .from('org_orders_mst')
    .select('id, total:total_amount, delivered_at')
    .eq('customer_id', sysCustomerId)
    .eq('tenant_org_id', tenantId);
  const totalOrders = orderStats?.length || 0;
  const totalSpent = orderStats?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
  const lastOrderAt = orderStats
    ?.filter((o) => o.delivered_at)
    .sort((a, b) => new Date(b.delivered_at!).getTime() - new Date(a.delivered_at!).getTime())[0]
    ?.delivered_at ?? null;
  return {
    ...mapToCustomer(customer),
    tenantData: {
      tenantOrgId: tenantId,
      loyaltyPoints: (customer as { org_customers_mst: Array<{ loyalty_points?: number; created_at?: string }> }).org_customers_mst[0]?.loyalty_points ?? 0,
      totalOrders,
      totalSpent,
      lastOrderAt,
      joinedAt: (customer as { org_customers_mst: Array<{ created_at?: string }> }).org_customers_mst[0]?.created_at ?? new Date().toISOString(),
    },
  };
}

/**
 * Find customer by phone number (org-only: org_customers_mst; sys: sys_customers_mst + org link).
 */
export async function findCustomerByPhone(
  phone: string
): Promise<Customer | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const defaultCountryCode = await getDefaultCountryCodeForCurrentTenant();
  const phoneResult = normalizePhone(phone, defaultCountryCode);
  if (!phoneResult.isValid) {
    throw new Error('Invalid phone number format');
  }
  if (!shouldUseSysCustomers()) {
    const { data: orgRow, error } = await supabase
      .from('org_customers_mst')
      .select('*')
      .eq('tenant_org_id', tenantId)
      .eq('phone', phoneResult.normalized)
      .maybeSingle();
    if (error) {
      logger.error('Error finding customer by phone', error as Error, { feature: 'customers' });
      return null;
    }
    return orgRow ? mapFromOrgRow(orgRow as Record<string, unknown>, tenantId) : null;
  }
  const { data: customer, error } = await catalogReadClient(supabase)
    .from('sys_customers_mst')
    .select('*, org_customers_mst!inner(tenant_org_id)')
    .eq('phone', phoneResult.normalized)
    .eq('org_customers_mst.tenant_org_id', tenantId)
    .maybeSingle();
  if (error) {
    logger.error('Error finding customer by phone', error as Error, { feature: 'customers' });
    return null;
  }
  return customer ? mapToCustomer(customer) : null;
}

/**
 * Get all customers for current tenant (org-only: org_customers_mst only; sys: unchanged).
 */
export async function getAllCurrentTenantCustomers(
  tenantOrgId?: string | null
): Promise<{ customers: Customer[]; total: number }> {
  const supabase = await createClient();
  const tenantId = tenantOrgId ?? (await getTenantIdFromSession());
  const { data, error, count } = await supabase
    .from('org_customers_mst')
    .select('id, first_name, last_name, display_name, name, name2, phone, email, type, loyalty_points, created_at, updated_at', { count: 'exact' })
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true);
  if (error) {
    logger.error('Error fetching tenant customers', error as Error, { feature: 'customers' });
    throw new Error('Failed to fetch tenant customers');
  }
  const useSys = shouldUseSysCustomers();
  return {
    customers: (data || []).map((row) =>
      useSys ? mapToCustomer({ ...row, sys_customers_mst: row }) : mapFromOrgRow(row as Record<string, unknown>, tenantId)
    ),
    total: count || 0,
  };
}

/**
 * Get all customers for a specific tenant (org-only: org_customers_mst; sys: sys + org link).
 */
export async function getAllTenantCustomers(
  tenantOrgId?: string | null
): Promise<Customer[]> {
  const supabase = await createClient();
  const tenantId = tenantOrgId ?? (await getTenantIdFromSession());
  if (!shouldUseSysCustomers()) {
    const { data, error } = await supabase
      .from('org_customers_mst')
      .select('*')
      .eq('tenant_org_id', tenantId);
    if (error) {
      logger.error('Error fetching tenant customers', error as Error, { feature: 'customers' });
      throw new Error('Failed to fetch tenant customers');
    }
    return (data || []).map((row) => mapFromOrgRow(row as Record<string, unknown>, tenantId));
  }
  const { data, error } = await catalogReadClient(supabase)
    .from('sys_customers_mst')
    .select('*, org_customers_mst!inner(tenant_org_id)')
    .eq('org_customers_mst.tenant_org_id', tenantId);
  if (error) {
    logger.error('Error fetching tenant customers', error as Error, { feature: 'customers' });
    throw new Error('Failed to fetch tenant customers');
  }
  return (data || []).map((row) => mapToCustomer(row));
}

/**
 * Search customers with filters and pagination
 */ 

/**
 * Minimal customer search limited to the current tenant
 * Optimized with database-level filtering and search
 */
export async function searchCustomers( 
  params: CustomerSearchParams
): Promise<{ customers: CustomerListItem[]; total: number }> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const page = params.page || 1;
  const limit = params.limit || 100;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('org_customers_mst')
    .select('id, first_name, last_name, display_name, phone, email, type, loyalty_points, created_at', { count: 'exact' })
    .eq('tenant_org_id', tenantId);

  if (params.status === 'inactive') {
    query = query.eq('is_active', false);
  } else {
    query = query.eq('is_active', true);
  }

  if (params.search && params.search.trim().length > 0) {
    const searchTerm = params.search.trim();
    /*
    query = query.or( 
      //`first_name.ilike.*${searchTerm}*,last_name.ilike.*${searchTerm}*,phone.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*,display_name.ilike.*${searchTerm}*`
      //`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`
      `phone.ilike.%${searchTerm}%`
    );
    */
    /*
    query = query.or(
      `first_name.ilike.%${searchTerm}%,` +
      `last_name.ilike.%${searchTerm}%,` +
      `phone.ilike.%${searchTerm}%,` +
      `email.ilike.%${searchTerm}%,` +
      `display_name.ilike.%${searchTerm}%`
    );   
    */
    // Build OR filter string - PostgREST format: "field1.ilike.value1,field2.ilike.value2"
    const orFilter = [
      //`first_name.ilike.%${searchTerm}%`,
      //`last_name.ilike.%${searchTerm}%`,
      //`email.ilike.%${searchTerm}%`,
      //`display_name.ilike.%${searchTerm}%`,
      `phone.ilike.%${searchTerm}%`
    ].join(',');
    query = query.or(orFilter);
  }

  if (params.excludeB2b) {
    query = query.neq('type', 'b2b');
  }
  if (params.type) {
    query = query.eq('type', params.type);
  }

  if (params.startDate) {
    query = query.gte('created_at', params.startDate);
  }
  if (params.endDate) {
    // Include full day: if date-only (no time), append end-of-day
    const endVal = params.endDate.includes('T')
      ? params.endDate
      : `${params.endDate}T23:59:59.999Z`;
    query = query.lte('created_at', endVal);
  }

  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  if (sortBy === 'name') {
    query = query.order('first_name', { ascending: sortOrder === 'asc' });
  } else {
    query = query.order('created_at', { ascending: sortOrder === 'asc' });
  }

  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query;

  if (error) {
    logger.error('searchCustomers database error', error as Error, { feature: 'customers', action: 'search' });
    throw new Error(`Failed to search customers: ${error.message}`);
  }

  const customers: CustomerListItem[] =
    data?.map((c) => ({
      id: c.id,
      customerNumber: c.id, // Using id as customer number for now
      displayName: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
      name: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || null,
      name2: null, // Arabic name - would need to be added to database
      firstName: c.first_name || '',
      lastName: c.last_name || null,
      phone: c.phone || null,
      email: c.email || null,
      type: (c.type as CustomerType) || 'walk_in',
      profileStatus: 1,
      loyaltyPoints: c.loyalty_points || 0,
      totalOrders: 0, // Could be optimized with a separate query if needed
      lastOrderAt: null, // Could be optimized with a separate query if needed
      createdAt: c.created_at || '',
    })) || [];

  return {
    customers,
    total: count || 0,
  };
}

/**
 * Progressive customer search with fallback strategy
 * Step 1: Search current tenant's org_customers_mst
 * Step 2: If not found and searchAllOptions=true, search sys_customers_mst (global)
 * Step 3: If still not found and searchAllOptions=true, search other tenants' org_customers_mst
 */
export async function searchCustomersProgressive(
  params: CustomerSearchParams & { searchAllOptions?: boolean; skipCount?: boolean; excludeB2b?: boolean; tenantId?: string }
): Promise<{ customers: CustomerListItem[]; total: number }> {
  const supabase = await createClient();
  const tenantId = params.tenantId ?? (await getCurrentUserTenantSessionContext()).userTenantOrgId;
  const searchAllOptions = params.searchAllOptions ?? false;
  const skipCount = params.skipCount ?? false;
  const excludeB2b = params.excludeB2b ?? false;
  const searchTerm = params.search?.trim() || '';
  const searchPhone = params.searchPhone?.trim() || '';
  const searchName = params.searchName?.trim() || '';
  const searchEmail = params.searchEmail?.trim() || '';
  const limit = params.limit || 100;

  // Step 1: Search current tenant's org_customers_mst
  // skipCount=true for picker mode (limit<=15): avoids expensive count query for faster fetch
  const selectOpts = skipCount ? {} : { count: 'exact' as const };
  let query = supabase
    .from('org_customers_mst')
    .select('id, customer_id, customer_code, first_name, last_name, display_name, name, name2, phone, email, type, loyalty_points, created_at, tenant_org_id', selectOpts)
    .eq('tenant_org_id', tenantId);

  // Status filter (default: active)
  if (params.status === 'inactive') {
    query = query.eq('is_active', false);
  } else {
    query = query.eq('is_active', true);
  }

  // Exclude B2B when requested (e.g. /dashboard/customers - guest/stub/walk_in only)
  if (excludeB2b) {
    query = query.neq('type', 'b2b');
  }
  // Filter by type when provided
  if (params.type) {
    query = query.eq('type', params.type);
  }

  // Use field-specific search when provided; else fall back to combined search
  const hasFieldSearch = searchPhone.length > 0 || searchName.length > 0 || searchEmail.length > 0;
  if (hasFieldSearch) {
    const conditions: string[] = [];
    if (searchPhone.length > 0) conditions.push(`phone.ilike.%${searchPhone}%`);
    if (searchName.length > 0) {
      conditions.push(`first_name.ilike.%${searchName}%`);
      conditions.push(`last_name.ilike.%${searchName}%`);
      conditions.push(`display_name.ilike.%${searchName}%`);
    }
    if (searchEmail.length > 0) conditions.push(`email.ilike.%${searchEmail}%`);
    if (conditions.length > 0) query = query.or(conditions.join(','));
  } else if (searchTerm.length > 0) {
    query = query.or(`customer_code.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }

  query = query.limit(limit);
  const { data: currentTenantData, error: currentTenantError, count: currentTenantCount } = await query;

  if (currentTenantError) {
    logger.error('Error searching current tenant customers', currentTenantError as Error, { feature: 'customers', action: 'search' });
    throw new Error(`Failed to search customers: ${currentTenantError.message}`);
  }

  if (currentTenantData && currentTenantData.length > 0) {
    const customers: CustomerListItem[] = currentTenantData.map((c) => ({
      id: c.id,
      customerCode: c.customer_code ?? null,
      customerNumber: c.customer_code || c.id,
      displayName: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
      name: c.name || null,
      name2: c.name2 || null,
      firstName: c.first_name || '',
      lastName: c.last_name || null,
      phone: c.phone || null,
      email: c.email || null,
      type: (c.type as CustomerType) || 'walk_in',
      profileStatus: 1,
      loyaltyPoints: c.loyalty_points || 0,
      totalOrders: 0,
      lastOrderAt: null,
      createdAt: c.created_at || new Date().toISOString(),
      source: 'current_tenant',
      belongsToCurrentTenant: true,
      customerId: c.customer_id || undefined,
    }));
    return {
      customers,
      total: currentTenantCount || customers.length,
    };
  }

  // Tenant list/picker search never leaks other tenants or wildcard global records.
  // Exact global lookup by phone/email runs exclusively through lookupCustomerIdentity().
  return {
    customers: [],
    total: 0,
  };
}

/**
 * Link an existing global sys_customers_mst identity to the current tenant atomically.
 * Cross-tenant org_other_tenant linking is permanently disallowed for tenant isolation.
 */
export async function linkCustomerToTenant(
  sourceCustomerId: string,
  sourceType: 'sys' | 'org_other_tenant',
  _originalTenantId?: string
): Promise<{ orgCustomerId: string; customerId: string; customerCode: string }> {
  if (sourceType !== 'sys') {
    throw new Error('Cross-tenant customer linking is not permitted');
  }

  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;

  const { data: rpcRows, error: rpcError } = await catalogReadClient(supabase).rpc(
    'org_cust_create_or_connect',
    {
      p_tenant_org_id: tenantId,
      p_actor_user_id: curUserId,
      p_type: 'stub',
      p_source_channel: 'WEB_ADMIN',
      p_connect_sys_customer_id: sourceCustomerId,
    }
  );

  if (rpcError) {
    logger.error('Error linking customer to tenant', rpcError as Error, { feature: 'customers', action: 'link' });
    if (rpcError.message.includes('CMX_SYS_CUSTOMER_NOT_FOUND')) {
      throw new Error('Customer not found in global database');
    }
    throw new Error('Failed to link customer to tenant: ' + rpcError.message);
  }

  const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!rpcResult?.org_customer_id) {
    throw new Error('Failed to link customer to tenant');
  }

  return {
    orgCustomerId: rpcResult.org_customer_id,
    customerId: rpcResult.sys_customer_id ?? sourceCustomerId,
    customerCode: rpcResult.customer_code,
  };
}

export async function searchCustomersAll(
  params: CustomerSearchParams
): Promise<{ customers: CustomerListItem[]; total: number }> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  if (!shouldUseSysCustomers()) {
    let query = supabase
      .from('org_customers_mst')
      .select('*', { count: 'exact' })
      .eq('tenant_org_id', tenantId);
    if (params.search) {
      const searchTerm = `%${params.search}%`;
      query = query.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm},display_name.ilike.${searchTerm},name.ilike.${searchTerm}`
      );
    }
    if (params.type) query = query.eq('type', params.type);
    if (params.status === 'active') query = query.eq('is_active', true);
    else if (params.status === 'inactive') query = query.eq('is_active', false);
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    if (sortBy === 'name') query = query.order('first_name', { ascending: sortOrder === 'asc' });
    else query = query.order('created_at', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) {
      logger.error('Error searching customers', error as Error, { feature: 'customers', action: 'searchAll' });
      throw new Error('Failed to search customers');
    }
    const customerIds = data?.map((c) => c.id) || [];
    const { data: orderCounts } = await supabase
      .from('org_orders_mst')
      .select('customer_id')
      .eq('tenant_org_id', tenantId)
      .in('customer_id', customerIds);
    const orderCountMap = new Map<string, number>();
    orderCounts?.forEach((o) => {
      orderCountMap.set(o.customer_id, (orderCountMap.get(o.customer_id) || 0) + 1);
    });
    const customers: CustomerListItem[] = (data || []).map((c) => ({
      id: c.id,
      customerNumber: c.id,
      displayName: c.display_name ?? (`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unknown'),
      name: c.name ?? null,
      name2: c.name2 ?? null,
      firstName: c.first_name ?? '',
      lastName: c.last_name ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      type: (c.type as CustomerType) ?? 'walk_in',
      profileStatus: 1,
      loyaltyPoints: c.loyalty_points ?? 0,
      totalOrders: orderCountMap.get(c.id) ?? 0,
      lastOrderAt: null,
      createdAt: (c.created_at as string) ?? '',
    }));
    return { customers, total: count ?? 0 };
  }

  let query = catalogReadClient(supabase)
    .from('sys_customers_mst')
    .select(
      `*,
      org_customers_mst!inner(tenant_org_id, loyalty_points, is_active)`,
      { count: 'exact' }
    )
    .eq('org_customers_mst.tenant_org_id', tenantId);
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    query = query.or(
      `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm},customer_number.ilike.${searchTerm}`
    );
  }
  if (params.type) query = query.eq('type', params.type);
  if (params.status === 'active') query = query.eq('org_customers_mst.is_active', true);
  else if (params.status === 'inactive') query = query.eq('org_customers_mst.is_active', false);
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  if (sortBy === 'name') query = query.order('first_name', { ascending: sortOrder === 'asc' });
  else if (sortBy === 'createdAt') query = query.order('created_at', { ascending: sortOrder === 'asc' });
  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) {
    logger.error('Error searching customers', error as Error, { feature: 'customers', action: 'searchAll' });
    throw new Error('Failed to search customers');
  }
  const customerIds = data?.map((c) => c.id) || [];
  const { data: orderCounts } = await supabase
    .from('org_orders_mst')
    .select('customer_id')
    .eq('tenant_org_id', tenantId)
    .in('customer_id', customerIds);
  const orderCountMap = new Map<string, number>();
  orderCounts?.forEach((o) => {
    orderCountMap.set(o.customer_id, (orderCountMap.get(o.customer_id) || 0) + 1);
  });
  const customers: CustomerListItem[] =
    data?.map((c) => ({
      id: c.id,
      customerNumber: c.customer_number,
      name: c.name,
      name2: c.name2,
      firstName: c.first_name || '',
      lastName: c.last_name,
      displayName: c.display_name,
      preferences: c.preferences as unknown as CustomerPreferences,
      phone: c.phone,
      email: c.email,
      type: c.type as any,
      profileStatus: c.profile_status as any,
      loyaltyPoints: c.org_customers_mst[0]?.loyalty_points || 0,
      totalOrders: orderCountMap.get(c.id) || 0,
      lastOrderAt: null, // TODO: Optimize this query
      createdAt: c.created_at || new Date().toISOString(),
    })) || [];

  return {
    customers,
    total: count || 0,
  };
}

/**
 * Update customer profile (org-only: org_customers_mst only; sys: org + sys).
 * Preferences-only requests remain tenant-local so channel consent never changes a shared profile.
 * Tenant is resolved server-side from the authenticated session, never from the update payload.
 * @param customerId Tenant customer identifier; preferences-only requests require org_customers_mst.id.
 * @param updates Requested profile fields or a partial tenant preference object.
 * @returns The persisted customer profile.
 * @throws When preferences are invalid or the customer is outside the authenticated tenant.
 * @example
 * await updateCustomer(customerId, { preferences: { notifications: { whatsapp: true } } });
 */
export async function updateCustomer(
  customerId: string,
  updates: CustomerUpdateRequest
): Promise<Customer> {
  const supabase = await createClient();
  // Resolve the tenant server-side so preference writes cannot choose another tenant through the payload.
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;

  if (updates.preferences !== undefined && Object.keys(updates).every((key) => key === 'preferences')) {
    const preferences = updates.preferences;
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      throw new Error('Customer preferences must be an object');
    }
    const notifications = preferences.notifications;
    if (notifications !== undefined) {
      if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
        throw new Error('Customer notification preferences must be an object');
      }
      for (const channel of ['whatsapp', 'sms', 'email'] as const) {
        if (notifications[channel] !== undefined && typeof notifications[channel] !== 'boolean') {
          throw new Error(`Customer ${channel} preference must be a boolean`);
        }
      }
    }

    // Consent belongs to this tenant; a preferences-only update must not rewrite customer names.
    const { data: existing, error: lookupError } = await supabase
      .from('org_customers_mst')
      .select('preferences')
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();
    if (lookupError || !existing) throw new Error('Customer not found or access denied');

    const previous = existing.preferences && typeof existing.preferences === 'object' && !Array.isArray(existing.preferences)
      ? existing.preferences as CustomerPreferences
      : {};
    // Preserve unrelated preferences and channel choices when changing only WhatsApp consent.
    const merged: CustomerPreferences = {
      ...previous,
      ...preferences,
      ...(notifications !== undefined ? { notifications: { ...previous.notifications, ...notifications } } : {}),
    };
    const { data: updated, error: updateError } = await supabase
      .from('org_customers_mst')
      .update({ preferences: merged as Json, updated_at: new Date().toISOString(), updated_by: curUserId })
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .select()
      .single();
    if (updateError || !updated) throw new Error('Customer not found or access denied');
    return mapFromOrgRow(updated as Record<string, unknown>, tenantId);
  }

  // Preferred-language-only requests stay tenant-local for the same reason preferences do:
  // a notification-dispatch signal must never ride along with and risk rewriting profile fields.
  if (updates.preferredLanguage !== undefined && Object.keys(updates).every((key) => key === 'preferredLanguage')) {
    const preferredLanguage = updates.preferredLanguage;
    if (preferredLanguage !== null && (typeof preferredLanguage !== 'string' || !preferredLanguage.trim())) {
      throw new Error('Customer preferred language must be a non-blank code or null');
    }
    // sys_language_cd(code) FK (migration 0608) is the actual validity check; this call surfaces
    // that as a clear error rather than a raw constraint-violation message.
    const { data: updated, error: updateError } = await supabase
      .from('org_customers_mst')
      .update({
        preferred_language: preferredLanguage ? preferredLanguage.trim() : null,
        updated_at: new Date().toISOString(),
        updated_by: curUserId,
      })
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .select()
      .single();
    if (updateError) {
      if (updateError.code === '23503') throw new Error('Unknown language code');
      throw new Error('Customer not found or access denied');
    }
    if (!updated) throw new Error('Customer not found or access denied');
    return mapFromOrgRow(updated as Record<string, unknown>, tenantId);
  }

  // Build partial JSONB patch containing only explicitly supplied fields.
  const patch: Record<string, unknown> = {};
  if (updates.firstName !== undefined) patch.first_name = updates.firstName.trim();
  if (updates.lastName !== undefined) patch.last_name = updates.lastName?.trim() || null;
  if (updates.displayName !== undefined) {
    patch.display_name = updates.displayName?.trim() || null;
  } else if (updates.firstName !== undefined || updates.lastName !== undefined) {
    patch.display_name = `${updates.firstName ?? ''} ${updates.lastName ?? ''}`.trim();
  }
  if (updates.name !== undefined) {
    patch.name = updates.name?.trim() || null;
  } else if (patch.display_name !== undefined) {
    patch.name = patch.display_name;
  }
  if (updates.name2 !== undefined) patch.name2 = updates.name2?.trim() || null;

  if (updates.phone !== undefined) {
    if (updates.phone && updates.phone.trim().length > 0) {
      const defaultCountryCode = await getDefaultCountryCodeForCurrentTenant();
      const phoneResult = normalizeCustomerPhone(updates.phone, defaultCountryCode);
      if (!phoneResult.isValid) {
        throw new Error('Invalid phone number format');
      }
      patch.phone = phoneResult.normalized;
    } else {
      patch.phone = null;
    }
  }

  if (updates.email !== undefined) {
    if (updates.email && updates.email.trim().length > 0) {
      const emailResult = normalizeCustomerEmail(updates.email);
      if (!emailResult.isValid) {
        throw new Error('Invalid email format');
      }
      patch.email = emailResult.normalized;
    } else {
      patch.email = null;
    }
  }

  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.area !== undefined) patch.area = updates.area;
  if (updates.building !== undefined) patch.building = updates.building;
  if (updates.floor !== undefined) patch.floor = updates.floor;
  if (updates.preferences !== undefined) patch.preferences = updates.preferences;
  if (updates.preferredLanguage !== undefined) patch.preferred_language = updates.preferredLanguage;

  if (updates.customerCategoryId !== undefined) {
    if (updates.customerCategoryId) {
      const { data: cat } = await supabase
        .from('org_customer_category_cf')
        .select('id, is_b2b')
        .eq('tenant_org_id', tenantId)
        .eq('id', updates.customerCategoryId)
        .single();
      if (!cat) {
        throw new Error('Invalid customer category');
      }
    }
    patch.customer_category_id = updates.customerCategoryId || null;
  }
  if (updates.companyName !== undefined) patch.company_name = updates.companyName;
  if (updates.companyName2 !== undefined) patch.company_name2 = updates.companyName2;
  if (updates.taxId !== undefined) patch.tax_id = updates.taxId;
  if (updates.creditLimit !== undefined) patch.credit_limit = updates.creditLimit;
  if (updates.paymentTermsDays !== undefined) patch.payment_terms_days = updates.paymentTermsDays;
  if (updates.costCenterCode !== undefined) patch.cost_center_code = updates.costCenterCode;

  const { error: rpcError } = await catalogReadClient(supabase).rpc('org_cust_update_and_sync', {
    p_tenant_org_id: tenantId,
    p_org_customer_id: customerId,
    p_patch: patch as Json,
    p_actor_user_id: curUserId,
    p_source_channel: 'WEB_ADMIN',
  });

  if (rpcError) {
    logger.error('Error updating customer via org_cust_update_and_sync', rpcError as Error, { feature: 'customers', action: 'update' });
    if (rpcError.message.includes('CMX_CUSTOMER_NOT_FOUND')) {
      throw new Error('Customer not found or access denied');
    }
    if (rpcError.code === '23505') {
      throw new Error('Phone number or email is already in use by another customer');
    }
    throw new Error('Failed to update customer: ' + rpcError.message);
  }

  const { data: orgRow, error: fetchError } = await supabase
    .from('org_customers_mst')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .single();

  if (fetchError || !orgRow) {
    throw new Error('Customer not found or access denied');
  }

  return mapFromOrgRow(orgRow as Record<string, unknown>, tenantId);
}

/**
 * Reactivate an inactive customer in the current tenant with audit logging.
 */
export async function reactivateCustomer(customerId: string): Promise<Customer> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;

  const { error: rpcError } = await catalogReadClient(supabase).rpc('org_cust_update_and_sync', {
    p_tenant_org_id: tenantId,
    p_org_customer_id: customerId,
    p_patch: { is_active: true } as Json,
    p_actor_user_id: curUserId,
    p_source_channel: 'WEB_ADMIN',
  });

  if (rpcError) {
    logger.error('Error reactivating customer', rpcError as Error, { feature: 'customers', action: 'reactivate' });
    if (rpcError.message.includes('CMX_CUSTOMER_NOT_FOUND')) {
      throw new Error('Customer not found or access denied');
    }
    if (rpcError.code === '23505') {
      throw new Error('Cannot reactivate: another active customer already uses this phone or email');
    }
    throw new Error('Failed to reactivate customer: ' + rpcError.message);
  }

  const { data: orgRow, error: fetchError } = await supabase
    .from('org_customers_mst')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .single();

  if (fetchError || !orgRow) {
    throw new Error('Customer not found or access denied');
  }

  return mapFromOrgRow(orgRow as Record<string, unknown>, tenantId);
}

/**
 * Fetch tenant-scoped customer audit history from org_customer_audit_dtl.
 * Always filters explicitly by tenant_org_id and org_customer_id.
 */
export async function getCustomerAuditHistory(
  orgCustomerId: string,
  limit: number = 50
): Promise<CustomerAuditEntry[]> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const boundedLimit = Math.min(100, Math.max(1, limit));

  const { data, error } = await supabase
    .from('org_customer_audit_dtl')
    .select(
      'id, org_customer_id, sys_customer_id, action_type, changed_fields, old_values, new_values, actor_user_id, source_channel, notes, changed_at'
    )
    .eq('tenant_org_id', tenantId)
    .eq('org_customer_id', orgCustomerId)
    .order('changed_at', { ascending: false })
    .limit(boundedLimit);

  if (error) {
    logger.error('Error fetching customer audit history', error as Error, {
      feature: 'customers',
      action: 'auditHistory',
    });
    throw new Error('Failed to fetch customer audit history');
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    orgCustomerId: row.org_customer_id as string,
    sysCustomerId: (row.sys_customer_id as string) ?? null,
    actionType: row.action_type as OrgCustomerAuditActionType,
    changedFields: Array.isArray(row.changed_fields)
      ? (row.changed_fields as string[])
      : [],
    oldValues:
      row.old_values && typeof row.old_values === 'object' && !Array.isArray(row.old_values)
        ? (row.old_values as Record<string, unknown>)
        : null,
    newValues:
      row.new_values && typeof row.new_values === 'object' && !Array.isArray(row.new_values)
        ? (row.new_values as Record<string, unknown>)
        : null,
    actorUserId: (row.actor_user_id as string) ?? null,
    sourceChannel: (row.source_channel as string) ?? 'WEB_ADMIN',
    notes: (row.notes as string) ?? null,
    changedAt: row.changed_at as string,
  }));
}

/**
 * Upgrade stub customer to full profile (org-only: update org_customers_mst; sys: update sys_customers_mst).
 */
export async function upgradeCustomerProfile(
  customerId: string,
  email?: string,
  preferences?: CustomerPreferences
): Promise<Customer> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;

  if (!shouldUseSysCustomers()) {
    const { data: orgRow, error } = await supabase
      .from('org_customers_mst')
      .update({
        type: 'full',
        email: email ?? undefined,
        preferences: (preferences ?? {}) as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .select()
      .single();
    if (error) {
      logger.error('Error upgrading customer', error as Error, { feature: 'customers', action: 'upgrade' });
      throw new Error('Customer not found or access denied');
    }
    return mapFromOrgRow(orgRow as Record<string, unknown>, tenantId);
  }

  const { data: customer } = await catalogReadClient(supabase)
    .from('sys_customers_mst')
    .select('*, org_customers_mst!inner(tenant_org_id)')
    .eq('id', customerId)
    .eq('org_customers_mst.tenant_org_id', tenantId)
    .maybeSingle();
  if (!customer) {
    throw new Error('Customer not found or access denied');
  }
  if (customer.profile_status === 'full') {
    throw new Error('Customer is already a full profile');
  }

  const { data: upgraded, error } = await catalogReadClient(supabase)
    .from('sys_customers_mst')
    .update({
      profile_status: 'full',
      type: 'full',
      email: email ?? customer.email,
      preferences: (preferences ??
        customer.preferences ??
        {}) as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single();
  if (error) {
    logger.error('Error upgrading customer', error as Error, { feature: 'customers', action: 'upgrade' });
    throw new Error('Failed to upgrade customer profile');
  }
  return mapToCustomer(upgraded);
}

/**
 * Merge duplicate customers (Admin only). Org-only: source/target are org_customers_mst ids; sys: source/target are sys ids (customer_id in org).
 */
export async function mergeCustomers(
  request: MergeCustomersRequest
): Promise<{
  targetCustomer: Customer;
  ordersMoved: number;
  loyaltyPointsMerged: number;
}> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const { sourceCustomerId, targetCustomerId } = request;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  if (!shouldUseSysCustomers()) {
    const { data: sourceRow } = await supabase
      .from('org_customers_mst')
      .select('id, loyalty_points')
      .eq('id', sourceCustomerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();
    const { data: targetRow } = await supabase
      .from('org_customers_mst')
      .select('id, loyalty_points')
      .eq('id', targetCustomerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();
    if (!sourceRow || !targetRow) {
      throw new Error('One or both customers not found');
    }
    const { error: ordersError } = await supabase
      .from('org_orders_mst')
      .update({ customer_id: targetCustomerId })
      .eq('customer_id', sourceCustomerId)
      .eq('tenant_org_id', tenantId);
    if (ordersError) {
      logger.error('Error moving orders', ordersError as Error, { feature: 'customers', action: 'merge' });
      throw new Error('Failed to move orders');
    }
    const loyaltyPointsMerged = Number(sourceRow.loyalty_points) || 0;
    await supabase
      .from('org_customers_mst')
      .update({
        loyalty_points: (Number(targetRow.loyalty_points) || 0) + loyaltyPointsMerged,
      })
      .eq('id', targetCustomerId)
      .eq('tenant_org_id', tenantId);
    await supabase
      .from('org_customers_mst')
      .update({ is_active: false, rec_status: 0 })
      .eq('id', sourceCustomerId)
      .eq('tenant_org_id', tenantId);
    const targetCustomer = await findCustomerById(targetCustomerId);
    if (!targetCustomer) throw new Error('Target customer not found after merge');
    const { count } = await supabase
      .from('org_orders_mst')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', targetCustomerId)
      .eq('tenant_org_id', tenantId);
    return {
      targetCustomer,
      ordersMoved: count ?? 0,
      loyaltyPointsMerged,
    };
  }

  const { data: sourceLink } = await supabase
    .from('org_customers_mst')
    .select('loyalty_points')
    .eq('customer_id', sourceCustomerId)
    .eq('tenant_org_id', tenantId)
    .single();
  const { data: targetLink } = await supabase
    .from('org_customers_mst')
    .select('loyalty_points')
    .eq('customer_id', targetCustomerId)
    .eq('tenant_org_id', tenantId)
    .single();
  if (!sourceLink || !targetLink) {
    throw new Error('One or both customers not found');
  }

  const { error: ordersError } = await supabase
    .from('org_orders_mst')
    .update({ customer_id: targetCustomerId })
    .eq('customer_id', sourceCustomerId)
    .eq('tenant_org_id', tenantId);
  if (ordersError) {
    logger.error('Error moving orders', ordersError as Error, { feature: 'customers', action: 'merge' });
    throw new Error('Failed to move orders');
  }

  const loyaltyPointsMerged = sourceLink.loyalty_points || 0;
  const { error: pointsError } = await supabase
    .from('org_customers_mst')
    .update({
      loyalty_points: (targetLink.loyalty_points || 0) + loyaltyPointsMerged,
    })
    .eq('customer_id', targetCustomerId)
    .eq('tenant_org_id', tenantId);
  if (pointsError) {
    logger.error('Error merging loyalty points', pointsError as Error, { feature: 'customers', action: 'merge' });
  }

  await supabase
    .from('org_customers_mst')
    .update({ is_active: false, rec_status: 0 })
    .eq('customer_id', sourceCustomerId)
    .eq('tenant_org_id', tenantId);

  const { count: ordersMoved } = await supabase
    .from('org_orders_mst')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', targetCustomerId)
    .eq('tenant_org_id', tenantId);

  try {
    await supabase.from('org_customer_merge_log').insert({
      tenant_org_id: tenantId,
      source_customer_id: sourceCustomerId,
      target_customer_id: targetCustomerId,
      merged_by: user.id,
      merge_reason: request.reason ?? null,
      orders_moved: ordersMoved ?? 0,
      loyalty_points_merged: loyaltyPointsMerged,
    });
  } catch {
    // Log table may not exist
  }

  const targetCustomer = await findCustomerById(targetCustomerId);
  if (!targetCustomer) throw new Error('Target customer not found after merge');
  return {
    targetCustomer,
    ordersMoved: ordersMoved ?? 0,
    loyaltyPointsMerged,
  };
}

/**
 * Deactivate customer (soft delete).
 * Accepts either org_customers_mst.id or sys_customers_mst.id (customer_id); resolves tenant row then sets is_active=false, rec_status=0.
 */
export async function deactivateCustomer(customerId: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data: orgRow, error: findError } = await supabase
    .from('org_customers_mst')
    .select('id')
    .eq('tenant_org_id', tenantId)
    .or(`id.eq.${customerId},customer_id.eq.${customerId}`)
    .maybeSingle();

  if (findError || !orgRow) {
    throw new Error('Customer not found or access denied');
  }

  const { error } = await supabase
    .from('org_customers_mst')
    .update({ is_active: false, rec_status: 0 })
    .eq('id', orgRow.id)
    .eq('tenant_org_id', tenantId);

  if (error) {
    throw new Error(`Failed to deactivate customer: ${error.message}`);
  }
}

/**
 * Get customer statistics (org-only: from org_customers_mst; sys: from sys + org link).
 */
export async function getCustomerStatistics(): Promise<CustomerStatistics> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  if (!shouldUseSysCustomers()) {
    const { data: customers } = await supabase
      .from('org_customers_mst')
      .select('id, type, created_at, is_active')
      .eq('tenant_org_id', tenantId);
    const total = customers?.length ?? 0;
    const byType = {
      guest: customers?.filter((c) => c.type === 'guest').length ?? 0,
      stub: customers?.filter((c) => c.type === 'stub').length ?? 0,
      full: customers?.filter((c) => c.type === 'full').length ?? 0,
    };
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth =
      customers?.filter((c) => c.created_at && new Date(c.created_at) >= firstDayOfMonth).length ?? 0;
    const active = customers?.filter((c) => c.is_active).length ?? 0;
    const inactive = total - active;
    return { total, byType, newThisMonth, active, inactive };
  }

  const { data: customers } = await catalogReadClient(supabase)
    .from('sys_customers_mst')
    .select('id, type, created_at, org_customers_mst!inner(tenant_org_id, is_active)')
    .eq('org_customers_mst.tenant_org_id', tenantId);

  const total = customers?.length ?? 0;
  const byType = {
    guest: customers?.filter((c) => c.type === 'guest').length ?? 0,
    stub: customers?.filter((c) => c.type === 'stub').length ?? 0,
    full: customers?.filter((c) => c.type === 'full').length ?? 0,
  };
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth =
    customers?.filter((c) => c.created_at && new Date(c.created_at) >= firstDayOfMonth).length ?? 0;
  const active = customers?.filter((c) => (c as { org_customers_mst?: Array<{ is_active?: boolean }> }).org_customers_mst?.[0]?.is_active).length ?? 0;
  const inactive = total - active;
  return { total, byType, newThisMonth, active, inactive };
}

// ==================================================================
// UTILITY FUNCTIONS
// ==================================================================

/**
 * Map database row to Customer type
 */
function mapToCustomer(row: any): Customer {
  return {
    id: row.id,
    customerNumber: row.customer_number,
    firstName: row.first_name || '',
    lastName: row.last_name,
    displayName: row.display_name,
    name: row.name,
    name2: row.name2,
    phone: row.phone,
    phoneVerified: row.phone_verified || false,
    email: row.email,
    emailVerified: row.email_verified || false,
    type: row.type,
    profileStatus: row.profile_status,
    avatarUrl: row.avatar_url,
    preferences: row.preferences || {},
    // sys_customers_mst (legacy path) has no preferred_language column -- migration 0608 only added it to org_customers_mst.
    preferredLanguage: row.preferred_language ?? null,
    address: row.address,
    area: row.area,
    building: row.building,
    floor: row.floor,
    firstTenantOrgId: row.first_tenant_org_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}
