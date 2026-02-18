/**
 * Request audit context utilities
 * Extract user-agent, IP, etc. from NextRequest for audit logging
 */

import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';

export interface RequestAuditContext {
  userAgent?: string;
  userIp?: string;
}

export interface ServerAuditContext {
  userId?: string;
  userName?: string;
  userAgent?: string;
  userIp?: string;
}

/**
 * Extract audit context from request headers
 */
export function getRequestAuditContext(
  request: NextRequest
): RequestAuditContext {
  return {
    userAgent: request.headers.get('user-agent') ?? undefined,
    userIp:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
  };
}

/**
 * Get audit context for server actions (uses headers() and Supabase auth).
 * Use in server actions where NextRequest is not available.
 */
export async function getServerAuditContext(): Promise<ServerAuditContext> {
  const headersList = await headers();
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userAgent = headersList.get('user-agent') ?? undefined;
  const userIp =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    undefined;

  return {
    userId: user?.id,
    userName: user?.email ?? user?.user_metadata?.name ?? user?.id,
    userAgent,
    userIp,
  };
}
