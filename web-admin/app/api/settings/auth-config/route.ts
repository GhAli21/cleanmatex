/**
 * GET /api/settings/auth-config  — effective sign-in / session policy for the caller's tenant (auth_config:read)
 * PUT /api/settings/auth-config  — change tenant overrides / reset to platform default      (auth_config:update)
 *
 * Tenant resolved server-side from the authenticated session (never from the request). Business rules
 * (plan flag session_timeout_control, platform-managed items, bounds) live in the use-cases; the DB
 * triggers are the final gate. Overrides are audited by the DB (CONFIG_CHANGED in sys_auth_audit_log).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/middleware/require-permission'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { AUTH_CONFIG_PERMISSIONS } from '@/lib/constants/permissions/auth-config-perm'
import { AUTH_CONFIG_ERROR_CODES } from '@/lib/constants/auth-admin-config'
import {
  AuthConfigError,
  getEffectiveAuthConfig,
  updateTenantAuthConfig,
} from '@/lib/services/auth/config/auth-admin-config.use-cases'
import { logger } from '@/lib/utils/logger'

/** Upper bound on changes per request — the catalog has ~10 items; guards against abuse. */
const MAX_CHANGES = 50

const bodySchema = z.object({
  changes: z
    .array(
      z.object({
        config_code: z.string().min(1).max(60),
        // null = reset the item to the platform value
        value: z.union([z.string().max(100), z.number().finite(), z.boolean(), z.null()]),
      })
    )
    .min(1)
    .max(MAX_CHANGES),
})

/** HTTP status per business error code. */
const ERROR_STATUS: Record<string, number> = {
  [AUTH_CONFIG_ERROR_CODES.FEATURE_NOT_ENABLED]: 403,
  [AUTH_CONFIG_ERROR_CODES.NOT_TENANT_EDITABLE]: 403,
  [AUTH_CONFIG_ERROR_CODES.UNKNOWN_ITEM]: 400,
  [AUTH_CONFIG_ERROR_CODES.INVALID_VALUE]: 422,
  [AUTH_CONFIG_ERROR_CODES.SAVE_FAILED]: 500,
}

/**
 * @param request - Incoming request (used by the permission guard)
 */
export async function GET(request: NextRequest) {
  // ─── Authorization (tenant resolved server-side) ──────────────────────────
  const auth = await requirePermission(AUTH_CONFIG_PERMISSIONS.READ)(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId } = auth

  try {
    const data = await getEffectiveAuthConfig(createAdminSupabaseClient(), tenantId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Failed to load auth config', error as Error, {
      feature: 'auth-config',
      action: 'get_auth_config',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to load security settings' }, { status: 500 })
  }
}

/**
 * @param request - Incoming request carrying `{ changes: [{ config_code, value }] }`
 */
export async function PUT(request: NextRequest) {
  // ─── Authorization (tenant resolved server-side) ──────────────────────────
  const auth = await requirePermission(AUTH_CONFIG_PERMISSIONS.UPDATE)(request)
  if (auth instanceof NextResponse) return auth
  const { tenantId, userId } = auth

  // ─── Input Validation ─────────────────────────────────────────────────────
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }

  try {
    const data = await updateTenantAuthConfig(createAdminSupabaseClient(), {
      tenantId,
      actorId: userId,
      changes: parsed.data.changes.map((c) => ({ configCode: c.config_code, value: c.value })),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, config_code: error.configCode },
        { status: ERROR_STATUS[error.code] ?? 400 }
      )
    }
    logger.error('Failed to update auth config', error as Error, {
      feature: 'auth-config',
      action: 'update_auth_config',
      tenantId,
    })
    return NextResponse.json({ success: false, error: 'Failed to save security settings' }, { status: 500 })
  }
}
