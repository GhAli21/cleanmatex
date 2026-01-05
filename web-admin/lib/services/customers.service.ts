/**
 * PRD-003: Customer Management Service
 * Core business logic for progressive customer engagement
 */

import { createClient } from '@/lib/supabase/server';
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
 * Normalize phone number to E.164 format
 * Examples:
 *   "+968 9012 3456" → "+96890123456"
 *   "90123456" → "+96890123456" (with default country code)
 *   "+968-90-12-34-56" → "+96890123456"
 */
export function normalizePhone(
  phone: string,
  defaultCountryCode: string = '+968'
): PhoneNormalizationResult {
  // Remove all spaces, hyphens, parentheses
  let normalized = phone.replace(/[\s\-\(\)]/g, '');

  // If doesn't start with +, add default country code
  if (!normalized.startsWith('+')) {
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
/**
 * Get tenant ID from current session
 */
async function getTenantIdFromSession(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized: No user');
  }
  console.log('Jh In getTenantIdFromSession(): user', user);
  const curUserId = user.id;
  const curUserRole = user.user_metadata?.role;
  const curUserTenantId = user.user_metadata?.tenant_id;
  console.log('Jh In getTenantIdFromSession(): curUserId', curUserId);
  // Get user's tenants using the same function as frontend
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  console.log('Jh In getTenantIdFromSession(): tenants', tenants);
  if (error || !tenants || tenants.length === 0) {
    throw new Error('Unauthorized: No tenant access found' + error?.message);
  }
  console.log('Jh In getTenantIdFromSession(): tenants[0].tenant_id', tenants[0].tenant_id);
  const curSessionAuth = tenants[0];
  // Return the first tenant (current tenant)
  return tenants[0].tenant_id;
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
    console.error('Error generating customer number:', error);
    throw new Error('Failed to generate customer number');
  }

  return data as string;
}

// ==================================================================
// CUSTOMER CRUD OPERATIONS
// ==================================================================

/**
 * Create a new customer (guest, stub, or full)
 */
export async function createCustomer(
  request: CustomerCreateRequest
): Promise<Customer> {
  const supabase = await createClient();
  //const tenantId = await getTenantIdFromSession();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;
  const curUserRole = session.userRole;
  console.log('Jh In createCustomer(): tenantId', tenantId);
  console.log('Jh In createCustomer(): curUserId', curUserId);
  console.log('Jh In createCustomer(): curUserRole', curUserRole);
  // Normalize phone if provided
  let normalizedPhone: string | null = null;
  if ('phone' in request && request.phone) {
    const phoneResult = normalizePhone(request.phone);
    if (!phoneResult.isValid) {
      throw new Error('Invalid phone number format');
    }
    normalizedPhone = phoneResult.normalized;

    // Check for duplicate phone in this tenant
    const { data: existing } = await supabase
      .from('sys_customers_mst')
      .select('id, first_name, phone')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing) {
      // Check if already linked to this tenant
      const { data: tenantLink } = await supabase
        .from('org_customers_mst')
        .select('customer_id')
        .eq('customer_id', existing.id)
        .eq('tenant_org_id', tenantId)
        .maybeSingle();

      if (tenantLink) {
        throw new Error(
          `Customer with phone ${maskPhone(normalizedPhone)} already exists`
        );
      }
    }
  }

  // Generate customer number
  const customerNumber = await generateCustomerNumber(tenantId);

  // Determine profile status based on type
  const profileStatus = request.type||'guest';

  // For full customers, OTP verification should be done before calling this
  const phoneVerified = request.type === 'full' && !!normalizedPhone;

  // Create customer in sys_customers_mst
  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .insert({
      first_name: request.firstName,
      last_name: 'lastName' in request ? request.lastName : null,
      name: request.name||request.firstName+' '+('lastName' in request && request.lastName),
      name2: request.name2,
      display_name: request.displayName||request.firstName+' '+('lastName' in request && request.lastName),
      phone: normalizedPhone,
      email: 'email' in request ? request.email : null,
      type: request.type,
      customer_number: customerNumber,
      profile_status: profileStatus,
      phone_verified: phoneVerified,
      email_verified: false,
      //preferences: 'preferences' in request ? request.preferences : {},
      first_tenant_org_id: tenantId,
      created_at: new Date().toISOString(),
      created_by: curUserId,
      customer_source_type: 'TENANT',
      
    })
    .select()
    .single();

  if (customerError) {
    console.error('Error creating customer:', customerError);
    throw new Error('Failed to create customer : '+customerError.message);
  }

  // Link customer to tenant in org_customers_mst
  const { error: linkError } = await supabase
    .from('org_customers_mst')
    .insert({
      customer_id: customer.id,
      tenant_org_id: tenantId,
      name: request.name,
      name2: request.name2,
      first_name: request.firstName,
      last_name: request.lastName,
      display_name: `${request.firstName} ${('lastName' in request && request.lastName) || ''}`.trim(),
      phone: normalizedPhone,
      email: 'email' in request ? request.email : null,
      type: request.type,
      loyalty_points: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: curUserId,
      customer_source_type: 'TENANT',
      //preferences: 'preferences' in request ? request.preferences : {},
    });

  if (linkError) {
    console.error('Error linking customer to tenant:', linkError);
    // Rollback: delete the customer
    await supabase.from('sys_customers_mst').delete().eq('id', customer.id);
    throw new Error('Failed to link customer to tenant : '+linkError.message);
  }

  // If full customer with addresses, create them
  if (request.type === 'full' && 'addresses' in request && request.addresses) {
    const addressesService = await import('./customer-addresses.service');
    for (const addressReq of request.addresses) {
      try {
        await addressesService.createAddress(customer.id, addressReq);
      } catch (error) {
        console.error('Error creating address:', error);
        // Continue with other addresses
      }
    }
  }

  return mapToCustomer(customer);
}

/**
 * Find customer by ID
 * Handles both sys_customers_mst.id and org_customers_mst.id
 */
export async function findCustomerById(
  customerId: string
): Promise<CustomerWithTenantData | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // First, check if this is an org_customers_mst.id
  const { data: orgCustomer, error: orgError } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id, tenant_org_id')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  // Determine the actual sys_customers_mst.id to use
  let sysCustomerId = customerId;
  if (orgCustomer && orgCustomer.customer_id) {
    // This is an org_customers_mst.id, use the linked customer_id
    sysCustomerId = orgCustomer.customer_id;
  }

  // Get customer with tenant data using sys_customers_mst.id
  const { data: customer, error } = await supabase
    .from('sys_customers_mst')
    .select(
      `
      *,
      org_customers_mst!inner(
        id,
        tenant_org_id,
        loyalty_points,
        created_at
      )
    `
    )
    .eq('id', sysCustomerId)
    .eq('org_customers_mst.tenant_org_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('Error finding customer:', error);
    return null;
  }

  if (!customer) {
    return null;
  }

  // Get order statistics using sys_customers_mst.id
  const { data: orderStats } = await supabase
    .from('org_orders_mst')
    .select('id, total, delivered_at')
    .eq('customer_id', sysCustomerId)
    .eq('tenant_org_id', tenantId);

  const totalOrders = orderStats?.length || 0;
  const totalSpent = orderStats?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
  const lastOrderAt = orderStats
    ?.filter((o) => o.delivered_at)
    .sort((a, b) => new Date(b.delivered_at!).getTime() - new Date(a.delivered_at!).getTime())[0]
    ?.delivered_at || null;

  return {
    ...mapToCustomer(customer),
    tenantData: {
      tenantOrgId: tenantId,
      loyaltyPoints: customer.org_customers_mst[0].loyalty_points || 0,
      totalOrders,
      totalSpent,
      lastOrderAt,
      joinedAt: customer.org_customers_mst[0].created_at || new Date().toISOString(),
    },
  };
}

/**
 * Find customer by phone number
 */
export async function findCustomerByPhone(
  phone: string
): Promise<Customer | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const phoneResult = normalizePhone(phone);
  if (!phoneResult.isValid) {
    throw new Error('Invalid phone number format');
  }

  const { data: customer, error } = await supabase
    .from('sys_customers_mst')
    .select(
      `
      *,
      org_customers_mst!inner(tenant_org_id)
    `
    )
    .eq('phone', phoneResult.normalized)
    .eq('org_customers_mst.tenant_org_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('Error finding customer by phone:', error);
    return null;
  }

  return customer ? mapToCustomer(customer) : null;
}

/**
 * Get all customers for a specific tenant (by tenant_org_id)
 */
export async function getAllCurrentTenantCustomers(
  tenantOrgId?: string | null
): Promise<{ customers: Customer[]; total: number }> { 
  const supabase = await createClient();
  const tenantId = tenantOrgId ?? (await getTenantIdFromSession());
  console.log('Jh In getAllTenantCustomers(): tenantId=', tenantId);
  const { data, error, count } = await supabase
  .from('org_customers_mst')
  .select('id, first_name, last_name, display_name, phone, email, type, loyalty_points, created_at', { count: 'exact' })
  //.eq('tenant_org_id', tenantId)
  .eq('is_active', true)
  //.limit(100)
  ;
  console.log('Jh In getAllCurrentTenantCustomers(): data.length =', data?.length);
  console.log('Jh In getAllCurrentTenantCustomers(): count=', count);
  if (error) {
    console.error('Error fetching tenant customers:', error);
    throw new Error('Failed to fetch tenant customers');
  }

  return {
    customers: (data || []).map((row) => mapToCustomer({...row, sys_customers_mst: row})),
    total: count || 0,
  };
}

/**
 * Get all customers for a specific tenant (by tenant_org_id)
 */
export async function getAllTenantCustomers(
  tenantOrgId?: string | null
): Promise<Customer[]> { 
  const supabase = await createClient();
  const tenantId = tenantOrgId ?? (await getTenantIdFromSession());
  console.log('Jh In getAllTenantCustomers(): tenantId=', tenantId);
  const { data, error } = await supabase
    .from('sys_customers_mst')
    .select(
      `
      *,
      org_customers_mst!inner(tenant_org_id)
    `
    )
    .eq('org_customers_mst.tenant_org_id', tenantId);

  if (error) {
    console.error('Error fetching tenant customers:', error);
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
  console.log('Jh In searchCustomers() [1]: start');
  
  const supabase = await createClient();
  console.log('Jh In searchCustomers() [2]: Before get tenant id');
  const tenantId = await getTenantIdFromSession();
  console.log('Jh In searchCustomers() [3]: After get tenant id=', tenantId);
  console.log('Jh In searchCustomers() [4]: Starting search with params:', { 
    search: params.search, 
    tenantId,
    page: params.page,
    limit: params.limit 
  });

  const page = params.page || 1;
  console.log('Jh In searchCustomers() [5]: page', page);
  const limit = params.limit || 100;
  console.log('Jh In searchCustomers() [6]: limit', limit);
  const offset = (page - 1) * limit;

  // Build query on org_customers_mst (tenant-scoped table)
  console.log('Jh In searchCustomers() [7]: Before build query');
  let query = supabase
    .from('org_customers_mst')
    .select('id, first_name, last_name, display_name, phone, email, type, loyalty_points, created_at', { count: 'exact' })
    //.eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    ;
  console.log('Jh In searchCustomers() [8]: After build query');

  
  // Apply search filter at database level using ILIKE for case-insensitive search
  // PostgREST uses * for wildcards, not %
  if (params.search && params.search.trim().length > 0) {
    const searchTerm = params.search.trim();
    console.log('Jh In searchCustomers() [9]: searchTerm', searchTerm);
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

    console.log('Jh In searchCustomers() [10.1]: orFilter', orFilter);
    // .or() only takes one parameter - a comma-separated string of conditions
    query = query.or(orFilter);
    
    console.log('Jh In searchCustomers() [10]: After apply search filter');
  }
  
  /*
  // Apply type filter if provided
  if (params.type) {
    console.log('Jh In searchCustomers() [11]: type', params.type);
    query = query.eq('type', params.type);
    console.log('Jh In searchCustomers() [12]: After apply type filter');
  }
  */
  /*
  // Apply status filter
  /*
  if (params.status === 'active') {
    console.log('Jh In searchCustomers() [13]: status active');
    query = query.eq('is_active', true);
    console.log('Jh In searchCustomers() [14]: After apply status filter active');
  } else if (params.status === 'inactive') {
    query = query.eq('is_active', false);
    console.log('Jh In searchCustomers() [15]: After apply status filter inactive');
  }
  */
  /*
  // Apply sorting
  /*
  const sortBy = params.sortBy || 'createdAt';
  console.log('Jh In searchCustomers() [16]: sortBy', sortBy);
  const sortOrder = params.sortOrder || 'desc';
  console.log('Jh In searchCustomers() [17]: sortOrder', sortOrder);
  */
  /*
  if (sortBy === 'name') {
    console.log('Jh In searchCustomers() [18]: sortBy name');
    query = query.order('first_name', { ascending: sortOrder === 'asc' });
    console.log('Jh In searchCustomers() [19]: After apply sort by name');
  } else if (sortBy === 'createdAt') {
    query = query.order('created_at', { ascending: sortOrder === 'asc' });
    console.log('Jh In searchCustomers() [20]: After apply sort by createdAt');
  }
  */
  console.log('Jh In searchCustomers() [21]: Before apply pagination');
  // Apply pagination at database level
  query = query.range(offset, offset + limit - 1);
  console.log('Jh In searchCustomers() [22]: After apply pagination');
  
  console.log('Jh In searchCustomers() [23]: Before execute query');
  //console.log('Jh In searchCustomers() [23.2]: query', query.toSQL()); 
  const { data, error, count } = await query;
  
  console.log('Jh In searchCustomers() [24]: After execute query');

  if (error) {
    console.error('Jh In searchCustomers() [23]: Database error', error);
    console.error('[searchCustomers] Database error:', error);
    throw new Error(`Failed to search customers: ${error.message}`);
  }

  console.log('Jh In searchCustomers() [25]: Query result:', { 
    count: count || 0, 
    dataLength: data?.length || 0,
    searchTerm: params.search 
  });

  // Map to CustomerListItem format
  console.log('Jh In searchCustomers() [26]: Before map to CustomerListItem count=', data?.length);
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
  console.log('Jh In searchCustomers() [28]: After map to CustomerListItem');
  //console.log('Jh In searchCustomers() [29]: customers', JSON.stringify(customers, null, 2));
  
  console.log('Jh In searchCustomers() [30]: Before return');
  console.log('Jh In searchCustomers() [31]: total', count || 0);
  
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
  params: CustomerSearchParams & { searchAllOptions?: boolean }
): Promise<{ customers: CustomerListItem[]; total: number }> {
  const supabase = await createClient();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const searchAllOptions = params.searchAllOptions ?? false;
  const searchTerm = params.search?.trim() || '';
  const limit = params.limit || 100;

  // Step 1: Search current tenant's org_customers_mst
  let query = supabase
    .from('org_customers_mst')
    .select('id, customer_id, first_name, last_name, display_name, name, name2, phone, email, type, loyalty_points, created_at, tenant_org_id', { count: 'exact' })
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true);
  
  if (searchTerm.length > 0) {
    query = query.or(`phone.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }
  
  query = query.limit(limit);
  const { data: currentTenantData, error: currentTenantError, count: currentTenantCount } = await query;
  
  if (currentTenantError) {
    console.error('Error searching current tenant customers:', currentTenantError);
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
 * Link customer to current tenant
 * Supports linking from sys_customers_mst (global) or org_customers_mst (other tenant)
 */
export async function linkCustomerToTenant(
  sourceCustomerId: string,
  sourceType: 'sys' | 'org_other_tenant',
  originalTenantId?: string
): Promise<{ orgCustomerId: string; customerId: string }> {
  const supabase = await createClient();
  //const tenantId = await getTenantIdFromSession();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;
  const curUserRole = session.userRole;
  console.log('Jh In linkCustomerToTenant(): tenantId', tenantId);
  console.log('Jh In linkCustomerToTenant(): curUserId', curUserId);
  console.log('Jh In linkCustomerToTenant(): curUserRole', curUserRole);
  

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
      console.log('Jh In linkCustomerToTenant(): Already linked to current tenant');
      return {
        orgCustomerId: existingLink.id,
        customerId: sourceCustomerId,
      };
    }
    console.log('Jh In linkCustomerToTenant(): Not linked to current tenant');
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
      console.error('Error linking customer to tenant:', linkError);
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
        console.error('Error creating sys customer:', sysCreateError);
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
      console.error('Error creating org customer:', orgCreateError);
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
  console.log('Jh In searchCustomers(): params', JSON.stringify(params, null, 2));
  console.log('Jh In searchCustomers(): Before get tenant id');
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  console.log('Jh In searchCustomers(): After get tenant id');
  console.log('Jh In searchCustomers(): tenantId', tenantId);


  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('sys_customers_mst')
    .select(
      `
      *,
      org_customers_mst!inner(
        tenant_org_id,
        loyalty_points,
        is_active
      )
    `,
      { count: 'exact' }
    )
    .eq('org_customers_mst.tenant_org_id', tenantId);

  console.log('Jh In searchCustomers(): After build query');
  // Apply filters
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    query = query.or(
      `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm},customer_number.ilike.${searchTerm}`
    );
  }
  console.log('Jh In searchCustomers(): After apply search');
  if (params.type) {
    query = query.eq('type', params.type);
  }

  if (params.status === 'active') {
    query = query.eq('org_customers_mst.is_active', true);
  } else if (params.status === 'inactive') {
    query = query.eq('org_customers_mst.is_active', false);
  }

  // Apply sorting
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';

  if (sortBy === 'name') {
    query = query.order('first_name', { ascending: sortOrder === 'asc' });
  } else if (sortBy === 'createdAt') {
    query = query.order('created_at', { ascending: sortOrder === 'asc' });
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error searching customers:', error);
    throw new Error('Failed to search customers');
  }

  // Get order counts for each customer
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
 * Update customer profile
 * Handles both sys_customers_mst.id and org_customers_mst.id
 */
export async function updateCustomer(
  customerId: string,
  updates: CustomerUpdateRequest
): Promise<Customer> {
  const supabase = await createClient();
  //const tenantId = await getTenantIdFromSession();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;
  const curUserRole = session.userRole;
  console.log('Jh In updateCustomerProfile(): tenantId', tenantId);
  console.log('Jh In updateCustomerProfile(): curUserId', curUserId);
  console.log('Jh In updateCustomerProfile(): curUserRole', curUserRole);
  
  // First, check if this is an org_customers_mst.id
  const { data: orgCustomerCheck } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  let sysCustomerId: string;
  let orgCustomerId: string;

  if (orgCustomerCheck) {
    // This is an org_customers_mst.id
    orgCustomerId = orgCustomerCheck.id;
    sysCustomerId = orgCustomerCheck.customer_id || customerId;
  } else {
    // This might be a sys_customers_mst.id, verify it belongs to this tenant
    const { data: link } = await supabase
      .from('org_customers_mst')
      .select('id, customer_id')
      .eq('customer_id', customerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();

    if (!link) {
      throw new Error('Customer not found or access denied customerId: '+customerId);
    }

    orgCustomerId = link.id;
    sysCustomerId = customerId;
  }
  const { data: orgCustomer, error: orgError } = await supabase
    .from('org_customers_mst')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      name: updates.name||updates.firstName+' '+updates.lastName,
      name2: updates.name2,
      display_name: updates.displayName||updates.firstName+' '+updates.lastName,
      email: updates.email,
      address: updates.address,
      area: updates.area,
      building: updates.building,
      floor: updates.floor,
      //preferences: updates.preferences as unknown as unknown as Record<string, any>,
      updated_at: new Date().toISOString(),
      updated_by: curUserId,
    })
    .eq('id', orgCustomerId)
    .eq('tenant_org_id', tenantId)
    .select('id')
    .single();

  if (orgError) {
    console.error('Error updating customer:', orgError);
    throw new Error('Failed to update customer : '+orgError.message);
  }

  const { data: customer, error } = await supabase
    .from('sys_customers_mst')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      name: updates.name||updates.firstName+' '+updates.lastName,
      name2: updates.name2,
      display_name: updates.displayName||updates.firstName+' '+updates.lastName,
      email: updates.email,
      address: updates.address,
      area: updates.area,
      building: updates.building,
      floor: updates.floor,
      //preferences: updates.preferences as unknown as unknown as Record<string, any>,
      updated_at: new Date().toISOString(),
      updated_by: curUserId,
    })
    .eq('id', sysCustomerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer:', error);
    throw new Error('Failed to update customer : '+error.message);
  }

  return mapToCustomer(customer);
}

/**
 * Upgrade stub customer to full profile
 */
export async function upgradeCustomerProfile(
  customerId: string,
  email?: string,
  preferences?: any
): Promise<Customer> {
  const supabase = await createClient();
  //const tenantId = await getTenantIdFromSession();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;
  const curUserRole = session.userRole;
  console.log('Jh In upgradeCustomerProfile(): tenantId', tenantId);
  console.log('Jh In upgradeCustomerProfile(): curUserId', curUserId);
  console.log('Jh In upgradeCustomerProfile(): curUserRole', curUserRole);
  

  // Verify customer belongs to this tenant and is stub
  const { data: customer } = await supabase
    .from('sys_customers_mst')
    .select('*, org_customers_mst!inner(tenant_org_id)')
    .eq('id', customerId)
    .eq('org_customers_mst.tenant_org_id', tenantId)
    .maybeSingle();

  if (!customer) { 
    throw new Error('Customer not found or access denied customerId: '+customerId);
  }

  if (customer.profile_status === 'full') {
    throw new Error('Customer is already a full profile customerId: '+customerId);
  }

  const { data: upgraded, error } = await supabase
    .from('sys_customers_mst')
    .update({
      profile_status: 'full',
      type: 'full',
      email,
      preferences: preferences || customer.preferences,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single();

  if (error) {
    console.error('Error upgrading customer:', error);
    throw new Error('Failed to upgrade customer profile customerId: '+customerId);
  }

  return mapToCustomer(upgraded);
}

/**
 * Merge duplicate customers (Admin only)
 */
export async function mergeCustomers(
  request: MergeCustomersRequest
): Promise<{
  targetCustomer: Customer;
  ordersMoved: number;
  loyaltyPointsMerged: number;
}> {
  const supabase = await createClient();
  //const tenantId = await getTenantIdFromSession();
  const session = await getCurrentUserTenantSessionContext();
  const tenantId = session.userTenantOrgId;
  const curUserId = session.userId;
  const curUserRole = session.userRole;
  console.log('Jh In mergeCustomers(): tenantId', tenantId);
  console.log('Jh In mergeCustomers(): curUserId', curUserId);
  console.log('Jh In mergeCustomers(): curUserRole', curUserRole);
  
  const { sourceCustomerId, targetCustomerId, reason } = request;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized customerId: '+sourceCustomerId);
  }

  // Verify both customers belong to this tenant
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
    throw new Error('One or both customers not found customerId: '+sourceCustomerId);
  }

  // Move all orders from source to target
  const { error: ordersError } = await supabase
    .from('org_orders_mst')
    .update({ customer_id: targetCustomerId })
    .eq('customer_id', sourceCustomerId)
    .eq('tenant_org_id', tenantId);

  if (ordersError) {
    console.error('Error moving orders:', ordersError);
    throw new Error('Failed to move orders customerId: '+sourceCustomerId);
  }

  // Count moved orders
  const { count: ordersMoved } = await supabase
    .from('org_orders_mst')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', targetCustomerId)
    .eq('tenant_org_id', tenantId);

  // Merge loyalty points
  const loyaltyPointsMerged = sourceLink.loyalty_points || 0;
  const { error: pointsError } = await supabase
    .from('org_customers_mst')
    .update({
      loyalty_points: (targetLink.loyalty_points || 0) + loyaltyPointsMerged,
    })
    .eq('customer_id', targetCustomerId)
    .eq('tenant_org_id', tenantId);

  if (pointsError) {
    console.error('Error merging loyalty points:', pointsError);
  }

  // Deactivate source customer
  await supabase
    .from('org_customers_mst')
    .update({ is_active: false })
    .eq('customer_id', sourceCustomerId)
    .eq('tenant_org_id', tenantId);

  // Log the merge
  await supabase.from('org_customer_merge_log').insert({
    tenant_org_id: tenantId,
    source_customer_id: sourceCustomerId,
    target_customer_id: targetCustomerId,
    merged_by: user.id,
    merge_reason: reason,
    orders_moved: ordersMoved || 0,
    loyalty_points_merged: loyaltyPointsMerged,
  });

  // Get updated target customer
  const targetCustomer = await findCustomerById(targetCustomerId);

  return {
    targetCustomer: targetCustomer!,
    ordersMoved: ordersMoved || 0,
    loyaltyPointsMerged,
  };
}

/**
 * Deactivate customer (soft delete)
 */
export async function deactivateCustomer(customerId: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { error } = await supabase
    .from('org_customers_mst')
    .update({ is_active: false })
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId);

  if (error) {
    console.error('Error deactivating customer:', error);
    throw new Error('Failed to deactivate customer customerId: '+customerId);
  }
}

/**
 * Get customer statistics
 */
export async function getCustomerStatistics(): Promise<CustomerStatistics> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  const { data: customers } = await supabase
    .from('sys_customers_mst')
    .select(
      `
      id,
      type,
      created_at,
      org_customers_mst!inner(tenant_org_id, is_active)
    `
    )
    .eq('org_customers_mst.tenant_org_id', tenantId);

  const total = customers?.length || 0;
  const byType = {
    guest: customers?.filter((c) => c.type === 'guest').length || 0,
    stub: customers?.filter((c) => c.type === 'stub').length || 0,
    full: customers?.filter((c) => c.type === 'full').length || 0,
  };

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth =
    customers?.filter((c) => c.created_at && new Date(c.created_at) >= firstDayOfMonth).length || 0;

  const active = customers?.filter((c) => c.org_customers_mst[0]?.is_active).length || 0;
  const inactive = total - active;

  return {
    total,
    byType,
    newThisMonth,
    active,
    inactive,
  };
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
    displayName: row.disply_name,
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
