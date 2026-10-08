/**
 * Server-side Authentication Helpers
 * 
 * Utilities for getting auth context in server components and server actions
 */

import { createClient } from '@/lib/supabase/server';
import { guardSession, isSessionActive } from '@/lib/auth/session-guard';
import { getCurrentRequestMeta } from '@/lib/services/auth/session/request-meta.server';

/**
 *
 */
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
 * Tenant = the tenant the validated session is bound to (server-side, membership-based; one account per
 * tenant, no tenant switching). user_metadata is never trusted. The role comes from get_user_tenants.
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

  const validation = await guardSession(supabase, await getCurrentRequestMeta());
  if (!isSessionActive(validation) || !validation.tenantOrgId) {
    throw new Error('Unauthorized');
  }

  // A pending forced password change blocks server actions too (pages are blocked by the proxy).
  if (validation.mustChangePassword) {
    throw new Error('Password change required')
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  const tenantId = validation.tenantOrgId;
  const tenantEntry = tenants.find((t) => t.tenant_id === tenantId) ?? tenants[0];

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

