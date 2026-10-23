/**
 * Server-action tenant guard (BF-20).
 *
 * A `'use server'` export is a callable HTTP endpoint: anyone can invoke it
 * with any arguments. Tenant identity therefore always comes from the
 * authenticated session, never from a caller-supplied argument. A tenant id
 * passed by the caller is treated only as a value to verify; a mismatch is
 * rejected and logged.
 *
 * External clients (mobile app, public tracking, HQ) do not use server
 * actions. They use API routes that verify their own credential for the
 * tenant (bearer token, opaque tracking token, service credential).
 *
 * Every `'use server'` export whose parameters include a tenant id must call
 * {@link resolveActionTenant}. `__tests__/security/server-action-tenant-guard.test.ts`
 * enforces this across the repo.
 */

import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { logger } from '@/lib/utils/logger';

/** Stable failure codes returned by {@link resolveActionTenant}. */
export const ACTION_GUARD_ERRORS = {
  /** No active staff session (or a pending forced password change). */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** The caller passed a tenant id that differs from the session tenant. */
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  /** The session user lacks the permission the action requires. */
  FORBIDDEN: 'FORBIDDEN',
} as const;

/** Derived union of guard failure codes. */
export type ActionGuardError = (typeof ACTION_GUARD_ERRORS)[keyof typeof ACTION_GUARD_ERRORS];

/**
 * Guard outcome. Flat shape (not a discriminated union): `ok` true means
 * `tenantId` and `userId` are set; `ok` false means `error` is set.
 */
export interface ActionTenantContext {
  ok: boolean;
  tenantId?: string;
  userId?: string;
  error?: ActionGuardError;
}

/** Options for {@link resolveActionTenant}. */
export interface ResolveActionTenantOptions {
  /** Action name for logs, e.g. `orders.getOrder`. */
  action: string;
  /** Tenant id supplied by the caller, if any; verified against the session. */
  expectedTenantId?: string | null;
  /** Permission code (`resource:action`) required by the action, if any. */
  permission?: string;
}

/**
 * Resolves the tenant and user for a server action from the session.
 *
 * Order of checks:
 * 1. an active session exists
 * 2. a caller-supplied tenant id, when given, equals the session tenant
 * 3. the required permission, when given, is held
 *
 * @param options - Action name, optional expected tenant, optional permission.
 * @returns Session tenant and user, or a stable error code.
 */
export async function resolveActionTenant(
  options: ResolveActionTenantOptions,
): Promise<ActionTenantContext> {
  const { action, expectedTenantId, permission } = options;

  let tenantId: string;
  let userId: string;
  try {
    ({ tenantId, userId } = await getAuthContext());
  } catch {
    return { ok: false, error: ACTION_GUARD_ERRORS.UNAUTHENTICATED };
  }
  if (!tenantId || !userId) {
    return { ok: false, error: ACTION_GUARD_ERRORS.UNAUTHENTICATED };
  }

  if (expectedTenantId && expectedTenantId !== tenantId) {
    logger.warn('Server action rejected: caller tenant differs from session tenant', {
      feature: 'server-action-guard',
      action,
      sessionTenantId: tenantId,
      callerTenantId: expectedTenantId,
      userId,
    });
    return { ok: false, error: ACTION_GUARD_ERRORS.TENANT_MISMATCH };
  }

  if (permission && !(await hasPermissionServer(permission))) {
    return { ok: false, error: ACTION_GUARD_ERRORS.FORBIDDEN };
  }

  return { ok: true, tenantId, userId };
}
