/**
 * Server-side Authentication Helpers
 * 
 * Utilities for getting auth context in server components and server actions
 */

import { createClient } from '@/lib/supabase/server';

export interface AuthContext {
  user: {
    id: string;
    email?: string;
  };
  tenantId: string;
  userId: string;
  userRole: string;
}

/**
 * Get authenticated user and tenant context for server components
 *
 * Uses JWT user_metadata.tenant_org_id when available (matches client's selected tenant
 * after tenant switch). Falls back to first tenant from get_user_tenants otherwise.
 *
 * @returns Auth context with user and tenant information
 * @throws Error if user is not authenticated or has no tenant access
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  // Prefer JWT tenant_org_id (matches client's selected tenant after switch)
  const jwtTenantId = user.user_metadata?.tenant_org_id as string | undefined;
  const tenantFromRpc = tenants[0];
  const hasAccessToJwtTenant =
    jwtTenantId && tenants.some((t) => t.tenant_id === jwtTenantId);

  const tenantId = hasAccessToJwtTenant
    ? jwtTenantId
    : (tenantFromRpc.tenant_id as string);
  const tenantEntry =
    tenants.find((t) => t.tenant_id === tenantId) ?? tenantFromRpc;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    tenantId,
    userId: user.id as string,
    userRole: tenantEntry.user_role as string,
  };
}

