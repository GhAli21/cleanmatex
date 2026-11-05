/**
 * Minimal session guard for routes that need only "is there a valid user?",
 * with no permission or tenant requirement (public reference lookups,
 * internal diagnostics). For tenant-scoped or permission-gated routes, use
 * `requirePermission`/`requireTenantAuth` instead.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface RequireAuthResult {
  user: { id: string; email?: string };
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Resolves the authenticated user from the session, or a 401 response.
 */
export async function requireAuth(): Promise<RequireAuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return { user, supabase };
}
