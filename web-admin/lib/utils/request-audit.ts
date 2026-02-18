/**
 * Request audit context utilities
 * Extract user-agent, IP, etc. from NextRequest for audit logging
 */

import type { NextRequest } from 'next/server';

export interface RequestAuditContext {
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
