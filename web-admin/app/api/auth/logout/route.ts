/**
 * Logout API Route
 * 
 * POST /api/auth/logout
 * Handles server-side logout including cache invalidation
 * 
 * Body: { reason?: 'user' | 'session_expired' | 'security' | 'timeout' | 'unknown' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidatePermissionCache } from '@/lib/services/permission-cache'
import { logger } from '@/lib/utils/logger'

type LogoutReason = 'user' | 'session_expired' | 'security' | 'timeout' | 'unknown'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // If no user, still return success (already logged out)
    if (!user || authError) {
      return NextResponse.json(
        { success: true, message: 'Already logged out' },
        { status: 200 }
      )
    }

    const userId = user.id
    const tenantId = user.user_metadata?.tenant_org_id as string | undefined

    // Get logout reason from request body
    let reason: LogoutReason = 'user'
    try {
      const body = await request.json().catch(() => ({}))
      reason = body.reason || 'user'
    } catch {
      // Default to 'user' if body parsing fails
    }

    // Invalidate server-side caches
    if (tenantId) {
      try {
        await invalidatePermissionCache(userId, tenantId)
        
        // Log logout event
        logger.info('User logged out', {
          feature: 'auth',
          action: 'logout',
          userId,
          tenantId,
          reason,
        })
      } catch (cacheError) {
        // Log error but don't fail the request
        logger.warn('Failed to invalidate cache on logout', {
          feature: 'auth',
          action: 'logout',
          userId,
          tenantId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
        })
      }
    }

    // Note: Supabase session is cleared client-side
    // This API only handles server-side cleanup

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    logger.error('Error in logout API', error as Error, {
      feature: 'auth',
      action: 'logout',
    })

    // Return success even on error to prevent blocking client-side logout
    return NextResponse.json(
      {
        success: true,
        message: 'Logout processed (some cleanup may have failed)',
      },
      { status: 200 }
    )
  }
}

