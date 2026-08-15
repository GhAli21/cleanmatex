import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, type AuthContext } from '@/lib/middleware/require-permission';
import { createBearerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { isValidUUID } from '@/lib/utils/validation-helpers';

// PostgreSQL accepts UUID-shaped legacy IDs that do not encode an RFC version.
const tenantIdSchema = z.string().refine(isValidUUID, 'Invalid tenant UUID.');

/** Authentication mode used to resolve an API actor. */
export type ApiRequestAuthMode = 'session' | 'bearer';

/** Authenticated tenant actor passed into a tenant-scoped application service. */
export interface ApiRequestAuthContext {
  tenantId: string;
  userId: string;
  userName: string;
  mode: ApiRequestAuthMode;
}

function invalidBearerResponse(): NextResponse {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', error: 'Invalid bearer token.' },
    { status: 401 },
  );
}

function forbiddenResponse(permission: string): NextResponse {
  return NextResponse.json(
    { success: false, code: 'PERMISSION_DENIED', error: `Permission denied: ${permission}` },
    { status: 403 },
  );
}

function readBearerToken(request: NextRequest): string | null | undefined {
  const authorization = request.headers.get('authorization');
  if (authorization === null) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

/** Returns true when the request explicitly chooses bearer-token authentication. */
export function usesBearerAuthentication(request: NextRequest): boolean {
  return request.headers.has('authorization');
}

/**
 * Resolves an authenticated actor and checks a tenant-scoped permission.
 *
 * Session calls retain the repository's cookie/RLS permission path. Bearer calls
 * use a request-scoped Supabase client so mobile and integration clients can
 * execute the same RPC permission guard without a browser CSRF cookie.
 */
export async function requireRequestPermission(
  request: NextRequest,
  permission: string,
): Promise<ApiRequestAuthContext | NextResponse> {
  const bearerToken = readBearerToken(request);
  if (bearerToken === undefined) {
    const sessionAuth = await requirePermission(permission)(request);
    if (sessionAuth instanceof NextResponse) return sessionAuth;
    return sessionAuthToApiContext(sessionAuth);
  }
  if (bearerToken === null) return invalidBearerResponse();

  const supabase = createBearerSupabaseClient(bearerToken);
  const { data: userData, error: userError } = await supabase.auth.getUser(bearerToken);
  const user = userData.user;
  if (userError || !user) {
    logger.warn('Bearer API authentication failed', {
      feature: 'api_auth',
      action: 'authenticate_bearer',
      reason: userError?.message ?? 'user_missing',
    });
    return invalidBearerResponse();
  }

  const tenantId = tenantIdSchema.safeParse(user.user_metadata?.tenant_org_id);
  if (!tenantId.success) {
    logger.warn('Bearer API token has no valid tenant context', {
      feature: 'api_auth',
      action: 'authenticate_bearer',
      userId: user.id,
    });
    return NextResponse.json(
      { success: false, code: 'TENANT_CONTEXT_MISSING', error: 'Tenant context is missing.' },
      { status: 403 },
    );
  }

  const { data: allowed, error: permissionError } = await supabase.rpc('has_permission', {
    p_permission: permission,
  });
  if (permissionError) {
    logger.error('Bearer API permission check failed', new Error(permissionError.message), {
      feature: 'api_auth',
      action: 'check_bearer_permission',
      tenantId: tenantId.data,
      userId: user.id,
      permission,
    });
    return NextResponse.json(
      { success: false, code: 'AUTHORIZATION_UNAVAILABLE', error: 'Authorization check failed.' },
      { status: 503 },
    );
  }
  if (allowed !== true) return forbiddenResponse(permission);

  const fullName = user.user_metadata?.full_name;
  return {
    tenantId: tenantId.data,
    userId: user.id,
    userName: typeof fullName === 'string' && fullName.trim().length > 0
      ? fullName
      : user.email ?? 'API User',
    mode: 'bearer',
  };
}

function sessionAuthToApiContext(auth: AuthContext): ApiRequestAuthContext {
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    userName: auth.userName,
    mode: 'session',
  };
}
