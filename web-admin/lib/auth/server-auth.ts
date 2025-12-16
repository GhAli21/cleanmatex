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

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    tenantId: tenants[0].tenant_id as string,
    userId: user.id as string,
    userRole: tenants[0].user_role as string,
  };
}

