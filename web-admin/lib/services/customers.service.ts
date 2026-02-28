/**
 * PRD-003: Customer Management Service
 * Core business logic for progressive customer engagement.
 * When CONNECT_WITH_SYS_CUSTOMERS !== 'true', only org_ tables are used (org_customers_mst).
 * When CONNECT_WITH_SYS_CUSTOMERS=true, methods may use sys_customers_mst and org_customers_mst.
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { logger } from '@/lib/utils/logger';
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
} from '@/lib/types/customer';

/** When true, service uses sys_customers_mst + org_customers_mst; when false, only org_customers_mst. */
function useSysCustomers(): boolean {
  
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

/** Map org_customers_mst row to Customer (org-only mode). */
function mapFromOrgRow(row: Record<string, unknown>, tenantId: string): Customer {
  return {
    id: row.id as string,
    customerNumber: (row.customer_number as string) ?? (row.id as string),
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
    profileStatus: (row.profile_status as number) ?? 1,
    avatarUrl: null,
    preferences: (row.preferences as CustomerPreferences) ?? {},
    address: (row.address as string) ?? null,
    area: (row.area as string) ?? null,
    building: (row.building as string) ?? null,
    floor: (row.floor as string) ?? null,
    firstTenantOrgId: tenantId,
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
  let normalized = (phone ?? '').trim().replace(/[\s\-\(\)]/g, '');

  // If phone already contains country code (starts with +), keep it; otherwise prepend default
  if (!normalized.startsWith('+') && !normalized.startsWith('00')) {
    normalized = defaultCountryCode + normalized;
  }

  // Extract country code and national number
  const countryCodeMatch = normalized.match(/^\+(\d{1,3})/);
  const countryCode = countryCodeMatch ? '+' + countryCodeMatch[1] : defaultCountryCode;
  const nationalNumber = normalized.replace(countryCode, '');

  // Basic validation: E.164 format is +[1-3 digits country][rest]
  const isValid = /^\+\d{10,15}$/.test(normalized);

  return {
    normalized,
    countryCode,
    nationalNumber,
    isValid,
  };
}

/**
 * Mask phone number for display
 * "+96890123456" → "+968901****56"
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 10) return phone;

  const normalized = normalizePhone(phone).normalized;
  const visibleStart = normalized.substring(0, normalized.length - 6);
  const visibleEnd = normalized.substring(normalized.length - 2);

  return `${visibleStart}****${visibleEnd}`;
}

// ==================================================================
// CUSTOMER NUMBER GENERATION
// ==================================================================

async function getCurrentUserTenantSessionContext(): Promise<CurrentUserTenantSessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized: No user');
  }
  const curUserId = user.id;
  const curUserRole = user.user_metadata?.role;
  const curUserTenantOrgId = user.user_metadata?.tenant_org_id;
  return {
    userId: curUserId,
    userRole: curUserRole,
    userTenantOrgId: curUserTenantOrgId,
  };
}
// Note: Using centralized getTenantIdFromSession from @/lib/db/tenant-context
// The centralized version uses user.user_metadata?.tenant_org_id which is more reliable

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

  // Call the database function to generate customer number
  const { data, error } = await supabase.rpc('generate_customer_number', {
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
 * Create a new customer (guest, stub, or full).
 * Org-only: inserts into org_customers_mst only. Sys mode: inserts sys_customers_mst then org_customers_mst link.
 */
export async function createCustomer(
  request: CustomerCreateRequest
): Promise<Customer> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }
  const session = await getCurrentUserTenantSessionContext();
  const curUserId = session.userId;
  let normalizedPhone: string | null = null;
  if ('phone' in request && request.phone) {
    const defaultCountryCode = await getDefaultCountryCodeForCurrentTenant();
    const phoneResult = normalizePhone(request.phone, defaultCountryCode);
    if (!phoneResult.isValid) {
      throw new Error('Invalid phone number format');
    }
    normalizedPhone = phoneResult.normalized;
    const duplicateCheck = useSysCustomers()
      ? await supabase.from('sys_customers_mst').select('id').eq('phone', normalizedPhone).maybeSingle()
      : await supabase.from('org_customers_mst').select('id').eq('tenant_org_id', tenantId).eq('phone', normalizedPhone).maybeSingle();
    if (duplicateCheck.data) {
      if (useSysCustomers()) {
        const tenantLink = await supabase
          .from('org_customers_mst')
          .select('customer_id')
          .eq('customer_id', duplicateCheck.data.id)
          .eq('tenant_org_id', tenantId)
          .maybeSingle();
        if (tenantLink.data) {
          throw new Error(`Customer with phone ${maskPhone(normalizedPhone)} already exists`);
        }
      } else {
        throw new Error(`Customer with phone ${maskPhone(normalizedPhone)} already exists`);
      }
    }
  }

  if (!useSysCustomers()) {
    const displayName = request.displayName ?? `${request.firstName} ${('lastName' in request && request.lastName) || ''}`.trim();
    const name = request.name ?? displayName;
    const { data: orgRow, error: orgError } = await supabase
      .from('org_customers_mst')
      .insert({
        tenant_org_id: tenantId,
        customer_id: null,
        first_name: request.firstName,
        last_name: 'lastName' in request ? request.lastName : null,
        name,
        name2: request.name2 ?? null,
        display_name: displayName,
        phone: normalizedPhone,
        email: 'email' in request ? request.email : null,
        type: request.type ?? 'walk_in',
        loyalty_points: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: curUserId,
        customer_source_type: 'DIRECT',
      })
      .select()
      .single();
    if (orgError) {
      logger.error('Error creating customer', orgError as Error, { feature: 'customers', action: 'create' });
      throw new Error('Failed to create customer: ' + orgError.message);
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
    return mapFromOrgRow(orgRow as Record<string, unknown>, tenantId);
  }

  const customerNumber = await generateCustomerNumber(tenantId);
  const profileStatus = request.type ?? 'guest';
  const phoneVerified = request.type === 'full' && !!normalizedPhone;
  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .insert({
      first_name: request.firstName,
      last_name: 'lastName' in request ? request.lastName : null,
      name: request.name ?? request.firstName + ' ' + (('lastName' in request && request.lastName) ?? ''),
      name2: request.name2 ?? null,
      display_name: request.displayName ?? request.firstName + ' ' + (('lastName' in request && request.lastName) ?? ''),
      phone: normalizedPhone,
      email: 'email' in request ? request.email : null,
      type: request.type,
      customer_number: customerNumber,
      profile_status: profileStatus,
      phone_verified: phoneVerified,
      email_verified: false,
      first_tenant_org_id: tenantId,
      created_at: new Date().toISOString(),
      created_by: curUserId,
      customer_source_type: 'TENANT',
    })
    .select()
    .single();
  if (customerError) {
    logger.error('Error creating customer', customerError as Error, { feature: 'customers', action: 'create' });
    throw new Error('Failed to create customer: ' + customerError.message);
  }
  const { error: linkError } = await supabase
    .from('org_customers_mst')
    .insert({
      customer_id: customer.id,
      tenant_org_id: tenantId,
      name: request.name ?? null,
      name2: request.name2 ?? null,
      first_name: request.firstName,
      last_name: 'lastName' in request ? request.lastName : null,
      display_name: `${request.firstName} ${('lastName' in request && request.lastName) || ''}`.trim(),
      phone: normalizedPhone,
      email: 'email' in request ? request.email : null,
      type: request.type,
      loyalty_points: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: curUserId,
      customer_source_type: 'TENANT',
    });
  if (linkError) {
    logger.error('Error linking customer to tenant', linkError as Error, { feature: 'customers', action: 'create' });
    await supabase.from('sys_customers_mst').delete().eq('id', customer.id);
    throw new Error('Failed to link customer to tenant: ' + linkError.message);
  }
  if (request.type === 'full' && 'addresses' in request && request.addresses) {
    const addressesService = await import('./customer-addresses.service');
    for (const addressReq of request.addresses) {
      try {
        await addressesService.createAddress(customer.id, addressReq);
      } catch (err) {
        logger.error('Error creating address', err as Error, { feature: 'customers', action: 'create' });
      }
    }
  }
  return mapToCustomer(customer);
}

/**
 * Find customer by ID (org_customers_mst.id when org-only; sys or org id when CONNECT_WITH_SYS_CUSTOMERS).
 */
export async function findCustomerById(
  customerId: string
): Promise<CustomerWithTenantData | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  if (!useSysCustomers()) {
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
      .select('id, total, delivered_at')
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

  const { data: customer, error } = await supabase
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
    .select('id, total, delivered_at')
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
  if (!useSysCustomers()) {
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
  const { data: customer, error } = await supabase
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
  const useSys = useSysCustomers();
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
  if (!useSysCustomers()) {
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
  const { data, error } = await supabase
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
  params: CustomerSearchParams & { searchAllOptions?: boolean; skipCount?: boolean }
): Promise<{ customers: CustomerListItem[]; total: number }> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const searchAllOptions = params.searchAllOptions ?? false;
  const skipCount = params.skipCount ?? false;
  const searchTerm = params.search?.trim() || '';
  const limit = params.limit || 100;

  // Step 1: Search current tenant's org_customers_mst
  // skipCount=true for picker mode (limit<=15): avoids expensive count query for faster fetch
  const selectOpts = skipCount ? {} : { count: 'exact' as const };
  let query = supabase
    .from('org_customers_mst')
    .select('id, customer_id, first_name, last_name, display_name, name, name2, phone, email, type, loyalty_points, created_at, tenant_org_id', selectOpts)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true);
  
  if (searchTerm.length > 0) {
    query = query.or(`phone.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }
  
  query = query.limit(limit);
  const { data: currentTenantData, error: currentTenantError, count: currentTenantCount } = await query;
  
  if (currentTenantError) {
    logger.error('Error searching current tenant customers', currentTenantError as Error, { feature: 'customers', action: 'search' });
    throw new Error(`Failed to search customers: ${currentTenantError.message}`);
  }
  
  // If found in current tenant, return immediately
  if (currentTenantData && currentTenantData.length > 0) {
    const customers: CustomerListItem[] = currentTenantData.map((c) => ({
      id: c.id,
      customerNumber: c.id,
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

  if (!useSysCustomers()) {
    return { customers: [], total: 0 };
  }

  // Step 2: If searchAllOptions is true, search sys_customers_mst (global)
  if (searchAllOptions && searchTerm.length > 0) {
    let sysQuery = supabase
      .from('sys_customers_mst')
      .select('id, first_name, last_name, display_name, name, name2, phone, email, type, created_at')
      .limit(limit);
    
    sysQuery = sysQuery.or(`phone.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    
    const { data: sysData, error: sysError } = await sysQuery;
    
    if (!sysError && sysData && sysData.length > 0) {
      // OPTIMIZATION: Batch check all links in a single query instead of N+1 queries
      const sysCustomerIds = sysData.map(c => c.id);
      const { data: existingLinks } = await supabase
        .from('org_customers_mst')
        .select('id, customer_id, loyalty_points')
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .in('customer_id', sysCustomerIds);
      
      // Create a map for quick lookup
      const linkMap = new Map<string, { id: string; loyalty_points: number }>();
      existingLinks?.forEach(link => {
        if (link.customer_id) {
          linkMap.set(link.customer_id, { id: link.id, loyalty_points: link.loyalty_points || 0 });
        }
      });
      
      const results: CustomerListItem[] = sysData.map((sysCustomer) => {
        const existingLink = linkMap.get(sysCustomer.id);
        
        if (existingLink) {
          // Already linked - return as current tenant customer
          return {
            id: existingLink.id,
            customerNumber: existingLink.id,
            displayName: sysCustomer.display_name || `${sysCustomer.first_name || ''} ${sysCustomer.last_name || ''}`.trim() || 'Unknown',
            name: sysCustomer.name || null,
            name2: sysCustomer.name2 || null,
            firstName: sysCustomer.first_name || '',
            lastName: sysCustomer.last_name || null,
            phone: sysCustomer.phone || null,
            email: sysCustomer.email || null,
            type: (sysCustomer.type as CustomerType) || 'walk_in',
            profileStatus: 1,
            loyaltyPoints: existingLink.loyalty_points,
            totalOrders: 0,
            lastOrderAt: null,
            createdAt: sysCustomer.created_at || '',
            source: 'current_tenant',
            belongsToCurrentTenant: true,
            customerId: sysCustomer.id,
          };
        } else {
          // Not linked - return as sys_global
          return {
            id: sysCustomer.id,
            customerNumber: sysCustomer.id,
            displayName: sysCustomer.display_name || `${sysCustomer.first_name || ''} ${sysCustomer.last_name || ''}`.trim() || 'Unknown',
            name: sysCustomer.name || null,
            name2: sysCustomer.name2 || null,
            firstName: sysCustomer.first_name || '',
            lastName: sysCustomer.last_name || null,
            phone: sysCustomer.phone || null,
            email: sysCustomer.email || null,
            type: (sysCustomer.type as CustomerType) || 'walk_in',
            profileStatus: 1,
            loyaltyPoints: 0,
            totalOrders: 0,
            lastOrderAt: null,
            createdAt: sysCustomer.created_at || '',
            source: 'sys_global',
            belongsToCurrentTenant: false,
            customerId: sysCustomer.id,
          };
        }
      });
      
      if (results.length > 0) {
        return {
          customers: results,
          total: results.length,
        };
      }
    }
    
    // Step 3: Search other tenants' org_customers_mst
    let otherTenantQuery = supabase
      .from('org_customers_mst')
      .select('id, customer_id, first_name, last_name, display_name, name, name2, phone, email, type, loyalty_points, created_at, tenant_org_id')
      .neq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .limit(limit);
    
    if (searchTerm.length > 0) {
      otherTenantQuery = otherTenantQuery.or(`phone.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }
    
    const { data: otherTenantData, error: otherTenantError } = await otherTenantQuery;
    
    if (!otherTenantError && otherTenantData && otherTenantData.length > 0) {
      const customers: CustomerListItem[] = otherTenantData.map((c) => ({
        id: c.id,
        customerNumber: c.id,
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
        createdAt: c.created_at || '',
        source: 'other_tenant',
        belongsToCurrentTenant: false,
        originalTenantId: c.tenant_org_id,
        customerId: c.customer_id || undefined,
        orgCustomerId: c.id,
      }));
      return {
        customers,
        total: customers.length,
      };
    }
  }

  // No results found
  return {
    customers: [],
    total: 0,
  };
}

/**
 * Link customer to current tenant (sys mode only).
 * When CONNECT_WITH_SYS_CUSTOMERS is false, linking is not supported.
 */
export async function linkCustomerToTenant(
  sourceCustomerId: string,
  sourceType: 'sys' | 'org_other_tenant',
  originalTenantId?: string
): Promise<{ orgCustomerId: string; customerId: string }> {
  if (!useSysCustomers()) {
    throw new Error('Linking customers to tenant is not supported when CONNECT_WITH_SYS_CUSTOMERS is false');
  }
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;

  if (sourceType === 'sys') {
    // Verify customer exists in sys_customers_mst
    const { data: sysCustomer, error: sysError } = await supabase
      .from('sys_customers_mst')
      .select('*')
      .eq('id', sourceCustomerId)
      .maybeSingle();

    if (sysError || !sysCustomer) {
      throw new Error('Customer not found in global database');
    }

    // Check if already linked to current tenant
    const { data: existingLink } = await supabase
      .from('org_customers_mst')
      .select('id')
      .eq('customer_id', sourceCustomerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();

    if (existingLink) {
      return {
        orgCustomerId: existingLink.id,
        customerId: sourceCustomerId,
      };
    }
    // Create org_customers_mst entry linking to sys customer
    const { data: newOrgCustomer, error: linkError } = await supabase
      .from('org_customers_mst')
      .insert({
        customer_id: sourceCustomerId,
        tenant_org_id: tenantId,
        name: sysCustomer.name,
        name2: sysCustomer.name2,
        first_name: sysCustomer.first_name,
        last_name: sysCustomer.last_name,
        display_name: sysCustomer.display_name || `${sysCustomer.first_name || ''} ${sysCustomer.last_name || ''}`.trim(),
        phone: sysCustomer.phone,
        email: sysCustomer.email,
        type: sysCustomer.type || 'walk_in',
        loyalty_points: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: curUserId,
        preferences: sysCustomer.preferences || {},
      })
      .select('id')
      .single();

    if (linkError || !newOrgCustomer) {
      logger.error('Error linking customer to tenant', linkError as Error, { feature: 'customers', action: 'link' });
      throw new Error('Failed to link customer to tenant');
    }

    return {
      orgCustomerId: newOrgCustomer.id,
      customerId: sourceCustomerId,
    };
  }

  if (sourceType === 'org_other_tenant') {
    if (!originalTenantId) {
      throw new Error('originalTenantId is required for org_other_tenant source type');
    }

    // Get source org record from other tenant
    const { data: sourceOrg, error: sourceError } = await supabase
      .from('org_customers_mst')
      .select('*')
      .eq('id', sourceCustomerId)
      .eq('tenant_org_id', originalTenantId)
      .maybeSingle();

    if (sourceError || !sourceOrg) {
      throw new Error('Customer not found in source tenant');
    }

    // Check if already linked (if source has customer_id)
    if (sourceOrg.customer_id) {
      const { data: existingLink } = await supabase
        .from('org_customers_mst')
        .select('id')
        .eq('customer_id', sourceOrg.customer_id)
        .eq('tenant_org_id', tenantId)
        .maybeSingle();

      if (existingLink) {
        return {
          orgCustomerId: existingLink.id,
          customerId: sourceOrg.customer_id,
        };
      }
    }

    // If source has customer_id, use it; otherwise create sys entry first
    let sysCustomerId = sourceOrg.customer_id;
    
    if (!sysCustomerId) {
      // Create sys_customers_mst entry from org data
      const { data: newSysCustomer, error: sysCreateError } = await supabase
        .from('sys_customers_mst')
        .insert({
          first_name: sourceOrg.first_name,
          last_name: sourceOrg.last_name,
          name: sourceOrg.name,
          name2: sourceOrg.name2,
          display_name: sourceOrg.display_name || `${sourceOrg.first_name || ''} ${sourceOrg.last_name || ''}`.trim(),
          phone: sourceOrg.phone,
          email: sourceOrg.email,
          type: sourceOrg.type || 'walk_in',
          preferences: sourceOrg.preferences || {},
          first_tenant_org_id: tenantId,
          created_at: new Date().toISOString(),
          created_by: curUserId,
          profile_status: 'guest',
          phone_verified: true,
          email_verified: true,
          avatar_url: null,
          customer_source_type: 'TENANT',
          customer_number: null,
          
        })
        .select('id')
        .single();

      if (sysCreateError || !newSysCustomer) {
        logger.error('Error creating sys customer', sysCreateError as Error, { feature: 'customers', action: 'link' });
        throw new Error('Failed to create global customer record');
      }

      sysCustomerId = newSysCustomer.id;
    }

    // Create org_customers_mst entry for current tenant
    const { data: newOrgCustomer, error: orgCreateError } = await supabase
      .from('org_customers_mst')
      .insert({
        customer_id: sysCustomerId,
        tenant_org_id: tenantId,
        name: sourceOrg.name,
        name2: sourceOrg.name2,
        first_name: sourceOrg.first_name,
        last_name: sourceOrg.last_name,
        display_name: sourceOrg.display_name || `${sourceOrg.first_name || ''} ${sourceOrg.last_name || ''}`.trim(),
        phone: sourceOrg.phone,
        email: sourceOrg.email,
        type: sourceOrg.type || 'walk_in',
        loyalty_points: 0,
        is_active: true,
        preferences: sourceOrg.preferences || {},
        created_at: new Date().toISOString(),
        created_by: curUserId,
        profile_status: 'guest',
        phone_verified: true,
        email_verified: true,
        avatar_url: null,
        customer_source_type: 'TENANT',
        customer_number: null,
      })
      .select('id')
      .single();

    if (orgCreateError || !newOrgCustomer) {
      logger.error('Error creating org customer', orgCreateError as Error, { feature: 'customers', action: 'link' });
      throw new Error('Failed to create tenant customer record');
    }

    return {
      orgCustomerId: newOrgCustomer.id,
      customerId: sysCustomerId,
    };
  }

  throw new Error('Invalid sourceType');
}

export async function searchCustomersAll(
  params: CustomerSearchParams
): Promise<{ customers: CustomerListItem[]; total: number }> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  if (!useSysCustomers()) {
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

  let query = supabase
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
 */
export async function updateCustomer(
  customerId: string,
  updates: CustomerUpdateRequest
): Promise<Customer> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;

  if (!useSysCustomers()) {
    const { data: orgRow, error } = await supabase
      .from('org_customers_mst')
      .update({
        first_name: updates.firstName,
        last_name: updates.lastName,
        name: updates.name ?? (updates.firstName + ' ' + (updates.lastName ?? '')).trim(),
        name2: updates.name2 ?? null,
        display_name: updates.displayName ?? (updates.firstName + ' ' + (updates.lastName ?? '')).trim(),
        email: updates.email ?? undefined,
        address: updates.address ?? undefined,
        area: updates.area ?? undefined,
        building: updates.building ?? undefined,
        floor: updates.floor ?? undefined,
        updated_at: new Date().toISOString(),
        updated_by: curUserId,
      })
      .eq('id', customerId)
      .eq('tenant_org_id', tenantId)
      .select()
      .single();
    if (error) {
      logger.error('Error updating customer', error as Error, { feature: 'customers', action: 'update' });
      throw new Error('Customer not found or access denied');
    }
    return mapFromOrgRow(orgRow as Record<string, unknown>, tenantId);
  }

  const { data: orgCustomerCheck } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  let sysCustomerId: string;
  let orgCustomerId: string;
  if (orgCustomerCheck) {
    orgCustomerId = orgCustomerCheck.id;
    sysCustomerId = orgCustomerCheck.customer_id ?? customerId;
  } else {
    const { data: link } = await supabase
      .from('org_customers_mst')
      .select('id, customer_id')
      .eq('customer_id', customerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();
    if (!link) {
      throw new Error('Customer not found or access denied');
    }
    orgCustomerId = link.id;
    sysCustomerId = customerId;
  }

  const { error: orgError } = await supabase
    .from('org_customers_mst')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      name: updates.name ?? (updates.firstName + ' ' + (updates.lastName ?? '')).trim(),
      name2: updates.name2,
      display_name: updates.displayName ?? (updates.firstName + ' ' + (updates.lastName ?? '')).trim(),
      email: updates.email,
      address: updates.address,
      area: updates.area,
      building: updates.building,
      floor: updates.floor,
      updated_at: new Date().toISOString(),
      updated_by: curUserId,
    })
    .eq('id', orgCustomerId)
    .eq('tenant_org_id', tenantId);
  if (orgError) {
    logger.error('Error updating customer', orgError as Error, { feature: 'customers', action: 'update' });
    throw new Error('Failed to update customer: ' + orgError.message);
  }

  const { data: customer, error } = await supabase
    .from('sys_customers_mst')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      name: updates.name ?? (updates.firstName + ' ' + (updates.lastName ?? '')).trim(),
      name2: updates.name2,
      display_name: updates.displayName ?? (updates.firstName + ' ' + (updates.lastName ?? '')).trim(),
      email: updates.email,
      address: updates.address,
      area: updates.area,
      building: updates.building,
      floor: updates.floor,
      updated_at: new Date().toISOString(),
      updated_by: curUserId,
    })
    .eq('id', sysCustomerId)
    .select()
    .single();
  if (error) {
    logger.error('Error updating customer', error as Error, { feature: 'customers', action: 'update' });
    throw new Error('Failed to update customer: ' + error.message);
  }
  return mapToCustomer(customer);
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

  if (!useSysCustomers()) {
    const { data: orgRow, error } = await supabase
      .from('org_customers_mst')
      .update({
        type: 'full',
        email: email ?? undefined,
        preferences: (preferences ?? {}) as Record<string, unknown>,
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

  const { data: customer } = await supabase
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

  const { data: upgraded, error } = await supabase
    .from('sys_customers_mst')
    .update({
      profile_status: 'full',
      type: 'full',
      email: email ?? customer.email,
      preferences: preferences ?? customer.preferences ?? {},
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

  if (!useSysCustomers()) {
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

  if (!useSysCustomers()) {
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

  const { data: customers } = await supabase
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
    address: row.address,
    area: row.area,
    building: row.building,
    floor: row.floor,
    firstTenantOrgId: row.first_tenant_org_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}
