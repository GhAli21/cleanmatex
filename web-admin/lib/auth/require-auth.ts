/**
 * Minimal session guard for routes that need only "is there a valid user?",
 * with no permission or tenant requirement (public reference lookups,
 * internal diagnostics). For tenant-scoped or permission-gated routes, use
 * `requirePermission`/`requireTenantAuth` instead.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface RequireAuthResult {
  user: { id: string; email?: string };
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Returns the authenticated session token for an HQ proxy call.
 *
 * The browser sends the Supabase session through cookies, so local proxy routes
 * must recover the token server-side instead of falling back to a shared HQ token.
 *
 * @param supabase Authenticated server-side Supabase client from `requireAuth`.
 * @returns A bearer authorization header, or `null` when the verified user has no session.
 */
export async function getSessionAuthorizationHeader(
  supabase: RequireAuthResult["supabase"],
): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) return null;
  return `Bearer ${session.access_token}`;
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
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  return { user, supabase };
}
