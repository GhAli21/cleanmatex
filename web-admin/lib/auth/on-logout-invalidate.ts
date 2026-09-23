/**
 * Centralized logout-time cache invalidation.
 *
 * Single place to list every server-side cache that must be cleared when a
 * user logs out. Add new invalidate() calls here instead of scattering them
 * across the logout route. Each entry runs in isolation so one failure
 * doesn't block the others or fail the logout request.
 */

import { invalidatePermissionCache } from '@/lib/services/permission-cache'
import { cmxTempUtilsParaService } from '@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service'
import { logger } from '@/lib/utils/logger'

/**
 * Runs every cache invalidation needed on logout.
 * @param userId
 * @param tenantId - Per-tenant caches are skipped when absent.
 */
export async function onLogoutInvalidate(userId: string, tenantId?: string): Promise<void> {
  if (tenantId) {
    try {
      await invalidatePermissionCache(userId, tenantId)
    } catch (error) {
      logger.warn('onLogoutInvalidate: permission cache invalidation failed', {
        feature: 'auth',
        action: 'logout',
        userId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    // Global, non-tenant flag cache — cleared on any logout for a quick
    // manual refresh path; the 30 min TTL clears it either way.
    cmxTempUtilsParaService.invalidate()
  } catch (error) {
    logger.warn('onLogoutInvalidate: cmx-temp-utils-para cache invalidation failed', {
      feature: 'auth',
      action: 'logout',
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Add future cache invalidations here.
}
