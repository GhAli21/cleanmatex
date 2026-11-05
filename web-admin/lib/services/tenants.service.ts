/**
 * PRD-002: Tenant Registration Service
 * Handles tenant onboarding, profile management, and slug generation
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import type { Json } from '@/types/database';
import type {
  Tenant,
  TenantRegistrationRequest,
  TenantRegistrationResponse,
  TenantUpdateRequest,
  SlugValidationResult,
} from '@/lib/types/tenant';

// ========================
// Signup lifecycle (decision A-31, migration 0678)
// ========================

/**
 * Tenant status while signup is still running. Only a tenant in this status can
 * be hard-deleted (DB trigger trg_tenant_hard_delete_guard), and the same
 * trigger removes its document counters first. 'creating' is insert-only:
 * no update can move a tenant back to it.
 */
export const TENANT_SIGNUP_STATUS = 'creating';

/** Status a tenant gets once signup has finished. */
export const TENANT_TRIAL_STATUS = 'trial';

// ========================
// Slug Generation & Validation
// ========================

/**
 * Generate a URL-friendly slug from business name
 * @param name - Business name
 * @returns Slugified string
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Check if slug is available (not taken by another tenant)
 * @param slug - Proposed slug
 * @param excludeTenantId - Optional tenant ID to exclude from check (for updates)
 * @returns Validation result with availability and suggestions
 */
export async function validateSlug(
  slug: string,
  excludeTenantId?: string
): Promise<SlugValidationResult> {
  const errors: string[] = [];
  
  // Reserved slugs
  const reservedSlugs = ['admin', 'api', 'dashboard', 'login', 'register', 'auth'];
  if (reservedSlugs.includes(slug)) {
    errors.push('This slug is reserved');
  }
  
  // Length validation
  if (slug.length < 3) {
    errors.push('Slug must be between 3 and 63 characters');
  } else if (slug.length > 63) {
    errors.push('Slug must be between 3 and 63 characters');
  }
  
  // Format validation
  if (!/^[a-z0-9-]+$/.test(slug)) {
    if (/[A-Z]/.test(slug)) {
      errors.push('Slug must be lowercase');
    } else {
      errors.push('Slug can only contain letters, numbers, and hyphens');
    }
  }
  
  // Hyphen validation
  if (slug.startsWith('-') || slug.endsWith('-')) {
    errors.push('Slug cannot start or end with a hyphen');
  }
  
  // If there are validation errors, return them
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }
  
  // Check availability in database
  const supabase = await createClient();
  let query = supabase
    .from('org_tenants_mst')
    .select('slug')
    .eq('slug', slug);

  if (excludeTenantId) {
    query = query.neq('id', excludeTenantId);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = No rows returned (slug available)
    console.error('Error checking slug availability:', error);
    throw new Error('Failed to validate slug');
  }

  const isAvailable = !data;

  if (isAvailable) {
    return { isValid: true };
  }

  // Suggest alternative slugs if taken
  const suggestedSlug = await findAvailableSlug(slug);
  return {
    isValid: false,
    errors: ['Slug is already taken'],
    suggestedSlug,
  };
}

/**
 * Find an available slug by appending numbers
 * @param baseSlug - Base slug to start from
 * @returns Available slug
 */
export async function findAvailableSlug(baseSlug: string): Promise<string> {
  const supabase = await createClient();
  
  // First check if the base slug is available
  const { data: baseData } = await supabase
    .from('org_tenants_mst')
    .select('slug')
    .eq('slug', baseSlug)
    .single();

  if (!baseData) {
    return baseSlug;
  }

  // If base slug is taken, try with numbers
  let counter = 2;
  let found = false;
  let suggestedSlug = baseSlug;

  while (!found && counter < 100) {
    suggestedSlug = `${baseSlug}-${counter}`;
    const { data } = await supabase
      .from('org_tenants_mst')
      .select('slug')
      .eq('slug', suggestedSlug)
      .single();

    if (!data) {
      found = true;
    } else {
      counter++;
    }
  }

  return suggestedSlug;
}

// ========================
// Tenant Registration
// ========================

/**
 * Register a new tenant with trial subscription
 * Creates: Tenant → Subscription → Admin User → Links them together
 * @param request - Registration details
 * @returns Registration response with tenant, subscription, user, and access token
 */
export async function registerTenant(
  request: TenantRegistrationRequest
): Promise<TenantRegistrationResponse> {
  const supabase = await createClient();

  // Step 1: Validate slug availability
  const slugValidation = await validateSlug(request.slug);
  if (!slugValidation.isValid) {
    throw new Error(
      `Slug "${request.slug}" is already taken. Try "${slugValidation.suggestedSlug}"`
    );
  }

  // Step 2: Check email uniqueness
  const { data: existingTenant } = await supabase
    .from('org_tenants_mst')
    .select('email')
    .eq('email', request.email)
    .single();

  if (existingTenant) {
    throw new Error('Email is already registered');
  }

  // Step 3: Calculate trial end date (14 days from now)
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  try {
    // Start transaction-like operation
    // Note: Supabase doesn't support transactions in client, so we'll handle rollback manually if needed

    // Step 4: Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('org_tenants_mst')
      .insert({
        name: request.businessName,
        name2: request.businessNameAr || null,
        slug: request.slug,
        email: request.email,
        phone: request.phone,
        country: request.country,
        currency: request.currency,
        timezone: request.timezone,
        language: request.language,
        s_cureent_plan: 'free',
        // 'creating' until signup finishes, so a failed signup can roll the tenant back (A-31).
        status: TENANT_SIGNUP_STATUS,
        is_active: true,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('Error creating tenant:', tenantError);
      throw new Error('Failed to create tenant');
    }

    // Step 5: Create subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days initial period

    const { data: subscription, error: subscriptionError } = await supabase
      .from('org_pln_subscriptions_mst')
      .insert({
        tenant_org_id: tenant.id,
        plan_code: 'free',
        status: 'trial',
        base_price: 0,
        // Required by 0535 (no column default): the subscription bills in the tenant's own currency.
        currency: request.currency,
        current_period_start: new Date().toISOString(),
        current_period_end: endDate.toISOString(),
        trial_end: trialEnds.toISOString(),
      })
      .select()
      .single();

    if (subscriptionError || !subscription) {
      console.error('Error creating subscription:', subscriptionError);
      // Rollback: delete the 'creating' tenant (the DB trigger removes its counters first)
      await rollbackSignupTenant(supabase, tenant.id);
      throw new Error('Failed to create subscription');
    }

    // Step 6: Create admin user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: request.adminUser.email,
      password: request.adminUser.password,
      options: {
        data: {
          display_name: request.adminUser.displayName,
          tenant_org_id: tenant.id,
          role: 'admin',
        },
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating admin user:', authError);
      // Rollback: Delete subscription and tenant
      await supabase
        .from('org_pln_subscriptions_mst')
        .delete()
        .eq('id', subscription.id);
      await rollbackSignupTenant(supabase, tenant.id);
      throw new Error('Failed to create admin user');
    }

    // Step 6b: Signup finished: leave 'creating' (from now on the tenant can never be hard-deleted).
    const finalStatus = await finishSignupTenant(supabase, tenant.id);

    // Step 7: Send welcome email (TODO: Implement email service)
    // await sendWelcomeEmail(tenant, authData.user);

    // Step 8: Return registration response
    return {
      tenant: { ...tenant, status: finalStatus } as unknown as Tenant,
      subscription: subscription as unknown as TenantRegistrationResponse['subscription'],
      user: {
        id: authData.user.id,
        email: authData.user.email || request.adminUser.email,
        role: 'admin',
      },
      accessToken: authData.session?.access_token || '',
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Hard-deletes a tenant whose signup failed. The DB allows this only while the
 * tenant is 'creating' (0678) and deletes its document counters in the same
 * statement. A refusal is logged, not thrown, so the original signup error is
 * what the caller sees.
 * @param supabase server client used by the signup
 * @param tenantId tenant created by the failed signup
 */
async function rollbackSignupTenant(supabase: ServerSupabase, tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('org_tenants_mst')
    .delete()
    .eq('id', tenantId)
    .eq('status', TENANT_SIGNUP_STATUS);
  if (error) {
    console.error('Error rolling back signup tenant (TENANT_HARD_DELETE_BLOCKED?):', error);
  }
}

/**
 * Moves a tenant from 'creating' to 'trial' at the end of signup.
 * A failure does not undo the signup (the subscription and admin user exist);
 * it is logged so HQ can set the status (leaving 'creating' is always allowed).
 * @param supabase server client used by the signup
 * @param tenantId tenant created by the signup
 * @returns the status the tenant has now
 */
async function finishSignupTenant(supabase: ServerSupabase, tenantId: string): Promise<string> {
  const { data, error } = await supabase
    .from('org_tenants_mst')
    .update({ status: TENANT_TRIAL_STATUS })
    .eq('id', tenantId)
    .eq('status', TENANT_SIGNUP_STATUS)
    .select('id');
  // RLS can filter the row without an error: check that it really changed.
  if (error || !data || data.length !== 1) {
    console.error(`Tenant ${tenantId} is still '${TENANT_SIGNUP_STATUS}' after signup; set it to '${TENANT_TRIAL_STATUS}' from HQ:`, error ?? 'no row updated');
    return TENANT_SIGNUP_STATUS;
  }
  return TENANT_TRIAL_STATUS;
}

// ========================
// Tenant Management
// ========================

/**
 * Get tenant details by ID
 * @param tenantId - Tenant ID
 * @returns Tenant object
 */
export async function getTenant(tenantId: string): Promise<Tenant> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('org_tenants_mst')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    throw new Error('Tenant not found' + error?.message);
  }
  //console.log('Herrrrrrrr Jh data', data);
  return data as unknown as Tenant;
}
/**
 * Get current tenant from session context
 * @returns Current tenant
 */
export async function getCurrentTenant(): Promise<Tenant> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized');
  }
  return getTenant(tenantId);
}

/**
 * Update tenant profile
 * @param tenantId - Tenant ID
 * @param updates - Fields to update
 * @returns Updated tenant
 */
export async function updateTenant(
  tenantId: string,
  updates: TenantUpdateRequest
): Promise<Tenant> {
  const supabase = await createClient();

  const { business_hours: businessHours, ...rest } = updates;
  const payload: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };
  if (businessHours !== undefined) {
    payload.business_hours = businessHours as unknown as Json;
  }

  const { data, error } = await supabase
    .from('org_tenants_mst')
    .update(payload)
    .eq('id', tenantId)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating tenant:', error);
    throw new Error('Failed to update tenant');
  }

  return data as unknown as Tenant;
}

/**
 * Upload tenant logo
 * @param tenantId - Tenant ID
 * @param file - Logo file
 * @returns Logo URL
 */
export async function uploadLogo(
  tenantId: string,
  file: File
): Promise<string> {
  const supabase = await createClient();

  // Validate file
  const maxSize = 2 * 1024 * 1024; // 2MB
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];

  if (file.size > maxSize) {
    throw new Error('File size exceeds 2MB limit');
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only PNG, JPG, and SVG are allowed');
  }

  // Generate unique filename
  const ext = file.name.split('.').pop();
  const filename = `${tenantId}/logo-${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('tenant-assets')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error uploading logo:', uploadError);
    throw new Error('Failed to upload logo');
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('tenant-assets').getPublicUrl(filename);

  // Update tenant with logo URL
  await updateTenant(tenantId, { logo_url: publicUrl } as TenantUpdateRequest);

  return publicUrl;
}

/**
 * Deactivate tenant (soft delete)
 * @param tenantId - Tenant ID
 * @param reason - Deactivation reason
 */
export async function deactivateTenant(
  tenantId: string,
  reason?: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('org_tenants_mst')
    .update({
      is_active: false,
      status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    console.error('Error deactivating tenant:', error);
    throw new Error('Failed to deactivate tenant');
  }

  // Also cancel subscription
  await supabase
    .from('org_pln_subscriptions_mst')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || 'Tenant deactivated',
    })
    .eq('tenant_org_id', tenantId);
}

/**
 * List all tenants (admin only)
 * @param filters - Optional filters
 * @param filters.status
 * @param filters.plan
 * @param filters.search
 * @param filters.page
 * @param filters.limit
 * @returns List of tenants
 */
export async function listTenants(filters?: {
  status?: string;
  plan?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ tenants: Tenant[]; total: number }> {
  const supabase = await createClient();

  // Widen query builder: chained filters can hit TS2589 (excessively deep instantiation).
   
  let query: any = supabase
    .from('org_tenants_mst')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.plan) {
    query = query.eq('s_cureent_plan', filters.plan);
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`
    );
  }

  // Pagination
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing tenants:', error);
    throw new Error('Failed to list tenants');
  }

  return {
    tenants: ((data ?? []) as unknown as Tenant[]) || [],
    total: count || 0,
  };
}
