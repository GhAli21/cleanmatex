/**
 * Tenant Context Management
 *
 * Uses AsyncLocalStorage to store tenant ID in async context.
 * This allows Prisma middleware to access tenant ID synchronously
 * while tenant ID is retrieved asynchronously from session.
 *
 * @see https://nodejs.org/api/async_context.html
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage instance for tenant context
 */
const tenantContextStorage = new AsyncLocalStorage<string>();

/**
 * Get current tenant ID from async context
 * Returns null if not set (for sys_* tables or when tenant is not required)
 */
export function getTenantId(): string | null {
  return tenantContextStorage.getStore() ?? null;
}

/**
 * Run a function with tenant context
 * This should be called at the entry point of server actions/API routes
 *
 * @param tenantId - Tenant organization ID
 * @param fn - Function to execute with tenant context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * export async function listOrders(filters: unknown) {
 *   return withTenantContext(async (tenantId) => {
 *     // All Prisma queries here will automatically filter by tenantId
 *     return await listOrdersDb(tenantId, filters);
 *   });
 * }
 * ```
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (tenantId: string) => Promise<T>
): Promise<T> {
  return tenantContextStorage.run(tenantId, () => fn(tenantId));
}

/**
 * Run a function with tenant context (sync version)
 */
export function withTenantContextSync<T>(
  tenantId: string,
  fn: (tenantId: string) => T
): T {
  return tenantContextStorage.run(tenantId, () => fn(tenantId));
}

/**
 * Helper to get tenant ID from Supabase session
 * Use this in server actions/API routes to get tenant ID
 *
 * @returns Tenant ID or null if not authenticated/no tenant
 */
export async function getTenantIdFromSession(): Promise<string | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user.user_metadata?.tenant_org_id ?? null;
  } catch (error) {
    console.error('[getTenantIdFromSession] Error:', error);
    return null;
  }
}

/**
 * Wrapper for server actions that automatically sets tenant context
 * 
 * @example
 * ```typescript
 * export const listOrders = withTenantFromSession(async (tenantId, filters) => {
 *   return await listOrdersDb(tenantId, filters);
 * });
 * ```
 */
export function withTenantFromSession<TArgs extends any[], TReturn>(
  fn: (tenantId: string, ...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    const tenantId = await getTenantIdFromSession();
    
    if (!tenantId) {
      throw new Error(
        'Tenant ID is required. User must be authenticated and have tenant_org_id in metadata.'
      );
    }

    return withTenantContext(tenantId, (id) => fn(id, ...args));
  };
}

/**
 * Validate tenant access for a user
 * @param tenantId - Tenant ID to validate
 * @param userId - User ID
 * @returns True if user has access to tenant
 */
export async function validateTenantAccess(
  tenantId: string,
  userId: string
): Promise<boolean> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('org_users_mst')
      .select('tenant_org_id, is_active')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('[validateTenantAccess] Error:', error);
    return false;
  }
}

/**
 * Get tenant from request (extracts from various sources)
 * @param request - Next.js request object
 * @returns Tenant ID or null
 */
export async function getTenantFromRequest(
  request: Request
): Promise<string | null> {
  try {
    // Try to get from JWT/session first
    const tenantId = await getTenantIdFromSession();
    if (tenantId) {
      return tenantId;
    }

    // Try to get from headers (if set by middleware)
    const headerTenantId = request.headers.get('X-Tenant-ID');
    if (headerTenantId) {
      return headerTenantId;
    }

    return null;
  } catch (error) {
    console.error('[getTenantFromRequest] Error:', error);
    return null;
  }
}

/**
 * Ensure tenant context exists, throw error if not
 * @throws Error if tenant context is missing
 */
export async function ensureTenantContext(): Promise<string> {
  const tenantId = await getTenantIdFromSession();
  
  if (!tenantId) {
    throw new Error(
      'Tenant context is required. User must be authenticated and have tenant_org_id in metadata.'
    );
  }

  return tenantId;
}

/**
 * Wrapper with tenant validation
 * Validates tenant access before executing function
 */
export async function withTenantValidation<T>(
  tenantId: string,
  userId: string,
  fn: (tenantId: string) => Promise<T>
): Promise<T> {
  const isValid = await validateTenantAccess(tenantId, userId);
  
  if (!isValid) {
    throw new Error('User does not have access to this tenant');
  }

  return withTenantContext(tenantId, fn);
}

